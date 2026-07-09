/**
 * Company-kind classification: is a job's posting company a direct employer,
 * a recruitment firm, or a job board? Entirely config-driven — rules read
 * config/recruiterFirms.ts + config/recruiterOverrides.ts; never hardcode
 * recruiter names here.
 *
 * Precedence:
 *   1. Overrides (FORCE_DIRECT_EMPLOYER / FORCE_RECRUITMENT_FIRM)
 *   2. Registry match (alias normalized equality, or domain suffix)
 *   3. Job-board company names
 *   4. Recruiter name patterns ("X Recruitment Ltd", "Y Staffing", ...)
 *   5. Description text signals (1 strong, or 2 distinct weak)
 *   6. Fallback: direct_employer (named company) / unknown (no company)
 */

import {
  JOB_BOARD_COMPANIES,
  RECRUITER_FIRMS,
  RECRUITER_NAME_PATTERNS,
  RECRUITER_TEXT_SIGNALS_STRONG,
  RECRUITER_TEXT_SIGNALS_WEAK,
} from "../../config/recruiterFirms";
import {
  FORCE_DIRECT_EMPLOYER,
  FORCE_RECRUITMENT_FIRM,
} from "../../config/recruiterOverrides";

export const COMPANY_KINDS = [
  "direct_employer",
  "recruitment_firm",
  "job_board",
  "unknown",
] as const;
export type CompanyKind = (typeof COMPANY_KINDS)[number];

/** Legal suffixes and noise tokens stripped from the END of company names. */
const TRAILING_NOISE = new Set([
  "ltd",
  "limited",
  "llp",
  "llc",
  "plc",
  "inc",
  "gmbh",
  "uk",
  "london",
  "group",
  "international",
  "associates",
  "partners",
  "consulting",
]);

/**
 * Normalize a company name for equality matching: lowercase, strip
 * punctuation, collapse whitespace, and drop trailing legal/noise tokens
 * (repeatedly, so "IPS Group UK" → "ips"). "&" folds to "and".
 */
export function normalizeCompanyName(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && TRAILING_NOISE.has(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return tokens.join(" ");
}

const hostnameOf = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

const domainMatches = (hostname: string, domain: string): boolean =>
  hostname === domain || hostname.endsWith(`.${domain}`);

interface NameDomainIndex {
  names: Set<string>;
  domains: string[];
}

function buildIndex(
  entries: Array<{ names?: string[]; aliases?: string[]; name?: string; domains?: string[] }>,
): NameDomainIndex {
  const names = new Set<string>();
  const domains: string[] = [];
  for (const e of entries) {
    for (const n of [e.name, ...(e.names ?? []), ...(e.aliases ?? [])]) {
      if (n) names.add(normalizeCompanyName(n));
    }
    for (const d of e.domains ?? []) domains.push(d.toLowerCase());
  }
  return { names, domains };
}

const FORCE_DIRECT_INDEX = buildIndex(FORCE_DIRECT_EMPLOYER);
const FORCE_RECRUITER_INDEX = buildIndex(FORCE_RECRUITMENT_FIRM);
const REGISTRY_INDEX = buildIndex(RECRUITER_FIRMS);
const JOB_BOARD_NAMES = new Set(JOB_BOARD_COMPANIES.map(normalizeCompanyName));

const matchesIndex = (
  index: NameDomainIndex,
  normalizedName: string | null,
  hostnames: string[],
): boolean => {
  if (normalizedName && index.names.has(normalizedName)) return true;
  return hostnames.some((h) => index.domains.some((d) => domainMatches(h, d)));
};

export interface CompanyKindInput {
  companyName: string | null | undefined;
  /** Apply/source URLs — used for recruiter domain matching. */
  urls?: Array<string | null | undefined>;
  /** Job description / company snippet text (may be truncated). */
  descriptionText?: string | null;
}

/** Counts distinct text signals; strong ≥1 or weak ≥2 → recruiter. */
export function hasRecruiterTextSignals(text: string): boolean {
  const lower = text.toLowerCase();
  if (RECRUITER_TEXT_SIGNALS_STRONG.some((s) => lower.includes(s))) return true;
  let weak = 0;
  for (const s of RECRUITER_TEXT_SIGNALS_WEAK) {
    if (lower.includes(s)) {
      weak += 1;
      if (weak >= 2) return true;
    }
  }
  return false;
}

export function classifyCompanyKind(input: CompanyKindInput): CompanyKind {
  const rawName = input.companyName?.trim() || null;
  const normalizedName = rawName ? normalizeCompanyName(rawName) : null;
  const hostnames = (input.urls ?? [])
    .map(hostnameOf)
    .filter((h): h is string => h !== null);

  // 1. Overrides beat everything.
  if (matchesIndex(FORCE_DIRECT_INDEX, normalizedName, hostnames)) {
    return "direct_employer";
  }
  if (matchesIndex(FORCE_RECRUITER_INDEX, normalizedName, hostnames)) {
    return "recruitment_firm";
  }

  // 2. Recruiter registry.
  if (matchesIndex(REGISTRY_INDEX, normalizedName, hostnames)) {
    return "recruitment_firm";
  }

  // 3. Job boards posting as themselves.
  if (normalizedName && JOB_BOARD_NAMES.has(normalizedName)) return "job_board";

  // 4. Name patterns ("Massenhove Recruitment", "ITOL Recruit", ...).
  if (rawName && RECRUITER_NAME_PATTERNS.some((re) => re.test(rawName))) {
    return "recruitment_firm";
  }

  // 5. Description text signals ("on behalf of our client", ...).
  if (input.descriptionText && hasRecruiterTextSignals(input.descriptionText)) {
    return "recruitment_firm";
  }

  // 6. Fallback.
  return rawName ? "direct_employer" : "unknown";
}
