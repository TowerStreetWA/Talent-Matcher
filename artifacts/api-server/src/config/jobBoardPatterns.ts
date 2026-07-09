/**
 * Config-driven ingestion patterns for job-board APIs (Reed, Adzuna) —
 * source-expansion phase. Mirrors config/ingestionPatterns.ts (Google Jobs):
 * each pattern is one keyword/location query with a sector tag and a cap.
 * Extend coverage HERE — no pattern-specific logic in providers or runner.
 */

export type JobBoardProviderKey = "reed" | "adzuna";

export interface JobBoardPatternConfig {
  /** Unique pattern id, e.g. "reed_insurance_london". */
  name: string;
  /** Keyword query sent to the board API. */
  keywords: string;
  /** Board location string ("London", "Manchester", ...). */
  location: string;
  /** Sector tag stored on every job ingested by this pattern. */
  sectorTag:
    | "insurance"
    | "banking"
    | "pensions"
    | "asset_management"
    | "accountancy_finance"
    | "it_tech";
  /** Per-pattern cap on fetched results. */
  maxResults?: number;
}

export const DEFAULT_BOARD_PATTERN_MAX_RESULTS = 50;

/** Hard safety ceiling regardless of config (avoid runaway API usage). */
export const BOARD_PATTERN_MAX_RESULTS_CEILING = 200;

export const REED_PATTERNS: JobBoardPatternConfig[] = [
  { name: "reed_insurance_london", keywords: "insurance", location: "London", sectorTag: "insurance" },
  { name: "reed_banking_london", keywords: "banking", location: "London", sectorTag: "banking" },
  { name: "reed_pensions_london", keywords: "pensions", location: "London", sectorTag: "pensions" },
  {
    name: "reed_asset_management_london",
    keywords: "asset management",
    location: "London",
    sectorTag: "asset_management",
  },
  {
    name: "reed_accountancy_london",
    keywords: "accountant finance",
    location: "London",
    sectorTag: "accountancy_finance",
  },
  // Underwriting-focused Insurance patterns (deepen coverage beyond the
  // sector-level "insurance" query; family classification stays query-time).
  { name: "reed_underwriter_london", keywords: "underwriter", location: "London", sectorTag: "insurance" },
  { name: "reed_underwriter_uk", keywords: "underwriter", location: "United Kingdom", sectorTag: "insurance" },
  {
    name: "reed_motor_underwriter_uk",
    keywords: "motor underwriter",
    location: "United Kingdom",
    sectorTag: "insurance",
  },
  {
    name: "reed_property_underwriter_uk",
    keywords: "property underwriter",
    location: "United Kingdom",
    sectorTag: "insurance",
  },
  {
    name: "reed_liability_underwriter_uk",
    keywords: "liability underwriter",
    location: "United Kingdom",
    sectorTag: "insurance",
  },
  // Banking depth (beyond the sector-level "banking" query).
  {
    name: "reed_investment_banking_london",
    keywords: "investment banking",
    location: "London",
    sectorTag: "banking",
  },
  {
    name: "reed_retail_banking_uk",
    keywords: "retail banking",
    location: "United Kingdom",
    sectorTag: "banking",
  },
  // IT & Tech coverage (sector had no Reed patterns before).
  { name: "reed_software_engineer_london", keywords: "software engineer", location: "London", sectorTag: "it_tech" },
  { name: "reed_devops_london", keywords: "devops engineer", location: "London", sectorTag: "it_tech" },
  { name: "reed_data_engineer_london", keywords: "data engineer", location: "London", sectorTag: "it_tech" },
  { name: "reed_cyber_security_london", keywords: "cyber security", location: "London", sectorTag: "it_tech" },
  { name: "reed_fintech_london", keywords: "fintech", location: "London", sectorTag: "it_tech" },
];

export const ADZUNA_PATTERNS: JobBoardPatternConfig[] = [
  { name: "adzuna_insurance_london", keywords: "insurance", location: "London", sectorTag: "insurance" },
  { name: "adzuna_banking_london", keywords: "banking", location: "London", sectorTag: "banking" },
  { name: "adzuna_pensions_london", keywords: "pensions", location: "London", sectorTag: "pensions" },
  {
    name: "adzuna_asset_management_london",
    keywords: "asset management",
    location: "London",
    sectorTag: "asset_management",
  },
  {
    name: "adzuna_fintech_london",
    keywords: "fintech engineer",
    location: "London",
    sectorTag: "it_tech",
  },
  // Underwriting-focused Insurance patterns (mirror the Reed set).
  { name: "adzuna_underwriter_london", keywords: "underwriter", location: "London", sectorTag: "insurance" },
  { name: "adzuna_underwriter_uk", keywords: "underwriter", location: "UK", sectorTag: "insurance" },
  {
    name: "adzuna_motor_underwriter_uk",
    keywords: "motor underwriter",
    location: "UK",
    sectorTag: "insurance",
  },
  {
    name: "adzuna_property_underwriter_uk",
    keywords: "property underwriter",
    location: "UK",
    sectorTag: "insurance",
  },
  {
    name: "adzuna_liability_underwriter_uk",
    keywords: "liability underwriter",
    location: "UK",
    sectorTag: "insurance",
  },
  // Banking depth (mirror the Reed set).
  {
    name: "adzuna_investment_banking_london",
    keywords: "investment banking",
    location: "London",
    sectorTag: "banking",
  },
  {
    name: "adzuna_retail_banking_uk",
    keywords: "retail banking",
    location: "UK",
    sectorTag: "banking",
  },
  // IT & Tech coverage (mirror the Reed set).
  { name: "adzuna_software_engineer_london", keywords: "software engineer", location: "London", sectorTag: "it_tech" },
  { name: "adzuna_devops_london", keywords: "devops engineer", location: "London", sectorTag: "it_tech" },
  { name: "adzuna_data_engineer_london", keywords: "data engineer", location: "London", sectorTag: "it_tech" },
  { name: "adzuna_cyber_security_london", keywords: "cyber security", location: "London", sectorTag: "it_tech" },
];

export function boardPatternsFor(provider: JobBoardProviderKey): JobBoardPatternConfig[] {
  return provider === "reed" ? REED_PATTERNS : ADZUNA_PATTERNS;
}

export function resolveBoardPatternCap(pattern: JobBoardPatternConfig): number {
  const cap = pattern.maxResults ?? DEFAULT_BOARD_PATTERN_MAX_RESULTS;
  return Math.min(Math.max(cap, 1), BOARD_PATTERN_MAX_RESULTS_CEILING);
}
