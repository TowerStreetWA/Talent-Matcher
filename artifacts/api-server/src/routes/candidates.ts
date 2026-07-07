import { Router, type IRouter } from "express";
import { desc, eq, and, ilike, or } from "drizzle-orm";
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
import { toCandidateDto, toMatchDto, toMatchRunDto } from "../lib/dto";
import { runMatchForCandidate } from "../lib/matchRunner";
import { parseCvText } from "../lib/cvParser";
import { recordAudit } from "../lib/audit";
import { tenantOf, auditActor } from "../middlewares/auth";

const router: IRouter = Router();

const paramId = (raw: string | string[]): string =>
  Array.isArray(raw) ? (raw[0] ?? "") : raw;

router.get("/candidates", async (req, res): Promise<void> => {
  const search = typeof req.query["search"] === "string" ? req.query["search"] : "";
  const status = typeof req.query["status"] === "string" ? req.query["status"] : "";
  const conditions = [eq(candidatesTable.tenantId, tenantOf(req))];
  if (search) {
    const like = `%${search}%`;
    const searchCond = or(
      ilike(candidatesTable.firstName, like),
      ilike(candidatesTable.lastName, like),
      ilike(candidatesTable.currentTitle, like),
      ilike(candidatesTable.currentCompany, like),
    );
    if (searchCond) conditions.push(searchCond);
  }
  if (status) conditions.push(eq(candidatesTable.status, status));
  const rows = await db
    .select()
    .from(candidatesTable)
    .where(and(...conditions))
    .orderBy(desc(candidatesTable.createdAt));
  res.json(ListCandidatesResponse.parse(rows.map(toCandidateDto)));
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
  let profile;
  try {
    profile = await parseCvText(parsed.data.cvText);
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
      cvFileName: parsed.data.fileName,
      cvText: parsed.data.cvText,
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
    metadata: `CV "${parsed.data.fileName}" parsed into profile for ${row.firstName} ${row.lastName}`,
    ...auditActor(req),
  });
  await runMatchForCandidate(row, "cv_upload");
  const [refreshed] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, row.id));
  res.status(201).json(UploadCvResponse.parse(toCandidateDto(refreshed ?? row)));
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
