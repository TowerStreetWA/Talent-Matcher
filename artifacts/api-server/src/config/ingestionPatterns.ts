/**
 * Config-driven vacancy discovery search patterns (Phase 14).
 *
 * Each pattern is one Google Jobs (SerpApi) search: keywords + location +
 * sector tag + a per-pattern result cap. The batch ingestion endpoint
 * (`POST /internal/ingestion/run-patterns`) iterates these sequentially.
 *
 * Extend coverage HERE — add/remove patterns or adjust caps. Do not put
 * pattern-specific logic inside the provider or the runner.
 *
 * Note on LinkedIn: there is no direct LinkedIn crawler (scraping LinkedIn
 * violates its Terms of Service). LinkedIn-hosted listings enter through
 * Google Jobs — results whose apply links point at linkedin.com are
 * attributed to the "LinkedIn Jobs (via Google)" source automatically.
 */
export interface SearchPatternConfig {
  /** Unique pattern id, e.g. "insurance_london". */
  name: string;
  /** Search keywords sent to the provider. */
  keywords: string;
  /** Provider location string (SerpApi `location` param). */
  location: string;
  /** Sector tag stored on every job ingested by this pattern. */
  sectorTag:
    | "insurance"
    | "banking"
    | "pensions"
    | "asset_management"
    | "accountancy_finance"
    | "it_tech";
  /**
   * Per-pattern cap on fetched results (pagination stops at this many).
   * SerpApi returns ~10 results per page, so 60 ≈ up to 6 API calls.
   */
  maxResults?: number;
}

export const DEFAULT_PATTERN_MAX_RESULTS = 60;

/** Hard safety ceiling regardless of config (avoid runaway API usage). */
export const PATTERN_MAX_RESULTS_CEILING = 200;

export const GOOGLE_JOBS_PATTERNS: SearchPatternConfig[] = [
  {
    name: "insurance_london",
    keywords: "insurance jobs",
    location: "London, United Kingdom",
    sectorTag: "insurance",
  },
  {
    name: "banking_london",
    keywords: "banking jobs",
    location: "London, United Kingdom",
    sectorTag: "banking",
  },
  {
    name: "pensions_london",
    keywords: "pensions jobs",
    location: "London, United Kingdom",
    sectorTag: "pensions",
  },
  {
    name: "asset_management_london",
    keywords: "asset management jobs",
    location: "London, United Kingdom",
    sectorTag: "asset_management",
  },
  // Banking depth (beyond the sector-level "banking jobs" query).
  {
    name: "investment_banking_london",
    keywords: "investment banking jobs",
    location: "London, United Kingdom",
    sectorTag: "banking",
  },
  {
    name: "fintech_banking_london",
    keywords: "fintech bank jobs",
    location: "London, United Kingdom",
    sectorTag: "banking",
  },
  // IT & Tech coverage (sector had no Google Jobs patterns before).
  {
    name: "software_engineer_london",
    keywords: "software engineer jobs",
    location: "London, United Kingdom",
    sectorTag: "it_tech",
  },
  {
    name: "devops_engineer_london",
    keywords: "devops engineer jobs",
    location: "London, United Kingdom",
    sectorTag: "it_tech",
  },
  {
    name: "data_engineer_london",
    keywords: "data engineer jobs",
    location: "London, United Kingdom",
    sectorTag: "it_tech",
  },
  {
    name: "cyber_security_london",
    keywords: "cyber security jobs",
    location: "London, United Kingdom",
    sectorTag: "it_tech",
  },
];

export function resolvePatternCap(pattern: SearchPatternConfig): number {
  const cap = pattern.maxResults ?? DEFAULT_PATTERN_MAX_RESULTS;
  return Math.min(Math.max(cap, 1), PATTERN_MAX_RESULTS_CEILING);
}
