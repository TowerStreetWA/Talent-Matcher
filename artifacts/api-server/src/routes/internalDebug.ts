import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { tenantOf } from "../middlewares/auth";
import { normalizeQuery } from "../lib/search/normalize";
import { classifyJobForDisplay } from "../lib/search/classification";
import { runJobSearchPipeline } from "./jobs";
import {
  CAREERS_DIRECTORIES,
  CAREERS_DIRECTORY_KEYS,
  directoryByKey,
  LONDON_INSURANCE_DIRECTORY,
} from "../config/careersDirectories";
import {
  directoryProviderKey,
  directoryProviderKeys,
  type CareersDirectoryConfig,
} from "../lib/directory/engine";
import { cachedResolution } from "../lib/directory/resolveCareersBoard";
import { firecrawlUnavailability } from "../lib/firecrawl";
import { ingestionPathRecord } from "../lib/directory/ingestionPathRegistry";
import {
  buildIndustryScorecard,
  collectEmployerSignals,
} from "../lib/directory/sectorScorecard";

/**
 * Internal-only, read-only diagnostics. Deliberately NOT part of the public
 * OpenAPI contract — operator/dev endpoints mounted admin+ only (see
 * routes/index.ts `/internal` guard). No recruiter-facing UI calls these.
 */
const router: IRouter = Router();

/**
 * Diagnose why the UI shows fewer underwriting results than expected:
 * - counts vacancies whose title matches "underwrit" (case-insensitive substring)
 * - breaks the active+canonical matches down by source_provider/source_type
 * - runs the exact /jobs/search pipeline for q="underwriter" and reports how
 *   many results it returns for the same tenant
 * Tenant-scoped; no mutations.
 */
router.get("/internal/debug/underwriting-count", async (req, res) => {
  const tenantId = tenantOf(req);
  const titleMatch = ilike(jobsTable.title, "%underwrit%");
  const activeCanonicalMatch = and(
    eq(jobsTable.tenantId, tenantId),
    titleMatch,
    eq(jobsTable.status, "active"),
    eq(jobsTable.isCanonical, true),
  );

  const activeCanonicalAll = and(
    eq(jobsTable.tenantId, tenantId),
    eq(jobsTable.status, "active"),
    eq(jobsTable.isCanonical, true),
  );

  const searchQuery = "underwriter";
  const [[total], [activeCanonical], bySource, searchResults, boardRows, classifyRows] =
    await Promise.all([
    db
      .select({ value: count() })
      .from(jobsTable)
      .where(and(eq(jobsTable.tenantId, tenantId), titleMatch)),
    db
      .select({ value: count() })
      .from(jobsTable)
      .where(activeCanonicalMatch),
    db
      .select({
        sourceProvider: jobsTable.sourceProvider,
        sourceType: jobsTable.sourceType,
        value: count(),
      })
      .from(jobsTable)
      .where(activeCanonicalMatch)
      .groupBy(jobsTable.sourceProvider, jobsTable.sourceType)
      .orderBy(desc(count())),
    runJobSearchPipeline({
      tenantId,
      nq: normalizeQuery(searchQuery),
      locationVariants: [],
      sectorFilter: null,
      familyFilters: [],
      sourceFilter: null,
    }),
    db
      .select({ sourceProvider: jobsTable.sourceProvider, value: count() })
      .from(jobsTable)
      .where(
        and(
          activeCanonicalMatch,
          inArray(jobsTable.sourceProvider, ["reed_api", "adzuna_api"]),
        ),
      )
      .groupBy(jobsTable.sourceProvider),
    // Sector/family are computed at query time (taxonomy is config-only, not
    // persisted) — classify the active+canonical set in memory, same
    // classifier the job cards use.
    db
      .select({
        title: jobsTable.title,
        companyName: jobsTable.companyName,
        industry: jobsTable.industry,
        descriptionText: jobsTable.descriptionText,
        skills: jobsTable.skills,
      })
      .from(jobsTable)
      .where(activeCanonicalAll),
  ]);

  let insuranceCount = 0;
  let underwritingFamilyCount = 0;
  for (const row of classifyRows) {
    const c = classifyJobForDisplay(row);
    if (c?.sector === "insurance") {
      insuranceCount += 1;
      if (c.families.includes("underwriting")) underwritingFamilyCount += 1;
    }
  }

  const payload = {
    total_underwriting: total?.value ?? 0,
    active_canonical_underwriting: activeCanonical?.value ?? 0,
    by_source: bySource.map((row) => ({
      source_provider: row.sourceProvider,
      source_type: row.sourceType,
      count: row.value,
    })),
    search: {
      query: searchQuery,
      db_title_match_count: activeCanonical?.value ?? 0,
      search_results_count: searchResults.length,
    },
    sector: {
      total_insurance_jobs: insuranceCount,
    },
    family: {
      total_underwriting_family_jobs: underwritingFamilyCount,
    },
    boards_underwriting: {
      reed: boardRows.find((r) => r.sourceProvider === "reed_api")?.value ?? 0,
      adzuna: boardRows.find((r) => r.sourceProvider === "adzuna_api")?.value ?? 0,
    },
  };

  req.log.info(
    { event: "debug_underwriting_count", ...payload },
    "underwriting diagnostics computed",
  );

  res.json(payload);
});

/** Loose company-name normalization for zero-job employer matching. */
function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\((.*?)\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(limited|ltd|llp|plc|group|holdings|company|companies|co|uk|international)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function companiesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Careers-directory coverage: how many jobs of the directory's industry the
 * tenant has, how the directory segments contribute, and which directory
 * employers currently yield zero jobs (empty boards / broken careers links).
 * Zero-job entries carry the platform hint plus any cached careers→board
 * resolution outcome to separate "board resolved but empty" from "no board
 * found". Tenant-scoped, read-only, admin+ only (/internal guard).
 */
async function computeDirectoryCoverage(
  tenantId: string,
  directory: CareersDirectoryConfig,
): Promise<Record<string, unknown>> {
  const activeCanonical = and(
    eq(jobsTable.tenantId, tenantId),
    eq(jobsTable.status, "active"),
    eq(jobsTable.isCanonical, true),
  );
  const providers = directoryProviderKeys(directory);

  const [classifyRows, segmentRows, directoryCompanies] = await Promise.all([
    // Sector is computed at query time (taxonomy is config-only) — classify
    // the active+canonical set in memory with the same classifier job cards use.
    db
      .select({
        title: jobsTable.title,
        companyName: jobsTable.companyName,
        industry: jobsTable.industry,
        descriptionText: jobsTable.descriptionText,
        skills: jobsTable.skills,
        sourceProvider: jobsTable.sourceProvider,
        sourceType: jobsTable.sourceType,
        sectorTag: jobsTable.sectorTag,
      })
      .from(jobsTable)
      .where(activeCanonical),
    db
      .select({
        sourceProvider: jobsTable.sourceProvider,
        sourceType: jobsTable.sourceType,
        value: count(),
      })
      .from(jobsTable)
      .where(and(activeCanonical, inArray(jobsTable.sourceProvider, providers)))
      .groupBy(jobsTable.sourceProvider, jobsTable.sourceType)
      .orderBy(desc(count())),
    db
      .select({ companyName: jobsTable.companyName, value: count() })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.tenantId, tenantId),
          eq(jobsTable.status, "active"),
          inArray(jobsTable.sourceProvider, providers),
        ),
      )
      .groupBy(jobsTable.companyName),
  ]);

  let totalIndustry = 0;
  const industryBySource = new Map<string, number>();
  for (const row of classifyRows) {
    const c = classifyJobForDisplay(row);
    const inIndustry = c?.sector === directory.industry || row.sectorTag === directory.industry;
    if (!inIndustry) continue;
    totalIndustry += 1;
    const key = row.sourceProvider ?? "legacy_manual";
    industryBySource.set(key, (industryBySource.get(key) ?? 0) + 1);
  }

  const segments: Record<string, number> = {};
  for (const segment of directory.segments) segments[`${segment}_jobs`] = 0;
  for (const row of segmentRows) {
    const segment = directory.segments.find(
      (s) => directoryProviderKey(directory, s) === row.sourceProvider,
    );
    if (segment) segments[`${segment}_jobs`] = row.value;
  }

  // Employers with zero active jobs: compare directory names against the
  // company names actually stored on this directory's jobs (loose match —
  // extracted names often differ from legal directory names).
  const normalizedJobCompanies = directoryCompanies
    .map((r) => normalizeCompany(r.companyName ?? ""))
    .filter((n) => n.length > 0);
  const zeroJobEmployers = directory.employers
    .filter((e) => {
      const n = normalizeCompany(e.name);
      return !normalizedJobCompanies.some((jc) => companiesMatch(n, jc));
    })
    .map((e) => {
      const resolution = cachedResolution(e.careersUrl);
      const crawl = ingestionPathRecord(e.careersUrl);
      return {
        name: e.name,
        segment: e.segment,
        careersUrl: e.careersUrl,
        platformHint: e.platformHint,
        resolution: resolution
          ? {
              outcome: resolution.outcome,
              platform: resolution.entry?.platform ?? null,
              boardUrl: resolution.boardUrl,
              unsupportedAts: resolution.unsupportedAts,
              checkedAt: resolution.checkedAt.toISOString(),
            }
          : null,
        last_ingestion: crawl
          ? {
              path: crawl.path,
              outcome: crawl.outcome,
              jobs: crawl.jobs,
              detail: crawl.detail,
              checkedAt: crawl.checkedAt.toISOString(),
            }
          : null,
      };
    });

  // Ingestion-path summary: how each configured employer was last handled.
  // "not_yet_attempted" = no record in this process (registry is advisory /
  // per-process, like the board-resolution cache).
  const byPath: Record<string, number> = {
    ats: 0,
    basic_html: 0,
    firecrawl: 0,
    not_yet_attempted: 0,
  };
  const byOutcome: Record<string, number> = {};
  for (const e of directory.employers) {
    const rec = ingestionPathRecord(e.careersUrl);
    if (!rec) {
      byPath["not_yet_attempted"] = (byPath["not_yet_attempted"] ?? 0) + 1;
      continue;
    }
    const pathKey = rec.path ?? "none";
    byPath[pathKey] = (byPath[pathKey] ?? 0) + 1;
    byOutcome[rec.outcome] = (byOutcome[rec.outcome] ?? 0) + 1;
  }
  const unavailable = firecrawlUnavailability();

  return {
    directory: directory.key,
    industry: directory.industry,
    [`total_${directory.industry}_jobs`]: totalIndustry,
    ingestion_paths: {
      by_path: byPath,
      by_outcome: byOutcome,
      firecrawl_available: unavailable === null,
      firecrawl_unavailable_reason: unavailable
        ? { reason: unavailable.reason, message: unavailable.message }
        : null,
    },
    segments,
    by_source: [...industryBySource.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([provider, value]) => ({ source_provider: provider, count: value })),
    directory_config: {
      configured_employers: directory.employers.length,
      employers_with_jobs: directory.employers.length - zeroJobEmployers.length,
      unresolved_in_directory: directory.unresolved.map((u) => ({
        name: u.name,
        segment: u.segment,
        reason: u.reason,
      })),
    },
    employers_with_zero_jobs: zeroJobEmployers,
  };
}

router.get("/internal/debug/careers-directory-coverage", async (req, res) => {
  const key = typeof req.query.directory === "string" ? req.query.directory : "";
  const directory = directoryByKey(key);
  if (!directory) {
    res.status(400).json({
      message: `Provide ?directory= one of: ${CAREERS_DIRECTORY_KEYS.join(", ")}`,
    });
    return;
  }
  const payload = await computeDirectoryCoverage(tenantOf(req), directory);
  req.log.info(
    {
      event: "debug_careers_directory_coverage",
      directory: directory.key,
      zero_job_employers: (payload.employers_with_zero_jobs as unknown[]).length,
    },
    "Careers-directory coverage diagnostics computed",
  );
  res.json(payload);
});

/**
 * Sector scorecards: one row per directory industry with coverage quality,
 * ingestion-path mix, gaps, and a rule-based "what to do next" summary.
 * Insurance additionally carries per-segment detail. Signals come from the
 * process-local board-resolution cache + ingestion-path registry (advisory:
 * cold processes under-report detection, never over-report). Tenant-scoped,
 * read-only, admin+ only (/internal guard).
 */
router.get("/internal/debug/sector-scorecards", async (req, res) => {
  const tenantId = tenantOf(req);
  const activeCanonical = and(
    eq(jobsTable.tenantId, tenantId),
    eq(jobsTable.status, "active"),
    eq(jobsTable.isCanonical, true),
  );
  const allProviders = CAREERS_DIRECTORIES.flatMap((d) => directoryProviderKeys(d));

  const [classifyRows, providerRows, companyRows] = await Promise.all([
    // Sector is computed at query time (taxonomy is config-only) — one
    // classify pass over the active+canonical set covers every industry.
    db
      .select({
        title: jobsTable.title,
        companyName: jobsTable.companyName,
        industry: jobsTable.industry,
        descriptionText: jobsTable.descriptionText,
        skills: jobsTable.skills,
        sourceProvider: jobsTable.sourceProvider,
        sourceType: jobsTable.sourceType,
        sectorTag: jobsTable.sectorTag,
      })
      .from(jobsTable)
      .where(activeCanonical),
    db
      .select({ sourceProvider: jobsTable.sourceProvider, value: count() })
      .from(jobsTable)
      .where(and(activeCanonical, inArray(jobsTable.sourceProvider, allProviders)))
      .groupBy(jobsTable.sourceProvider),
    db
      .select({ companyName: jobsTable.companyName, sourceProvider: jobsTable.sourceProvider })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.tenantId, tenantId),
          eq(jobsTable.status, "active"),
          inArray(jobsTable.sourceProvider, allProviders),
        ),
      )
      .groupBy(jobsTable.companyName, jobsTable.sourceProvider),
  ]);

  // Industry job totals via the display classifier, with sectorTag fallback —
  // same effective-sector rule the coverage endpoint uses.
  const jobsByIndustry = new Map<string, { total: number; directEmployer: number }>();
  for (const row of classifyRows) {
    const c = classifyJobForDisplay(row);
    const sector = row.sectorTag ?? c?.sector ?? null;
    if (!sector) continue;
    const bucket = jobsByIndustry.get(sector) ?? { total: 0, directEmployer: 0 };
    bucket.total += 1;
    if (row.sourceType === "direct_employer") bucket.directEmployer += 1;
    jobsByIndustry.set(sector, bucket);
  }

  const segmentJobs = new Map<string, number>();
  for (const row of providerRows) {
    if (row.sourceProvider) segmentJobs.set(row.sourceProvider, row.value);
  }

  // Company names posting via each directory's providers, for the loose
  // "actively posting" employer match (same normalization as coverage).
  const companiesByDirectory = new Map<string, string[]>();
  for (const directory of CAREERS_DIRECTORIES) {
    const providers = new Set(directoryProviderKeys(directory));
    companiesByDirectory.set(
      directory.key,
      companyRows
        .filter((r) => r.sourceProvider && providers.has(r.sourceProvider))
        .map((r) => normalizeCompany(r.companyName ?? ""))
        .filter((n) => n.length > 0),
    );
  }

  const byIndustry = new Map<string, typeof CAREERS_DIRECTORIES>();
  for (const directory of CAREERS_DIRECTORIES) {
    byIndustry.set(directory.industry, [
      ...(byIndustry.get(directory.industry) ?? []),
      directory,
    ]);
  }

  const industries = [...byIndustry.entries()].map(([industry, directories]) => {
    const jobStats = jobsByIndustry.get(industry) ?? { total: 0, directEmployer: 0 };
    return buildIndustryScorecard({
      industry,
      directories: directories.map((config) => {
        const jobCompanies = companiesByDirectory.get(config.key) ?? [];
        return {
          config,
          signals: collectEmployerSignals(config, (employer) => {
            const n = normalizeCompany(employer.name);
            return jobCompanies.some((jc) => companiesMatch(n, jc));
          }),
        };
      }),
      activeCanonicalJobs: jobStats.total,
      directEmployerJobs: jobStats.directEmployer,
      segmentJobs,
      includeSegments: industry === "insurance",
    });
  });

  const payload = { industries };
  req.log.info(
    {
      event: "debug_sector_scorecards",
      industries: industries.map((i) => ({
        industry: i.industry,
        coverage_status: i.coverage_status,
        best_next_gain: i.best_next_gain,
        active_canonical_jobs: i.active_canonical_jobs,
      })),
    },
    "Sector scorecards computed",
  );
  res.json(payload);
});

/**
 * Legacy London Insurance Market coverage endpoint — kept as a delegate to
 * the generic careers-directory coverage (same shape, plus the original
 * top-level keys expected by earlier tooling).
 */
router.get("/internal/debug/london-insurance-coverage", async (req, res) => {
  const payload = await computeDirectoryCoverage(tenantOf(req), LONDON_INSURANCE_DIRECTORY);
  const compat = {
    ...payload,
    // Original response used `directory` for the config block.
    directory: payload.directory_config,
  };
  req.log.info(
    {
      event: "debug_london_insurance_coverage",
      total_insurance_jobs: payload["total_insurance_jobs"],
      zero_job_employers: (payload.employers_with_zero_jobs as unknown[]).length,
    },
    "London insurance coverage diagnostics computed",
  );
  res.json(compat);
});

export default router;
