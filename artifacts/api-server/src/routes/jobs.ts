import { Router, type IRouter } from "express";
import { desc, eq, and, ilike, or, sql } from "drizzle-orm";
import { db, jobsTable, jobSourcesTable } from "@workspace/db";
import { ListJobsResponse, GetJobResponse } from "@workspace/api-zod";
import { toJobDto } from "../lib/dto";
import { tenantOf } from "../middlewares/auth";
import { normalizeQuery } from "../lib/search/normalize";
import { scoreJob, type ScoreBreakdown } from "../lib/search/rank";
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

const paramId = (raw: string | string[]): string =>
  Array.isArray(raw) ? (raw[0] ?? "") : raw;

router.get("/jobs", async (req, res): Promise<void> => {
  const search = typeof req.query["search"] === "string" ? req.query["search"] : "";
  const sourceId =
    typeof req.query["sourceId"] === "string" ? req.query["sourceId"] : "";
  const status = typeof req.query["status"] === "string" ? req.query["status"] : "";
  const conditions = [eq(jobsTable.tenantId, tenantOf(req))];
  const nq = search ? normalizeQuery(search) : null;
  if (nq) {
    const likeConds = [];
    for (const variant of nq.variants.slice(0, 15)) {
      const like = `%${variant}%`;
      likeConds.push(
        ilike(jobsTable.title, like),
        ilike(jobsTable.companyName, like),
        ilike(jobsTable.locationText, like),
        ilike(jobsTable.industry, like),
        ilike(jobsTable.descriptionText, like),
        sql`array_to_string(${jobsTable.skills}, ' ') ILIKE ${like}`,
      );
    }
    const searchCond = or(...likeConds);
    if (searchCond) conditions.push(searchCond);
  }
  if (sourceId) conditions.push(eq(jobsTable.sourceId, sourceId));
  if (status) conditions.push(eq(jobsTable.status, status));
  let rows = await db
    .select({ job: jobsTable, sourceName: jobSourcesTable.name })
    .from(jobsTable)
    .leftJoin(jobSourcesTable, eq(jobsTable.sourceId, jobSourcesTable.id))
    .where(and(...conditions))
    .orderBy(desc(jobsTable.postedAt))
    .limit(200);
  const debug = req.query["debug"] === "1";
  let debugByJobId: Map<string, SearchDebugDto> | null = null;
  if (nq) {
    const finIntent = inferQueryFinIntent(nq);
    const scored = rows
      .map((r) => ({ r, breakdown: scoreJob(nq, r.job, finIntent) }))
      .sort(
        (a, b) =>
          b.breakdown.total - a.breakdown.total ||
          (b.r.job.postedAt?.getTime() ?? 0) - (a.r.job.postedAt?.getTime() ?? 0),
      );
    rows = scored.map(({ r }) => r);
    if (debug) {
      debugByJobId = new Map(
        scored.map(({ r, breakdown }) => [r.job.id, toSearchDebug(breakdown)]),
      );
    }
    req.log.info(
      {
        event: "search",
        scope: "jobs",
        rawQuery: search.slice(0, 200),
        normalizedQuery: nq.cleaned.slice(0, 200),
        variantCount: nq.variants.length,
        finIntent: finIntent.hasFinIntent
          ? { sector: finIntent.sector, fn: finIntent.fn }
          : undefined,
        filters: {
          sourceId: sourceId || undefined,
          status: status || undefined,
        },
        resultCount: rows.length,
        zeroResults: rows.length === 0,
        topResults: scored.slice(0, 3).map(({ r, breakdown }) => ({
          title: (r.job.title ?? "").slice(0, 80),
          score: breakdown.total,
          finSector: breakdown.finTags?.sector ?? undefined,
          finBoosts:
            breakdown.finSector +
              breakdown.finFunction +
              breakdown.finEmployerType +
              breakdown.finDirectEmployer || undefined,
        })),
      },
      "job search executed",
    );
  }
  res.json(
    ListJobsResponse.parse(
      rows.map((r) =>
        toJobDto(r.job, r.sourceName, debugByJobId?.get(r.job.id)),
      ),
    ),
  );
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const [row] = await db
    .select({ job: jobsTable, sourceName: jobSourcesTable.name })
    .from(jobsTable)
    .leftJoin(jobSourcesTable, eq(jobsTable.sourceId, jobSourcesTable.id))
    .where(and(eq(jobsTable.id, id), eq(jobsTable.tenantId, tenantOf(req))));
  if (!row) {
    res.status(404).json({ message: "Job not found" });
    return;
  }
  res.json(GetJobResponse.parse(toJobDto(row.job, row.sourceName)));
});

export default router;
