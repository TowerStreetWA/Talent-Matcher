import { Router, type IRouter } from "express";
import { desc, eq, and, ilike, or, sql } from "drizzle-orm";
import {
  db,
  candidatesTable,
  jobsTable,
  jobSourcesTable,
  matchRunsTable,
  matchesTable,
} from "@workspace/db";
import {
  CreateCandidateBody,
  CreateCandidateResponse,
  GetCandidateResponse,
  ListCandidatesResponse,
  UpdateCandidateBody,
  UpdateCandidateResponse,
  UploadCvBody,
  UploadCvResponse,
  RunMatchResponse,
  ListCandidateMatchesResponse,
  ListMatchRunsResponse,
} from "@workspace/api-zod";
import { Readable } from "stream";
import { toCandidateDto, toMatchDto, toMatchRunDto } from "../lib/dto";
import { runMatchForCandidate } from "../lib/matchRunner";
import { parseCvText } from "../lib/cvParser";
import { recordAudit } from "../lib/audit";
import { tenantOf, auditActor } from "../middlewares/auth";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { extractCvText, CvExtractionError } from "../lib/extractCvText";
import { normalizeQuery } from "../lib/search/normalize";
import { scoreCandidate, type ScoreBreakdown } from "../lib/search/rank";
import { inferQueryFinIntent } from "../lib/search/finClassify";
import type { SearchDebugDto } from "../lib/dto";

const toSearchDebug = (b: ScoreBreakdown): SearchDebugDto => ({
  score: b.total,
  sector: b.finTags?.sector ?? null,
  function: b.finTags?.fn ?? null,
  employerType: b.finTags?.employerType ?? null,
  sectorBoost: b.finSector,
  functionBoost: b.finFunction,
  employerTypeBoost: b.finEmployerType,
  directEmployerBoost: b.finDirectEmployer,
  matchedTerms: b.finTags?.matchedTerms ?? [],
});

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

const paramId = (raw: string | string[]): string =>
  Array.isArray(raw) ? (raw[0] ?? "") : raw;

router.get("/candidates", async (req, res): Promise<void> => {
  const search = typeof req.query["search"] === "string" ? req.query["search"] : "";
  const status = typeof req.query["status"] === "string" ? req.query["status"] : "";
  const conditions = [eq(candidatesTable.tenantId, tenantOf(req))];
  const nq = search ? normalizeQuery(search) : null;
  if (nq) {
    const likeConds = [];
    for (const variant of nq.variants.slice(0, 15)) {
      const like = `%${variant}%`;
      likeConds.push(
        ilike(candidatesTable.firstName, like),
        ilike(candidatesTable.lastName, like),
        ilike(candidatesTable.currentTitle, like),
        ilike(candidatesTable.currentCompany, like),
        ilike(candidatesTable.locationText, like),
        sql`array_to_string(${candidatesTable.skills}, ' ') ILIKE ${like}`,
        sql`array_to_string(${candidatesTable.titles}, ' ') ILIKE ${like}`,
        sql`array_to_string(${candidatesTable.industries}, ' ') ILIKE ${like}`,
      );
    }
    const searchCond = or(...likeConds);
    if (searchCond) conditions.push(searchCond);
  }
  if (status) conditions.push(eq(candidatesTable.status, status));
  let rows = await db
    .select()
    .from(candidatesTable)
    .where(and(...conditions))
    .orderBy(desc(candidatesTable.createdAt));
  const debug = req.query["debug"] === "1";
  let debugById: Map<string, SearchDebugDto> | null = null;
  if (nq) {
    const finIntent = inferQueryFinIntent(nq);
    const scored = rows
      .map((row) => ({ row, breakdown: scoreCandidate(nq, row, finIntent) }))
      .sort(
        (a, b) =>
          b.breakdown.total - a.breakdown.total ||
          b.row.createdAt.getTime() - a.row.createdAt.getTime(),
      );
    rows = scored.map(({ row }) => row);
    if (debug) {
      debugById = new Map(
        scored.map(({ row, breakdown }) => [row.id, toSearchDebug(breakdown)]),
      );
    }
    req.log.info(
      {
        event: "search",
        scope: "candidates",
        rawQuery: search.slice(0, 200),
        normalizedQuery: nq.cleaned.slice(0, 200),
        variantCount: nq.variants.length,
        finIntent: finIntent.hasFinIntent
          ? { sector: finIntent.sector, fn: finIntent.fn }
          : undefined,
        filters: { status: status || undefined },
        resultCount: rows.length,
        zeroResults: rows.length === 0,
      },
      "candidate search executed",
    );
  }
  res.json(
    ListCandidatesResponse.parse(
      rows.map((row) => toCandidateDto(row, debugById?.get(row.id))),
    ),
  );
});

router.post("/candidates", async (req, res): Promise<void> => {
  const parsed = CreateCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(candidatesTable)
    .values({ ...parsed.data, tenantId: tenantOf(req) })
    .returning();
  if (!row) {
    res.status(500).json({ message: "Failed to create candidate" });
    return;
  }
  await recordAudit({
    action: "candidate.created",
    entityType: "candidate",
    entityId: row.id,
    metadata: `${row.firstName} ${row.lastName} created manually`,
    ...auditActor(req),
  });
  res.status(201).json(CreateCandidateResponse.parse(toCandidateDto(row)));
});

router.post("/candidates/upload-cv", async (req, res): Promise<void> => {
  const parsed = UploadCvBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }
  const { fileName, objectPath } = parsed.data;
  let cvText = parsed.data.cvText ?? "";
  let cvFileKey: string | null = null;

  if (objectPath) {
    try {
      const normalized = objectStorage.normalizeObjectEntityPath(objectPath);
      const file = await objectStorage.getObjectEntityFile(normalized);
      const [meta] = await file.getMetadata();
      const [buffer] = await file.download();
      cvText = await extractCvText(buffer, fileName, meta.contentType ?? null);
      await objectStorage.trySetObjectEntityAclPolicy(normalized, {
        owner: tenantOf(req),
        visibility: "private",
      });
      cvFileKey = normalized;
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        res.status(400).json({ message: "Uploaded file not found. Please try again." });
        return;
      }
      if (err instanceof CvExtractionError) {
        res.status(400).json({ message: err.message });
        return;
      }
      req.log.error({ err }, "CV file processing failed");
      res.status(500).json({ message: "Failed to process the uploaded file" });
      return;
    }
  }

  if (cvText.trim().length < 20) {
    res.status(400).json({
      message: "Please provide the CV as a file upload or pasted text.",
    });
    return;
  }

  let profile;
  try {
    profile = await parseCvText(cvText);
  } catch (err) {
    req.log.error({ err }, "CV parsing failed");
    res.status(400).json({
      message:
        "Could not parse this CV. Please check the text is a readable CV and try again.",
    });
    return;
  }
  const [row] = await db
    .insert(candidatesTable)
    .values({
      tenantId: tenantOf(req),
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      currentTitle: profile.currentTitle ?? null,
      currentCompany: profile.currentCompany ?? null,
      locationText: profile.locationText ?? null,
      summary: profile.summary ?? null,
      seniority: profile.seniority ?? null,
      skills: profile.skills,
      titles: profile.titles,
      industries: profile.industries,
      remotePreference: profile.remotePreference ?? null,
      desiredSalaryMin: profile.desiredSalaryMin ?? null,
      desiredSalaryMax: profile.desiredSalaryMax ?? null,
      salaryCurrency: profile.salaryCurrency ?? null,
      cvFileName: fileName,
      cvFileKey,
      cvText,
    })
    .returning();
  if (!row) {
    res.status(500).json({ message: "Failed to store candidate" });
    return;
  }
  await recordAudit({
    action: "candidate.cv_parsed",
    entityType: "candidate",
    entityId: row.id,
    metadata: `CV "${fileName}" parsed into profile for ${row.firstName} ${row.lastName}`,
    ...auditActor(req),
  });
  await runMatchForCandidate(row, "cv_upload");
  const [refreshed] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, row.id));
  res.status(201).json(UploadCvResponse.parse(toCandidateDto(refreshed ?? row)));
});

router.get("/candidates/:id/cv-file", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const [row] = await db
    .select()
    .from(candidatesTable)
    .where(
      and(eq(candidatesTable.id, id), eq(candidatesTable.tenantId, tenantOf(req))),
    );
  if (!row || !row.cvFileKey) {
    res.status(404).json({ message: "No CV file stored for this candidate" });
    return;
  }
  try {
    const file = await objectStorage.getObjectEntityFile(row.cvFileKey);
    const response = await objectStorage.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${(row.cvFileName ?? "cv").replace(/["\\\r\n]/g, "")}"`,
    );
    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ message: "CV file not found in storage" });
      return;
    }
    req.log.error({ err }, "Error serving CV file");
    res.status(500).json({ message: "Failed to download CV file" });
  }
});

router.get("/candidates/:id", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const [row] = await db
    .select()
    .from(candidatesTable)
    .where(
      and(eq(candidatesTable.id, id), eq(candidatesTable.tenantId, tenantOf(req))),
    );
  if (!row) {
    res.status(404).json({ message: "Candidate not found" });
    return;
  }
  res.json(GetCandidateResponse.parse(toCandidateDto(row)));
});

router.patch("/candidates/:id", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const parsed = UpdateCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(candidatesTable)
    .set(parsed.data)
    .where(
      and(eq(candidatesTable.id, id), eq(candidatesTable.tenantId, tenantOf(req))),
    )
    .returning();
  if (!row) {
    res.status(404).json({ message: "Candidate not found" });
    return;
  }
  await recordAudit({
    action: "candidate.updated",
    entityType: "candidate",
    entityId: row.id,
    metadata: `Profile updated for ${row.firstName} ${row.lastName}`,
    ...auditActor(req),
  });
  res.json(UpdateCandidateResponse.parse(toCandidateDto(row)));
});

router.delete("/candidates/:id", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const [row] = await db
    .delete(candidatesTable)
    .where(
      and(eq(candidatesTable.id, id), eq(candidatesTable.tenantId, tenantOf(req))),
    )
    .returning();
  if (!row) {
    res.status(404).json({ message: "Candidate not found" });
    return;
  }
  await recordAudit({
    action: "candidate.deleted",
    entityType: "candidate",
    entityId: id,
    metadata: `${row.firstName} ${row.lastName} and all associated data removed`,
    ...auditActor(req),
  });
  res.json({ message: "Candidate deleted" });
});

router.post("/candidates/:id/reparse-cv", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const [candidate] = await db
    .select()
    .from(candidatesTable)
    .where(
      and(eq(candidatesTable.id, id), eq(candidatesTable.tenantId, tenantOf(req))),
    );
  if (!candidate) {
    res.status(404).json({ message: "Candidate not found" });
    return;
  }

  let cvText = candidate.cvText ?? "";

  if (candidate.cvFileKey) {
    try {
      const file = await objectStorage.getObjectEntityFile(candidate.cvFileKey);
      const [meta] = await file.getMetadata();
      const [buffer] = await file.download();
      cvText = await extractCvText(
        buffer,
        candidate.cvFileName ?? "cv",
        meta.contentType ?? null,
      );
    } catch (err) {
      req.log.warn({ err }, "CV file re-fetch failed, falling back to stored cvText");
    }
  }

  if (cvText.trim().length < 20) {
    res.status(400).json({
      message: "No CV text available to re-parse for this candidate.",
    });
    return;
  }

  let profile;
  try {
    profile = await parseCvText(cvText);
  } catch (err) {
    req.log.error({ err }, "CV re-parse failed");
    res.status(400).json({
      message: "CV parsing failed. Please check the CV content and try again.",
    });
    return;
  }

  const [updated] = await db
    .update(candidatesTable)
    .set({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email ?? candidate.email,
      phone: profile.phone ?? candidate.phone,
      currentTitle: profile.currentTitle ?? null,
      currentCompany: profile.currentCompany ?? null,
      locationText: profile.locationText ?? null,
      summary: profile.summary ?? null,
      seniority: profile.seniority ?? null,
      skills: profile.skills,
      titles: profile.titles,
      industries: profile.industries,
      remotePreference: profile.remotePreference ?? null,
      desiredSalaryMin: profile.desiredSalaryMin ?? null,
      desiredSalaryMax: profile.desiredSalaryMax ?? null,
      salaryCurrency: profile.salaryCurrency ?? null,
      cvText,
    })
    .where(eq(candidatesTable.id, id))
    .returning();

  await recordAudit({
    action: "candidate.cv_parsed",
    entityType: "candidate",
    entityId: id,
    metadata: `CV re-parsed for ${updated?.firstName ?? ""} ${updated?.lastName ?? ""}`,
    ...auditActor(req),
  });

  res.json(GetCandidateResponse.parse(toCandidateDto(updated ?? candidate)));
});

router.post("/candidates/:id/run-match", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const [candidate] = await db
    .select()
    .from(candidatesTable)
    .where(
      and(eq(candidatesTable.id, id), eq(candidatesTable.tenantId, tenantOf(req))),
    );
  if (!candidate) {
    res.status(404).json({ message: "Candidate not found" });
    return;
  }
  const run = await runMatchForCandidate(candidate, "manual");
  res.status(201).json(RunMatchResponse.parse(toMatchRunDto(run)));
});

router.get("/candidates/:id/matches", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const [latestRun] = await db
    .select()
    .from(matchRunsTable)
    .where(
      and(
        eq(matchRunsTable.candidateId, id),
        eq(matchRunsTable.tenantId, tenantOf(req)),
      ),
    )
    .orderBy(desc(matchRunsTable.startedAt))
    .limit(1);
  if (!latestRun) {
    res.json(ListCandidateMatchesResponse.parse([]));
    return;
  }
  const rows = await db
    .select({
      match: matchesTable,
      job: jobsTable,
      sourceName: jobSourcesTable.name,
      candFirst: candidatesTable.firstName,
      candLast: candidatesTable.lastName,
    })
    .from(matchesTable)
    .innerJoin(jobsTable, eq(matchesTable.jobId, jobsTable.id))
    .leftJoin(jobSourcesTable, eq(jobsTable.sourceId, jobSourcesTable.id))
    .innerJoin(candidatesTable, eq(matchesTable.candidateId, candidatesTable.id))
    .where(eq(matchesTable.matchRunId, latestRun.id))
    .orderBy(desc(matchesTable.overallScore));
  res.json(
    ListCandidateMatchesResponse.parse(
      rows.map((r) =>
        toMatchDto(r.match, r.job, r.sourceName, `${r.candFirst} ${r.candLast}`),
      ),
    ),
  );
});

router.get("/candidates/:id/match-runs", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const rows = await db
    .select()
    .from(matchRunsTable)
    .where(
      and(
        eq(matchRunsTable.candidateId, id),
        eq(matchRunsTable.tenantId, tenantOf(req)),
      ),
    )
    .orderBy(desc(matchRunsTable.startedAt));
  res.json(ListMatchRunsResponse.parse(rows.map(toMatchRunDto)));
});

export default router;
