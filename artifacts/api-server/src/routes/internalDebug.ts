import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { tenantOf } from "../middlewares/auth";
import { normalizeQuery } from "../lib/search/normalize";
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

  const searchQuery = "underwriter";
  const [[total], [activeCanonical], bySource, searchResults] = await Promise.all([
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
  ]);

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
  };

  req.log.info(
    { event: "debug_underwriting_count", ...payload },
    "underwriting diagnostics computed",
  );

  res.json(payload);
});

export default router;
