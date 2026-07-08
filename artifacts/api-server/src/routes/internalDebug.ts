import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { tenantOf } from "../middlewares/auth";
import { normalizeQuery } from "../lib/search/normalize";
import { classifyJobForDisplay } from "../lib/search/classification";
import { runJobSearchPipeline } from "./jobs";
import {
  LONDON_INSURANCE_EMPLOYERS,
  LONDON_DIRECTORY_UNRESOLVED,
} from "../config/londonInsuranceEmployers";
import { LONDON_SEGMENTS, londonProviderKey } from "../lib/vacancies/londonDirectory";

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
 * London Insurance Market directory coverage: how many insurance jobs the
 * tenant has, how the directory segments contribute, and which directory
 * employers currently yield zero jobs (empty boards / broken careers links).
 * Tenant-scoped, read-only, admin+ only (mounted under the /internal guard).
 */
router.get("/internal/debug/london-insurance-coverage", async (req, res) => {
  const tenantId = tenantOf(req);
  const activeCanonical = and(
    eq(jobsTable.tenantId, tenantId),
    eq(jobsTable.status, "active"),
    eq(jobsTable.isCanonical, true),
  );
  const londonProviders = LONDON_SEGMENTS.map(londonProviderKey);

  const [classifyRows, segmentRows, londonCompanies] = await Promise.all([
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
      .where(and(activeCanonical, inArray(jobsTable.sourceProvider, londonProviders)))
      .groupBy(jobsTable.sourceProvider, jobsTable.sourceType)
      .orderBy(desc(count())),
    db
      .select({ companyName: jobsTable.companyName, value: count() })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.tenantId, tenantId),
          eq(jobsTable.status, "active"),
          inArray(jobsTable.sourceProvider, londonProviders),
        ),
      )
      .groupBy(jobsTable.companyName),
  ]);

  let totalInsurance = 0;
  const insuranceBySource = new Map<string, number>();
  for (const row of classifyRows) {
    const c = classifyJobForDisplay(row);
    const isInsurance = c?.sector === "insurance" || row.sectorTag === "insurance";
    if (!isInsurance) continue;
    totalInsurance += 1;
    const key = row.sourceProvider ?? "legacy_manual";
    insuranceBySource.set(key, (insuranceBySource.get(key) ?? 0) + 1);
  }

  const segments: Record<string, number> = {};
  for (const segment of LONDON_SEGMENTS) segments[`${segment}_jobs`] = 0;
  for (const row of segmentRows) {
    const segment = LONDON_SEGMENTS.find((s) => londonProviderKey(s) === row.sourceProvider);
    if (segment) segments[`${segment}_jobs`] = row.value;
  }

  // Employers with zero active jobs: compare directory names against the
  // company names actually stored on london_insurance_* jobs (loose match —
  // extracted names often differ from legal directory names).
  const normalizedJobCompanies = londonCompanies
    .map((r) => normalizeCompany(r.companyName ?? ""))
    .filter((n) => n.length > 0);
  const zeroJobEmployers = LONDON_INSURANCE_EMPLOYERS.filter((e) => {
    const n = normalizeCompany(e.name);
    return !normalizedJobCompanies.some((jc) => companiesMatch(n, jc));
  }).map((e) => ({ name: e.name, segment: e.segment, careersUrl: e.careersUrl }));

  const payload = {
    total_insurance_jobs: totalInsurance,
    segments,
    by_source: [...insuranceBySource.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([provider, value]) => ({ source_provider: provider, count: value })),
    directory: {
      configured_employers: LONDON_INSURANCE_EMPLOYERS.length,
      employers_with_jobs: LONDON_INSURANCE_EMPLOYERS.length - zeroJobEmployers.length,
      unresolved_in_directory: LONDON_DIRECTORY_UNRESOLVED.map((u) => ({
        name: u.name,
        segment: u.segment,
        reason: u.reason,
      })),
    },
    employers_with_zero_jobs: zeroJobEmployers,
  };

  req.log.info(
    {
      event: "debug_london_insurance_coverage",
      total_insurance_jobs: payload.total_insurance_jobs,
      segments: payload.segments,
      zero_job_employers: zeroJobEmployers.length,
    },
    "London insurance coverage diagnostics computed",
  );

  res.json(payload);
});

export default router;
