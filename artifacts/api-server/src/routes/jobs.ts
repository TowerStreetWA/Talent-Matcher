import { Router, type IRouter } from "express";
import { desc, eq, and, ilike, or, sql } from "drizzle-orm";
import { db, jobsTable, jobSourcesTable, searchEventsTable } from "@workspace/db";
import {
  ListJobsResponse,
  GetJobResponse,
  SearchJobsResponse,
  ListJobSearchFamiliesResponse,
} from "@workspace/api-zod";
import { toJobDto } from "../lib/dto";
import { tenantOf } from "../middlewares/auth";
import { normalizeQuery } from "../lib/search/normalize";
import { scoreJob, type ScoreBreakdown } from "../lib/search/rank";
import { inferQueryFinIntent } from "../lib/search/finClassify";
import {
  resolveSectorInput,
  expandLocationInput,
} from "../lib/search/jobSearchFilters";
import { scoreJobSearch } from "../lib/search/jobSearchRank";
import { classificationFromTags } from "../lib/search/classification";
import {
  DISPLAY_FAMILIES,
  displayFamiliesForSector,
  resolveDisplayFamilies,
  matchesDisplayFamily,
  type DisplayFamily,
} from "../config/curatedTitles/displayFamilies";
import { FIN_SECTORS, type FinSector } from "../lib/search/finTaxonomy";
import type { NormalizedQuery } from "../lib/search/normalize";
import type { JobSearchScore } from "../lib/search/jobSearchRank";
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

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
/** Total-result cap: we never fetch/rank more than this many rows. */
const TOTAL_CAP = 200;

const intParam = (raw: unknown, fallback: number, min: number, max: number): number => {
  if (typeof raw !== "string") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const SOURCE_TYPES = new Set([
  "direct_employer",
  "google_jobs",
  "job_board",
  "agency",
]);

// Taxonomy-driven family filter catalog: which display families exist per
// sector. Pure config read — no DB access. Registered before /jobs/:id.
router.get("/jobs/search/families", (req, res): void => {
  const sectorRaw =
    typeof req.query["sector"] === "string" ? req.query["sector"] : "";
  const sectorFilter = resolveSectorInput(sectorRaw);
  if (sectorRaw && !sectorFilter) {
    res.status(400).json({
      message: `Unknown sector. Supported: ${FIN_SECTORS.join(", ")}.`,
    });
    return;
  }
  const sectors = sectorFilter ? [sectorFilter] : FIN_SECTORS;
  res.json(
    ListJobSearchFamiliesResponse.parse({
      sectors: sectors.map((sector) => ({
        sector,
        families: displayFamiliesForSector(sector).map(({ key, label }) => ({
          key,
          label,
        })),
      })),
    }),
  );
});

export interface JobSearchPipelineArgs {
  tenantId: string;
  nq: NormalizedQuery | null;
  locationVariants: string[];
  sectorFilter: FinSector | null;
  familyFilters: DisplayFamily[];
  sourceFilter: string | null;
}

export interface JobSearchPipelineRow {
  r: { job: typeof jobsTable.$inferSelect; sourceName: string | null };
  s: JobSearchScore;
}

/**
 * The core /jobs/search pipeline: DB broadening query (capped at TOTAL_CAP)
 * followed by in-memory scoring, sector/family filtering, and ranking.
 * Extracted so internal diagnostics can run the exact same search that the
 * recruiter-facing route uses. Read-only.
 */
export async function runJobSearchPipeline(
  args: JobSearchPipelineArgs,
): Promise<JobSearchPipelineRow[]> {
  const { tenantId, nq, locationVariants, sectorFilter, familyFilters, sourceFilter } =
    args;
  const conditions = [
    eq(jobsTable.tenantId, tenantId),
    eq(jobsTable.status, "active"),
    eq(jobsTable.isCanonical, true),
  ];
  if (nq) {
    const likeConds = [];
    for (const variant of nq.variants.slice(0, 15)) {
      const like = `%${variant}%`;
      likeConds.push(
        ilike(jobsTable.title, like),
        ilike(jobsTable.companyName, like),
        ilike(jobsTable.industry, like),
        ilike(jobsTable.descriptionText, like),
        sql`array_to_string(${jobsTable.skills}, ' ') ILIKE ${like}`,
      );
    }
    const searchCond = or(...likeConds);
    if (searchCond) conditions.push(searchCond);
  }
  if (locationVariants.length > 0) {
    const locConds = locationVariants.map((v) =>
      ilike(jobsTable.locationText, `%${v}%`),
    );
    const locCond = or(...locConds);
    if (locCond) conditions.push(locCond);
  }
  if (sourceFilter) conditions.push(eq(jobsTable.sourceType, sourceFilter));

  const rows = await db
    .select({ job: jobsTable, sourceName: jobSourcesTable.name })
    .from(jobsTable)
    .leftJoin(jobSourcesTable, eq(jobsTable.sourceId, jobSourcesTable.id))
    .where(and(...conditions))
    .orderBy(desc(jobsTable.postedAt))
    .limit(TOTAL_CAP);

  return rows
    .map((r) => ({
      r,
      s: scoreJobSearch(nq, r.job, { sectorFilter, locationVariants }),
    }))
    .filter(({ s }) => (sectorFilter ? s.sector === sectorFilter : true))
    .filter(({ s }) =>
      familyFilters.length === 0
        ? true
        : familyFilters.some((df) => matchesDisplayFamily(df, s.fn, s.curatedTags)),
    )
    .sort(
      (a, b) =>
        b.s.score - a.s.score ||
        (b.r.job.postedAt?.getTime() ?? 0) - (a.r.job.postedAt?.getTime() ?? 0),
    );
}

// NOTE: must stay registered before /jobs/:id so "search" isn't captured as an id.
router.get("/jobs/search", async (req, res): Promise<void> => {
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  const locationRaw =
    typeof req.query["location"] === "string" ? req.query["location"] : "";
  const sectorRaw =
    typeof req.query["sector"] === "string" ? req.query["sector"] : "";
  const sourceRaw =
    typeof req.query["source"] === "string" ? req.query["source"] : "";
  const page = intParam(req.query["page"], 1, 1, 1000);
  const pageSize = intParam(
    req.query["pageSize"],
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE,
  );

  const familiesRaw =
    typeof req.query["families"] === "string" ? req.query["families"] : "";

  const sectorFilter = resolveSectorInput(sectorRaw);
  if (sectorRaw && !sectorFilter) {
    res.status(400).json({
      message: `Unknown sector. Supported: ${FIN_SECTORS.join(", ")}.`,
    });
    return;
  }
  const familyKeys = familiesRaw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const familyFilters: DisplayFamily[] = [];
  for (const key of familyKeys) {
    const dfs = resolveDisplayFamilies(key, sectorFilter);
    if (dfs.length === 0) {
      const supported = (
        sectorFilter
          ? displayFamiliesForSector(sectorFilter)
          : Object.values(DISPLAY_FAMILIES).flat()
      ).map((d) => d.key);
      res.status(400).json({
        message: `Unknown family "${key}"${sectorFilter ? ` for sector ${sectorFilter}` : ""}. Supported: ${[...new Set(supported)].join(", ")}.`,
      });
      return;
    }
    familyFilters.push(...dfs);
  }
  if (sourceRaw && !SOURCE_TYPES.has(sourceRaw)) {
    res.status(400).json({
      message:
        "Unknown source. Supported: direct_employer, google_jobs, job_board, agency.",
    });
    return;
  }
  const sourceFilter = sourceRaw || null;
  const locationVariants = locationRaw ? expandLocationInput(locationRaw) : [];
  const nq = q.trim() ? normalizeQuery(q) : null;

  const scored = await runJobSearchPipeline({
    tenantId: tenantOf(req),
    nq,
    locationVariants,
    sectorFilter,
    familyFilters,
    sourceFilter,
  });

  const total = scored.length;
  const start = (page - 1) * pageSize;
  const pageRows = scored.slice(start, start + pageSize);

  req.log.info(
    {
      event: "search",
      scope: "jobs_search",
      rawQuery: q.slice(0, 200),
      normalizedQuery: nq?.cleaned.slice(0, 200),
      variantCount: nq?.variants.length ?? 0,
      filters: {
        location: locationRaw ? locationRaw.slice(0, 100) : undefined,
        sector: sectorFilter ?? undefined,
        families: familyFilters.length > 0 ? familyFilters.map((f) => f.key) : undefined,
        source: sourceFilter ?? undefined,
      },
      page,
      pageSize,
      resultCount: total,
      zeroResults: total === 0,
      topResults: scored.slice(0, 3).map(({ r, s }) => ({
        title: (r.job.title ?? "").slice(0, 80),
        score: s.score,
        sector: s.sector ?? undefined,
      })),
    },
    "job search executed",
  );

  // Search analytics: persist one row per executed search (only on page 1 so
  // paging through results doesn't inflate counts). Failures never break search.
  if (page === 1) {
    try {
      await db.insert(searchEventsTable).values({
        tenantId: tenantOf(req),
        userId: req.auth?.userId ?? null,
        type: "job_search",
        query: q.slice(0, 200),
        location: locationRaw.slice(0, 100),
        sector: sectorFilter,
        sourceType: sourceFilter,
        resultsCount: total,
        zeroResults: total === 0,
      });
    } catch (err) {
      req.log.warn({ err }, "Failed to record search event");
    }
  }

  res.json(
    SearchJobsResponse.parse({
      results: pageRows.map(({ r, s }) => {
        const cls = classificationFromTags(s.sector, s.fn, s.curatedTags);
        return {
        id: r.job.id,
        title: r.job.title,
        companyName: r.job.companyName,
        locationText: r.job.locationText,
        sector: s.sector,
        sectorLabel: cls?.sectorLabel ?? null,
        families: cls?.families ?? [],
        familyLabels: cls?.familyLabels ?? [],
        sourceType: r.job.sourceType,
        sourceProvider: r.job.sourceProvider,
        sourceName: r.sourceName,
        postedAt: r.job.postedAt?.toISOString() ?? null,
        salaryText: r.job.salaryText,
        skills: r.job.skills ?? [],
        summary: r.job.descriptionText
          ? r.job.descriptionText.slice(0, 240)
          : null,
        applyUrl: r.job.applyUrl,
        score: s.score,
        explanation: s.explanation,
        };
      }),
      page,
      pageSize,
      total,
    }),
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
