/**
 * Sector scorecards: per-industry coverage quality derived from the careers
 * directories, the (process-local) board-resolution cache + ingestion-path
 * registry, and active job counts supplied by the caller. All rules are
 * deterministic and threshold-based — no ML, no persistence.
 *
 * The DB-independent parts (employer signal aggregation, coverage status and
 * best-next-gain rules) are pure functions so they can be unit-tested with
 * synthetic inputs; the route in routes/internalDebug.ts wires in real job
 * counts and company matching.
 */

import type { CareersDirectoryConfig, CareersDirectoryEmployer } from "./engine";
import { cachedResolution, type BoardResolution } from "./resolveCareersBoard";
import { ingestionPathRecord, type IngestionPathRecord } from "./ingestionPathRegistry";

/** Per-employer signals collected from config + caches (all optional-cold). */
export interface EmployerSignals {
  employer: CareersDirectoryEmployer;
  resolution: BoardResolution | null;
  ingestion: IngestionPathRecord | null;
  /** Loose company-name match against active jobs from this directory. */
  hasActiveJobs: boolean;
}

/** Aggregated employer counters (industry- or segment-level). */
export interface EmployerCounters {
  seeded_employers: number;
  careers_page_detected: number;
  actively_posting_employers: number;
  ats_resolved_employers: number;
  basic_html_employers: number;
  firecrawl_employers: number;
  needs_firecrawl_employers: number;
  unsupported_ats_employers: number;
  zero_job_employers: number;
}

export interface SegmentScorecard extends EmployerCounters {
  segment: string;
  active_jobs: number;
}

export interface IndustryScorecard extends EmployerCounters {
  industry: string;
  directories: string[];
  active_canonical_jobs: number;
  direct_employer_jobs: number;
  coverage_status: CoverageStatus;
  best_next_gain: BestNextGain;
  segments: SegmentScorecard[] | null;
}

export type CoverageStatus = "healthy" | "developing" | "thin";

export type BestNextGain =
  | "add more ATS employers"
  | "support remaining ATS providers"
  | "top up Firecrawl for JS-heavy sites"
  | "expand seed list";

/** Outcomes that prove the careers page itself was reachable. */
const UNREACHABLE_OUTCOMES = new Set(["fetch_failed", "blocked_url"]);

/**
 * Collect per-employer signals for a directory. Resolution/ingestion lookups
 * are injectable for tests; defaults read the real process-local caches.
 */
export function collectEmployerSignals(
  directory: CareersDirectoryConfig,
  hasActiveJobs: (employer: CareersDirectoryEmployer) => boolean,
  lookups: {
    resolution?: (careersUrl: string) => BoardResolution | null;
    ingestion?: (careersUrl: string) => IngestionPathRecord | null;
  } = {},
): EmployerSignals[] {
  const resolutionOf = lookups.resolution ?? cachedResolution;
  const ingestionOf = lookups.ingestion ?? ingestionPathRecord;
  return directory.employers.map((employer) => ({
    employer,
    resolution: resolutionOf(employer.careersUrl),
    ingestion: ingestionOf(employer.careersUrl),
    hasActiveJobs: hasActiveJobs(employer),
  }));
}

/** Aggregate a set of employer signals into the scorecard counters. */
export function countEmployerSignals(signals: EmployerSignals[]): EmployerCounters {
  const counters: EmployerCounters = {
    seeded_employers: signals.length,
    careers_page_detected: 0,
    actively_posting_employers: 0,
    ats_resolved_employers: 0,
    basic_html_employers: 0,
    firecrawl_employers: 0,
    needs_firecrawl_employers: 0,
    unsupported_ats_employers: 0,
    zero_job_employers: 0,
  };
  for (const s of signals) {
    const { employer, resolution, ingestion } = s;

    // Careers page reachable: any successful contact — a cached resolution
    // or ingestion attempt whose outcome is not a fetch/SSRF failure. Cold
    // caches mean "unknown", which deliberately does NOT count as detected.
    const resolutionReachable =
      resolution !== null && !UNREACHABLE_OUTCOMES.has(resolution.outcome);
    const ingestionReachable =
      ingestion !== null && !UNREACHABLE_OUTCOMES.has(ingestion.outcome);
    if (resolutionReachable || ingestionReachable) counters.careers_page_detected += 1;

    if (s.hasActiveJobs) counters.actively_posting_employers += 1;
    else counters.zero_job_employers += 1;

    // ATS-resolved: directory says the URL is an ATS board, resolution found
    // a supported board entry, or the last ingestion actually took the ATS path.
    if (
      employer.platformHint !== "careers_page" ||
      resolution?.entry != null ||
      ingestion?.path === "ats"
    ) {
      counters.ats_resolved_employers += 1;
    } else if (ingestion?.path === "basic_html") {
      counters.basic_html_employers += 1;
    } else if (ingestion?.path === "firecrawl") {
      counters.firecrawl_employers += 1;
    }

    if (ingestion?.outcome === "needs_firecrawl") counters.needs_firecrawl_employers += 1;
    if (resolution?.outcome === "unsupported_ats" || ingestion?.outcome === "unsupported_ats") {
      counters.unsupported_ats_employers += 1;
    }
  }
  return counters;
}

/**
 * Coverage status thresholds (deterministic, unit-tested):
 * - healthy: ≥100 active jobs AND ≥25% of seeded employers actively posting
 * - developing: ≥25 active jobs OR ≥5 actively posting employers
 * - thin: everything else
 */
export function coverageStatus(
  counters: Pick<EmployerCounters, "seeded_employers" | "actively_posting_employers">,
  activeCanonicalJobs: number,
): CoverageStatus {
  const postingRatio =
    counters.seeded_employers > 0
      ? counters.actively_posting_employers / counters.seeded_employers
      : 0;
  if (activeCanonicalJobs >= 100 && postingRatio >= 0.25) return "healthy";
  if (activeCanonicalJobs >= 25 || counters.actively_posting_employers >= 5) {
    return "developing";
  }
  return "thin";
}

/**
 * Best-next-gain priority rules, first match wins:
 * 1. ≥3 employers stuck on a known-but-unsupported ATS → build that fetcher
 * 2. ≥3 employers blocked on Firecrawl credits/config → top up Firecrawl
 * 3. fewer than 25 seeded employers → the list itself is the bottleneck
 * 4. otherwise → grow ATS-backed coverage (cheapest reliable path)
 */
export function bestNextGain(
  counters: Pick<
    EmployerCounters,
    "seeded_employers" | "unsupported_ats_employers" | "needs_firecrawl_employers"
  >,
): BestNextGain {
  if (counters.unsupported_ats_employers >= 3) return "support remaining ATS providers";
  if (counters.needs_firecrawl_employers >= 3) return "top up Firecrawl for JS-heavy sites";
  if (counters.seeded_employers < 25) return "expand seed list";
  return "add more ATS employers";
}

/**
 * Build the scorecard for one industry from its directories' signals and the
 * caller-supplied job counts. Segment detail is emitted only when requested
 * (the insurance directory) — segment keys are the directory config's segment
 * keys, which are also the sourceProvider suffixes.
 */
export function buildIndustryScorecard(args: {
  industry: string;
  directories: Array<{ config: CareersDirectoryConfig; signals: EmployerSignals[] }>;
  activeCanonicalJobs: number;
  directEmployerJobs: number;
  /** active job count per segment provider key, for segment detail. */
  segmentJobs?: Map<string, number>;
  includeSegments?: boolean;
}): IndustryScorecard {
  const allSignals = args.directories.flatMap((d) => d.signals);
  const counters = countEmployerSignals(allSignals);

  let segments: SegmentScorecard[] | null = null;
  if (args.includeSegments) {
    segments = [];
    for (const { config, signals } of args.directories) {
      for (const segment of config.segments) {
        const segmentSignals = signals.filter((s) => s.employer.segment === segment);
        segments.push({
          segment,
          ...countEmployerSignals(segmentSignals),
          active_jobs: args.segmentJobs?.get(`${config.providerPrefix}_${segment}`) ?? 0,
        });
      }
    }
  }

  return {
    industry: args.industry,
    directories: args.directories.map((d) => d.config.key),
    ...counters,
    active_canonical_jobs: args.activeCanonicalJobs,
    direct_employer_jobs: args.directEmployerJobs,
    coverage_status: coverageStatus(counters, args.activeCanonicalJobs),
    best_next_gain: bestNextGain(counters),
    segments,
  };
}
