import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { logger } from "../logger";
import { resolveStaleAfterDays } from "../../config/ingestionFreshness";

/** How often the periodic expiry sweep runs. */
export const EXPIRY_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Postgres advisory-lock key so only one instance sweeps at a time when the
 * server runs on multiple autoscale instances (xact-scoped: auto-released).
 */
const EXPIRY_ADVISORY_LOCK_KEY = 743_291_651;

export interface ExpirySweepResult {
  expired: number;
  /** Jobs expired per sourceProvider. */
  bySource: Record<string, number>;
}

/**
 * Marks stale ingestion-backed jobs as "expired".
 *
 * A job is stale when it has not been re-discovered (lastSeenAt, falling back
 * to discoveredAt/createdAt) within its configured threshold (see
 * config/ingestionFreshness.ts — per provider, then per sourceType).
 *
 * Only jobs with a sourceProvider are ever touched: manual and seeded demo
 * jobs have no re-discovery loop, so expiring them would be wrong.
 *
 * Pass `tenantId` to restrict the sweep to a single tenant (used by the
 * tenant-facing manual trigger); the periodic scheduler sweep runs globally.
 *
 * Returns null when another instance holds the sweep lock.
 */
export async function sweepStaleJobs(options?: {
  tenantId?: string;
}): Promise<ExpirySweepResult | null> {
  const tenantId = options?.tenantId;
  return db.transaction(async (tx) => {
    const lockResult = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${EXPIRY_ADVISORY_LOCK_KEY}) as locked`,
    );
    if (!lockResult.rows[0]?.locked) {
      logger.info(
        { event: "vacancy_expiry_sweep_skipped" },
        "vacancy expiry sweep already running elsewhere — skipping",
      );
      return null;
    }

    // Thresholds resolve per provider/sourceType, so sweep group by group.
    const groups = await tx
      .selectDistinct({
        sourceProvider: jobsTable.sourceProvider,
        sourceType: jobsTable.sourceType,
      })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.status, "active"),
          isNotNull(jobsTable.sourceProvider),
          ...(tenantId ? [eq(jobsTable.tenantId, tenantId)] : []),
        ),
      );

    const result: ExpirySweepResult = { expired: 0, bySource: {} };

    for (const group of groups) {
      if (group.sourceProvider == null) continue;
      const days = resolveStaleAfterDays(group);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const expiredRows = await tx
        .update(jobsTable)
        .set({ status: "expired" })
        .where(
          and(
            eq(jobsTable.status, "active"),
            eq(jobsTable.sourceProvider, group.sourceProvider),
            ...(tenantId ? [eq(jobsTable.tenantId, tenantId)] : []),
            sql`${jobsTable.sourceType} is not distinct from ${group.sourceType}`,
            lt(
              sql`coalesce(${jobsTable.lastSeenAt}, ${jobsTable.discoveredAt}, ${jobsTable.createdAt})`,
              cutoff,
            ),
          ),
        )
        .returning({ id: jobsTable.id });
      if (expiredRows.length > 0) {
        result.expired += expiredRows.length;
        result.bySource[group.sourceProvider] =
          (result.bySource[group.sourceProvider] ?? 0) + expiredRows.length;
      }
    }

    logger.info(
      {
        event: "vacancy_expiry_sweep",
        tenantId: tenantId ?? "all",
        expired: result.expired,
        bySource: result.bySource,
        groupCount: groups.length,
      },
      "vacancy expiry sweep completed",
    );

    return result;
  });
}

let sweepTimer: NodeJS.Timeout | null = null;
let sweeping = false;

/** Starts the periodic stale-job expiry sweep (idempotent). */
export function startExpirySweep(): void {
  if (sweepTimer) return;
  const run = async (): Promise<void> => {
    if (sweeping) return;
    sweeping = true;
    try {
      await sweepStaleJobs();
    } catch (err) {
      logger.error({ err }, "vacancy expiry sweep failed");
    } finally {
      sweeping = false;
    }
  };
  sweepTimer = setInterval(() => void run(), EXPIRY_SWEEP_INTERVAL_MS);
  sweepTimer.unref();
  // First pass shortly after boot so stale jobs are cleaned up promptly.
  setTimeout(() => void run(), 60_000).unref();
}
