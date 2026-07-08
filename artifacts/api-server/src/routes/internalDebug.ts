import { Router, type IRouter } from "express";
import { and, count, eq, ilike } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { tenantOf } from "../middlewares/auth";

/**
 * Internal-only, read-only diagnostics. Deliberately NOT part of the public
 * OpenAPI contract — operator/dev endpoints mounted admin+ only (see
 * routes/index.ts `/internal` guard). No recruiter-facing UI calls these.
 */
const router: IRouter = Router();

/**
 * Count vacancies whose title matches "underwrit" (case-insensitive substring),
 * to debug discrepancies between stored data and UI search results.
 * Tenant-scoped; no mutations.
 */
router.get("/internal/debug/underwriting-count", async (req, res) => {
  const tenantId = tenantOf(req);
  const titleMatch = ilike(jobsTable.title, "%underwrit%");

  const [[total], [activeCanonical]] = await Promise.all([
    db
      .select({ value: count() })
      .from(jobsTable)
      .where(and(eq(jobsTable.tenantId, tenantId), titleMatch)),
    db
      .select({ value: count() })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.tenantId, tenantId),
          titleMatch,
          eq(jobsTable.status, "active"),
          eq(jobsTable.isCanonical, true),
        ),
      ),
  ]);

  res.json({
    total_underwriting: total?.value ?? 0,
    active_canonical_underwriting: activeCanonical?.value ?? 0,
  });
});

export default router;
