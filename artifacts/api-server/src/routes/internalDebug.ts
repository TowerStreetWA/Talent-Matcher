import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { tenantOf } from "../middlewares/auth";
import { normalizeQuery } from "../lib/search/normalize";
import { classifyJobForDisplay } from "../lib/search/classification";
import { runJobSearchPipeline } from "./jobs";

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

export default router;
