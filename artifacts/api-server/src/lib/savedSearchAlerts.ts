import { and, desc, eq, gt, ilike, lte, or, sql } from "drizzle-orm";
import {
  db,
  jobsTable,
  savedJobSearchesTable,
  savedSearchAlertEventsTable,
  type SavedJobSearch,
} from "@workspace/db";
import { logger } from "./logger";
import { normalizeQuery } from "./search/normalize";
import { expandLocationInput } from "./search/jobSearchFilters";
import { scoreJobSearch } from "./search/jobSearchRank";
import { resolveSectorInput } from "./search/jobSearchFilters";
import {
  resolveDisplayFamilies,
  matchesDisplayFamily,
  type DisplayFamily,
} from "../config/curatedTitles/displayFamilies";

/** Max job ids stored per alert event (keeps rows small). */
const MAX_JOB_IDS = 25;
/** How often the sweep runs. */
export const ALERT_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
/**
 * Postgres advisory-lock key so only one instance sweeps at a time when the
 * server runs on multiple autoscale instances (xact-scoped: auto-released).
 */
const SWEEP_ADVISORY_LOCK_KEY = 743_291_650;

/**
 * Re-runs one saved search restricted to jobs that appeared in the window
 * `(since, until]` (postedAt, falling back to createdAt for rows without a
 * posted date). The closed upper bound keeps consecutive sweeps disjoint.
 */
async function findNewJobsFor(
  saved: SavedJobSearch,
  since: Date,
  until: Date,
): Promise<string[]> {
  const nq = saved.query.trim() ? normalizeQuery(saved.query) : null;
  const locationVariants = saved.location
    ? expandLocationInput(saved.location)
    : [];
  const sectorFilter = saved.sector ? resolveSectorInput(saved.sector) : null;
  // Family keys are validated at save time; unknown keys (e.g. after a
  // taxonomy rename) are silently dropped rather than failing the sweep.
  const familyFilters: DisplayFamily[] = (saved.families ?? []).flatMap((key) =>
    resolveDisplayFamilies(key, sectorFilter),
  );

  const conditions = [
    eq(jobsTable.tenantId, saved.tenantId),
    eq(jobsTable.status, "active"),
    eq(jobsTable.isCanonical, true),
    gt(sql`coalesce(${jobsTable.postedAt}, ${jobsTable.createdAt})`, since),
    lte(sql`coalesce(${jobsTable.postedAt}, ${jobsTable.createdAt})`, until),
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
    const locCond = or(
      ...locationVariants.map((v) => ilike(jobsTable.locationText, `%${v}%`)),
    );
    if (locCond) conditions.push(locCond);
  }
  if (saved.sourceType)
    conditions.push(eq(jobsTable.sourceType, saved.sourceType));

  const rows = await db
    .select()
    .from(jobsTable)
    .where(and(...conditions))
    .orderBy(desc(jobsTable.postedAt))
    .limit(100);

  return rows
    .map((job) => ({
      job,
      s: scoreJobSearch(nq, job, { sectorFilter, locationVariants }),
    }))
    .filter(({ s }) => (sectorFilter ? s.sector === sectorFilter : true))
    .filter(({ s }) =>
      familyFilters.length === 0
        ? true
        : familyFilters.some((df) => matchesDisplayFamily(df, s.fn, s.curatedTags)),
    )
    .slice(0, MAX_JOB_IDS)
    .map(({ job }) => job.id);
}

/**
 * Alert sweep: for every saved search with alerts enabled, detect jobs that
 * appeared since the last run and record a data-level alert event. No email
 * or in-app delivery yet — events are the durable record for later wiring.
 */
export async function sweepSavedSearchAlerts(): Promise<void> {
  // Take a transaction-scoped advisory lock so overlapping sweeps (slow run,
  // multiple autoscale instances) never process the same window twice. The
  // lock is released automatically when the transaction ends.
  await db.transaction(async (tx) => {
    const lockResult = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${SWEEP_ADVISORY_LOCK_KEY}) as locked`,
    );
    if (!lockResult.rows[0]?.locked) {
      logger.info(
        { event: "saved_search_alert_sweep_skipped" },
        "saved-search alert sweep already running elsewhere — skipping",
      );
      return;
    }

    const saved = await tx
      .select()
      .from(savedJobSearchesTable)
      .where(eq(savedJobSearchesTable.alertEnabled, true));

    for (const s of saved) {
      // Deterministic window: (since, windowEnd]. Jobs appearing after
      // windowEnd are deliberately left for the next sweep, so events are
      // never duplicated and never dropped.
      const windowEnd = new Date();
      try {
        const since = s.lastRunAt ?? s.createdAt;
        const jobIds = await findNewJobsFor(s, since, windowEnd);
        if (jobIds.length > 0) {
          await tx.insert(savedSearchAlertEventsTable).values({
            tenantId: s.tenantId,
            savedSearchId: s.id,
            userId: s.userId,
            jobCount: jobIds.length,
            jobIds,
          });
          logger.info(
            {
              event: "saved_search_alert",
              savedSearchId: s.id,
              tenantId: s.tenantId,
              name: s.name.slice(0, 80),
              newJobCount: jobIds.length,
            },
            "saved search matched new jobs",
          );
        }
        await tx
          .update(savedJobSearchesTable)
          .set({ lastRunAt: windowEnd })
          .where(eq(savedJobSearchesTable.id, s.id));
      } catch (err) {
        logger.error(
          { err, savedSearchId: s.id },
          "saved-search alert sweep failed for one search",
        );
      }
    }
  });
}

let sweepTimer: NodeJS.Timeout | null = null;
let sweeping = false;

/** Starts the periodic alert sweep (idempotent). */
export function startSavedSearchAlertSweep(): void {
  if (sweepTimer) return;
  const run = async (): Promise<void> => {
    if (sweeping) return;
    sweeping = true;
    try {
      await sweepSavedSearchAlerts();
    } catch (err) {
      logger.error({ err }, "saved-search alert sweep failed");
    } finally {
      sweeping = false;
    }
  };
  sweepTimer = setInterval(() => void run(), ALERT_SWEEP_INTERVAL_MS);
  sweepTimer.unref();
  // First pass shortly after boot so newly enabled alerts get a baseline run.
  setTimeout(() => void run(), 30_000).unref();
}
