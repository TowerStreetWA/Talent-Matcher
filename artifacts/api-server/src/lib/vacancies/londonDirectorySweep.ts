import { and, eq, like, sql } from "drizzle-orm";
import { db, jobSourcesTable } from "@workspace/db";
import { logger } from "../logger";
import { runVacancyIngestion } from "./ingestionRunner";
import { IngestionError } from "./types";
import { makeLondonEmployerProvider, selectLondonEmployers } from "./londonDirectory";

/**
 * Scheduled London Insurance Market directory ingestion.
 *
 * The directory holds ~190 employers — far too many to fetch in one run
 * (generic careers pages go through Firecrawl). Instead the sweep ticks
 * hourly and processes the employers whose stable index falls into the
 * current UTC hour's slot (index % 24 === hour), so every employer is
 * refreshed roughly once per day in small bounded batches.
 *
 * Tenancy: the sweep only refreshes tenants that have opted in — i.e.
 * tenants with an active london_insurance_* job source, created the first
 * time an admin runs POST /internal/ingestion/london-insurance-directory.
 * A scheduler must never fan a scrape out to every tenant unconditionally.
 *
 * Coordination: a pg advisory xact lock ensures only one instance sweeps a
 * given tick; re-runs are safe anyway (ingestion is idempotent by sourceUrl).
 */

export const LONDON_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const LONDON_SWEEP_ADVISORY_LOCK_KEY = 743_291_652;
const HOUR_SLOTS = 24;

export interface LondonSweepResult {
  tenants: number;
  employersAttempted: number;
  fetched: number;
  stored: number;
  refreshed: number;
  errors: number;
}

/** Tenants that have run the directory ingestion at least once. */
async function optedInTenants(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ tenantId: jobSourcesTable.tenantId })
    .from(jobSourcesTable)
    .where(
      and(
        like(jobSourcesTable.provider, "london_insurance_%"),
        eq(jobSourcesTable.isActive, true),
      ),
    );
  return rows.map((r) => r.tenantId);
}

/**
 * Run one sweep tick: the current hour's employer slot for every opted-in
 * tenant. Returns null when another instance holds the lock.
 */
export async function sweepLondonDirectory(options?: {
  hour?: number;
}): Promise<LondonSweepResult | null> {
  // The xact-scoped advisory lock is only held while this transaction is
  // open, so the whole sweep body runs inside it. The transaction itself
  // touches no rows (ingestion writes go through `db` on other
  // connections) — it exists purely to pin the lock for the tick.
  return db.transaction(async (tx) => {
    const lockResult = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${LONDON_SWEEP_ADVISORY_LOCK_KEY}) as locked`,
    );
    if (lockResult.rows[0]?.locked !== true) {
      logger.info(
        { event: "london_directory_sweep_skipped" },
        "London directory sweep already running elsewhere — skipping",
      );
      return null;
    }
    return runSweepTick(options?.hour);
  });
}

async function runSweepTick(hourOverride?: number): Promise<LondonSweepResult> {
  const hour = hourOverride ?? new Date().getUTCHours();
  const { employers: all } = selectLondonEmployers({});
  const batch = all.filter((_, idx) => idx % HOUR_SLOTS === hour % HOUR_SLOTS);
  const tenants = await optedInTenants();

  const result: LondonSweepResult = {
    tenants: tenants.length,
    employersAttempted: 0,
    fetched: 0,
    stored: 0,
    refreshed: 0,
    errors: 0,
  };
  if (tenants.length === 0 || batch.length === 0) return result;

  for (const tenantId of tenants) {
    for (const employer of batch) {
      result.employersAttempted += 1;
      try {
        const summary = await runVacancyIngestion({
          tenantId,
          provider: makeLondonEmployerProvider(employer),
          input: {},
        });
        result.fetched += summary.fetched;
        result.stored += summary.insertedCanonical + summary.insertedDuplicates;
        result.refreshed += summary.refreshedExisting;
      } catch (err) {
        result.errors += 1;
        logger.warn(
          {
            event: "london_directory_sweep_employer_failed",
            tenantId,
            employer: employer.name,
            err: err instanceof Error ? err.message : String(err),
          },
          "London directory sweep: employer ingestion failed",
        );
        // Config failures (e.g. missing Firecrawl key) will fail every
        // generic-careers employer — abort the tick, ATS boards still ran.
        if (err instanceof IngestionError && err.kind === "config") break;
      }
    }
  }

  logger.info(
    { event: "london_directory_sweep", hour, batchSize: batch.length, ...result },
    "London directory sweep tick completed",
  );
  return result;
}

let sweepTimer: NodeJS.Timeout | null = null;
let sweeping = false;

/** Starts the hourly London directory sweep (idempotent). */
export function startLondonDirectorySweep(): void {
  if (sweepTimer) return;
  const run = async (): Promise<void> => {
    if (sweeping) return;
    sweeping = true;
    try {
      await sweepLondonDirectory();
    } catch (err) {
      logger.error({ err }, "London directory sweep failed");
    } finally {
      sweeping = false;
    }
  };
  sweepTimer = setInterval(() => void run(), LONDON_SWEEP_INTERVAL_MS);
  sweepTimer.unref();
  // First pass shortly after boot (only affects opted-in tenants).
  setTimeout(() => void run(), 5 * 60_000).unref();
}
