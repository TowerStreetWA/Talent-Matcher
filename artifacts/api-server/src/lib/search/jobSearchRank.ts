import type { NormalizedQuery } from "./normalize";
import { scoreJob, type JobLike } from "./rank";
import { classifyVacancy, inferQueryFinIntent } from "./finClassify";
import { lookupCuratedTitle } from "./curatedTitles";
import { FIN_SECTORS, type FinSector, type FinFunction } from "./finTaxonomy";

/**
 * Explicit boost weights for the recruiter-facing /jobs/search ranking,
 * layered on top of the shared scoreJob relevance score. Keep these
 * inspectable — no hidden heuristics.
 */
export const JOB_SEARCH_BOOSTS = {
  /** Job's classified sector matches the requested (or query-inferred) sector. */
  sectorMatch: 25,
  /** Job location matched the location filter. */
  locationMatch: 15,
  /** Sourced directly from the employer's career site. */
  directEmployer: 15,
  /** Posted within the last 14 days. */
  recentPosting: 8,
  /** Posted within the last 30 days (when not within 14). */
  somewhatRecentPosting: 4,
} as const;

export const RECENT_DAYS = 14;
export const SOMEWHAT_RECENT_DAYS = 30;

export interface JobSearchExplanationFlags {
  titleMatch: boolean;
  sectorMatch: boolean;
  locationMatch: boolean;
  directEmployer: boolean;
  recentPosting: boolean;
}

export interface JobSearchScore {
  score: number;
  sector: FinSector | null;
  /** Classified function/family of the job (curated override or term scoring). */
  fn: FinFunction | null;
  /** Tags carried by the job's curated-title entry (empty if not curated). */
  curatedTags: readonly string[];
  explanation: JobSearchExplanationFlags;
}

export interface JobSearchRankable extends JobLike {
  postedAt?: Date | null;
  /**
   * Sector tag stamped by the ingestion pattern/provider (e.g. "insurance").
   * When present and valid it is authoritative for the job's market sector —
   * a "Finance Manager" at an insurance employer belongs to the insurance
   * sector even though its title classifies elsewhere. Title classification
   * remains the fallback for untagged (manual/legacy) rows.
   */
  sectorTag?: string | null;
}

const isFinSector = (value: string | null | undefined): value is FinSector =>
  value != null && (FIN_SECTORS as readonly string[]).includes(value);

const normLoc = (value: string | null | undefined): string =>
  (value ?? "").toLowerCase().replace(/[-_/,]/g, " ").replace(/\s+/g, " ").trim();

/** Whether the job's location text contains any of the expanded location variants. */
export function locationMatches(
  locationText: string | null | undefined,
  locationVariants: string[],
): boolean {
  if (locationVariants.length === 0) return false;
  const loc = normLoc(locationText);
  if (!loc) return false;
  return locationVariants.some((v) => loc.includes(v));
}

/**
 * Compute the /jobs/search relevance score + explanation flags for one job.
 * Base relevance comes from the shared scoreJob layer (title/phrase/token/
 * taxonomy/FS boosts); the explicit JOB_SEARCH_BOOSTS above are added for
 * sector, location, direct-employer, and recency signals.
 */
export function scoreJobSearch(
  nq: NormalizedQuery | null,
  job: JobSearchRankable,
  opts: {
    sectorFilter: FinSector | null;
    locationVariants: string[];
    now?: Date;
  },
): JobSearchScore {
  const tags = classifyVacancy(job);
  const effectiveSector = isFinSector(job.sectorTag) ? job.sectorTag : tags.sector;
  const now = opts.now ?? new Date();

  let base = 0;
  let titleMatch = false;
  if (nq) {
    const finIntent = inferQueryFinIntent(nq);
    const breakdown = scoreJob(nq, job, finIntent);
    base = breakdown.total;
    titleMatch =
      breakdown.exactTitle +
        breakdown.phraseTitle +
        breakdown.variantTitle +
        breakdown.titleTokens >
      0;
  }

  const wantedSector =
    opts.sectorFilter ?? (nq ? inferQueryFinIntent(nq).sector : null);
  const sectorMatch = wantedSector !== null && effectiveSector === wantedSector;
  const locMatch = locationMatches(job.locationText, opts.locationVariants);
  const directEmployer = job.sourceType === "direct_employer";

  const postedMs = job.postedAt?.getTime() ?? null;
  const ageDays =
    postedMs === null ? null : (now.getTime() - postedMs) / (1000 * 60 * 60 * 24);
  const recentPosting = ageDays !== null && ageDays <= RECENT_DAYS;
  const somewhatRecent =
    !recentPosting && ageDays !== null && ageDays <= SOMEWHAT_RECENT_DAYS;

  let score = base;
  if (sectorMatch) score += JOB_SEARCH_BOOSTS.sectorMatch;
  if (locMatch) score += JOB_SEARCH_BOOSTS.locationMatch;
  if (directEmployer) score += JOB_SEARCH_BOOSTS.directEmployer;
  if (recentPosting) score += JOB_SEARCH_BOOSTS.recentPosting;
  else if (somewhatRecent) score += JOB_SEARCH_BOOSTS.somewhatRecentPosting;

  return {
    score,
    sector: effectiveSector,
    fn: tags.fn,
    curatedTags: lookupCuratedTitle(job.title)?.entry.tags ?? [],
    explanation: {
      titleMatch,
      sectorMatch,
      locationMatch: locMatch,
      directEmployer,
      recentPosting,
    },
  };
}
