import { and, eq, like, sql } from "drizzle-orm";
import { db, jobSourcesTable } from "@workspace/db";
import { logger } from "../logger";
import { runVacancyIngestion } from "../vacancies/ingestionRunner";
import { IngestionError } from "../vacancies/types";
import { CAREERS_DIRECTORIES } from "../../config/careersDirectories";
import {
  makeDirectoryEmployerProvider,
  selectDirectoryEmployers,
  type CareersDirectoryConfig,
} from "./engine";

/**
 * Scheduled careers-directory ingestion (all registered directories).
 *
 * Directories hold too many employers to fetch in one run (generic careers
 * pages go through Firecrawl). The sweep ticks hourly and, per directory,
 * processes the employers whose stable index falls into the current UTC
 * hour's slot (index % slots === hour % slots), so every employer is
 * refreshed roughly once per `slots` hours in small bounded batches.
 *
 * Tenancy: a directory sweeps only tenants that have opted in — i.e.
 * tenants with an active `<providerPrefix>_%` job source, created the first
 * time an admin runs the directory's ingestion endpoint. A scheduler must
 * never fan a scrape out to every tenant unconditionally.
 *
 * Coordination: a pg advisory xact lock (held for the whole tick — the
 * transaction exists purely to pin the lock; ingestion writes go through
 * `db` on other connections) ensures only one instance sweeps a given tick;
 * re-runs are safe anyway (ingestion is idempotent by sourceUrl).
 */

export const DIRECTORY_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Same key the London-only sweep used — one sweeper across all directories. */
const DIRECTORY_SWEEP_ADVISORY_LOCK_KEY = 743_291_652;

export interface DirectorySweepResult {
  directories: Array<{
    directory: string;
    tenants: number;
    employersAttempted: number;
    fetched: number;
    stored: number;
    refreshed: number;
    errors: number;
  }>;
}

/** Tenants that have run this directory's ingestion at least once. */
async function optedInTenants(directory: CareersDirectoryConfig): Promise<string[]> {
  const rows = await db
    .selectDistinct({ tenantId: jobSourcesTable.tenantId })
    .from(jobSourcesTable)
    .where(
      and(
        like(jobSourcesTable.provider, `${directory.providerPrefix}\\_%`),
        eq(jobSourcesTable.isActive, true),
      ),
    );
  return rows.map((r) => r.tenantId);
}

/**
 * Run one sweep tick across all enabled directories. Returns null when
 * another instance holds the lock.
 */
export async function sweepCareersDirectories(options?: {
  hour?: number;
}): Promise<DirectorySweepResult | null> {
  return db.transaction(async (tx) => {
    const lockResult = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${DIRECTORY_SWEEP_ADVISORY_LOCK_KEY}) as locked`,
    );
    if (lockResult.rows[0]?.locked !== true) {
      logger.info(
        { event: "careers_directory_sweep_skipped" },
        "Careers-directory sweep already running elsewhere — skipping",
      );
      return null;
    }
    return runSweepTick(options?.hour);
  });
}

async function runSweepTick(hourOverride?: number): Promise<DirectorySweepResult> {
  const hour = hourOverride ?? new Date().getUTCHours();
  const result: DirectorySweepResult = { directories: [] };

  for (const directory of CAREERS_DIRECTORIES) {
    if (!directory.sweep.enabled) continue;
    const tick = await sweepOneDirectory(directory, hour);
    result.directories.push({ directory: directory.key, ...tick });
  }

  logger.info(
    { event: "careers_directory_sweep", hour, ...summarize(result) },
    "Careers-directory sweep tick completed",
  );
  return result;
}

function summarize(result: DirectorySweepResult): Record<string, number> {
  return result.directories.reduce(
    (acc, d) => {
      acc.employersAttempted += d.employersAttempted;
      acc.fetched += d.fetched;
      acc.stored += d.stored;
      acc.errors += d.errors;
      return acc;
    },
    { employersAttempted: 0, fetched: 0, stored: 0, errors: 0 },
  );
}

async function sweepOneDirectory(
  directory: CareersDirectoryConfig,
  hour: number,
): Promise<Omit<DirectorySweepResult["directories"][number], "directory">> {
  const slots = Math.max(1, directory.sweep.slots);
  const { employers: all } = selectDirectoryEmployers(directory, {});
  const batch = all.filter((_, idx) => idx % slots === hour % slots);

  const tick = {
    tenants: 0,
    employersAttempted: 0,
    fetched: 0,
    stored: 0,
    refreshed: 0,
    errors: 0,
  };
  if (batch.length === 0) return tick;

  const tenants = await optedInTenants(directory);
  tick.tenants = tenants.length;
  if (tenants.length === 0) return tick;

  for (const tenantId of tenants) {
    for (const employer of batch) {
      tick.employersAttempted += 1;
      try {
        const summary = await runVacancyIngestion({
          tenantId,
          provider: makeDirectoryEmployerProvider(directory, employer),
          input: {},
        });
        tick.fetched += summary.fetched;
        tick.stored += summary.insertedCanonical + summary.insertedDuplicates;
        tick.refreshed += summary.refreshedExisting;
      } catch (err) {
        tick.errors += 1;
        logger.warn(
          {
            event: "careers_directory_sweep_employer_failed",
            directory: directory.key,
            tenantId,
            employer: employer.name,
            err: err instanceof Error ? err.message : String(err),
          },
          "Careers-directory sweep: employer ingestion failed",
        );
        // Config failures (e.g. missing Firecrawl key) will fail every
        // generic-careers employer — abort this directory's tick.
        if (err instanceof IngestionError && err.kind === "config") return tick;
      }
    }
  }
  return tick;
}

let sweepTimer: NodeJS.Timeout | null = null;
let sweeping = false;

/** Starts the hourly careers-directory sweep (idempotent). */
export function startCareersDirectorySweep(): void {
  if (sweepTimer) return;
  const run = async (): Promise<void> => {
    if (sweeping) return;
    sweeping = true;
    try {
      await sweepCareersDirectories();
    } catch (err) {
      logger.error({ err }, "Careers-directory sweep failed");
    } finally {
      sweeping = false;
    }
  };
  sweepTimer = setInterval(() => void run(), DIRECTORY_SWEEP_INTERVAL_MS);
  sweepTimer.unref();
  // First pass shortly after boot (only affects opted-in tenants).
  setTimeout(() => void run(), 5 * 60_000).unref();
}
