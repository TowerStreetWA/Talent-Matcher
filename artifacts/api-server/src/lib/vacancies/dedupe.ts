import type { VacancySourceType } from "./types";

/**
 * Vacancy deduplication / canonicalization helpers.
 *
 * Duplicates are identified by an explainable normalized key
 * (title + company + location bucket). Within a duplicate cluster the
 * canonical record is chosen by source preference:
 *
 *   1. direct_employer (company careers site)
 *   2. google_jobs where the job URL is on the employer's own domain
 *   3. google_jobs on an aggregator domain
 *   4. job_board (future)
 *   5. agency (future)
 */

const COMPANY_SUFFIXES = [
  "limited",
  "ltd",
  "plc",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "gmbh",
  "bv",
  "sa",
  "co",
  "corp",
  "corporation",
  "group",
  "holdings",
];

function squash(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeTitle(title: string): string {
  return squash(title);
}

export function normalizeCompany(company: string | null): string {
  if (!company) return "";
  let words = squash(company).split(" ");
  while (words.length > 1 && COMPANY_SUFFIXES.includes(words[words.length - 1]!)) {
    words = words.slice(0, -1);
  }
  if (words[0] === "the" && words.length > 1) words = words.slice(1);
  return words.join(" ");
}

const LOCATION_NOISE = new Set([
  "uk",
  "united",
  "kingdom",
  "gb",
  "great",
  "britain",
  "england",
  "greater",
  "area",
  "city",
  "of",
]);

/**
 * Reduce a free-text location to a coarse bucket (usually the city).
 * "London, UK" / "Greater London" / "London EC2" all map to "london".
 */
export function normalizeLocation(location: string | null): string {
  if (!location) return "";
  const firstSegment = location.split(/[,;|/]/)[0] ?? "";
  const words = squash(firstSegment)
    .split(" ")
    .filter((w) => w.length > 0 && !LOCATION_NOISE.has(w) && !/^\d/.test(w));
  return words.join(" ");
}

export interface ClusterKeyInput {
  title: string;
  companyName: string | null;
  locationText: string | null;
}

/**
 * Explainable duplicate-cluster key. Two vacancies with the same key are
 * treated as the same underlying role. Location is included only when both
 * sides have one — handled by callers via locationsCompatible().
 */
export function clusterKey(input: ClusterKeyInput): string {
  return `${normalizeTitle(input.title)}::${normalizeCompany(input.companyName)}`;
}

/** Locations are compatible when equal after normalization, or either is unknown. */
export function locationsCompatible(a: string | null, b: string | null): boolean {
  const na = normalizeLocation(a);
  const nb = normalizeLocation(b);
  if (!na || !nb) return true;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Hosts that are aggregators/boards — NOT employer domains. */
const AGGREGATOR_HOST_PATTERNS = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.",
  "reed.co.uk",
  "totaljobs.com",
  "cv-library.co.uk",
  "adzuna.",
  "monster.",
  "ziprecruiter.",
  "google.com",
  "jobrapido.",
  "talent.com",
  "welcometothejungle.com",
  "otta.com",
  "simplyhired.",
];

export function isAggregatorHost(url: string | null): boolean {
  if (!url) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return AGGREGATOR_HOST_PATTERNS.some((p) => host === p || host.includes(p));
  } catch {
    return true;
  }
}

export interface PreferenceInput {
  sourceType: VacancySourceType | string | null;
  sourceUrl: string | null;
}

/**
 * Lower rank wins the canonical slot. Legacy/manual rows (null sourceType)
 * rank between direct employer and aggregator copies: they were curated, so a
 * direct employer page still beats them, but they beat aggregator duplicates.
 */
export function sourcePreferenceRank(input: PreferenceInput): number {
  switch (input.sourceType) {
    case "direct_employer":
      return 0;
    case null:
    case undefined:
    case "":
      return 1; // legacy/manually curated rows
    case "google_jobs":
      return isAggregatorHost(input.sourceUrl) ? 3 : 2;
    case "job_board":
      return 4;
    case "agency":
      return 5;
    default:
      return 6;
  }
}

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  "£": "GBP",
  $: "USD",
  "€": "EUR",
};

export interface ParsedSalary {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}

/**
 * Best-effort parse of a raw salary string ("£65,000 - £80,000", "$120k",
 * "70000 GBP"). Returns nulls when nothing trustworthy is found; the raw text
 * is always stored alongside.
 */
export function parseSalaryText(raw: string | null): ParsedSalary {
  const empty: ParsedSalary = { salaryMin: null, salaryMax: null, salaryCurrency: null };
  if (!raw) return empty;
  const text = raw.trim();

  let currency: string | null = null;
  const symbol = text.match(/[£$€]/)?.[0];
  if (symbol) currency = CURRENCY_BY_SYMBOL[symbol] ?? null;
  else {
    const code = text.toUpperCase().match(/\b(GBP|USD|EUR)\b/)?.[1];
    if (code) currency = code;
  }

  const amounts: number[] = [];
  const numberPattern = /(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k)?/gi;
  for (const m of text.matchAll(numberPattern)) {
    let value = Number(m[1]!.replace(/[,.](?=\d{3}\b)/g, ""));
    if (!Number.isFinite(value)) continue;
    if (m[2]) value *= 1000;
    // Ignore obviously-not-annual-salary numbers (percentages, tiny figures)
    if (value < 1000) continue;
    amounts.push(value);
  }
  if (amounts.length === 0) return { ...empty, salaryCurrency: currency };
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return { salaryMin: min, salaryMax: max === min ? min : max, salaryCurrency: currency };
}
