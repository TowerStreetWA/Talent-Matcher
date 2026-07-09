/**
 * Config-driven ATS-hosted employer job boards (source-expansion phase).
 *
 * Each entry points at a public, structured JSON/RSS job-board endpoint
 * exposed by the employer's ATS. The ATS ingestion providers
 * (lib/vacancies/ats/) read this list — adding coverage should mean adding
 * config entries here, not writing new ingestion code.
 *
 * Platforms use their official public job-board APIs (no scraping):
 *   - lever:           GET https://api.lever.co/v0/postings/{token}?mode=json
 *   - ashby:           GET https://api.ashbyhq.com/posting-api/job-board/{token}
 *   - workable:        GET https://apply.workable.com/api/v1/widget/accounts/{token}
 *   - smartrecruiters: GET https://api.smartrecruiters.com/v1/companies/{token}/postings
 *   - recruitee:       GET https://{token}.recruitee.com/api/offers/
 *   - teamtailor:      GET https://{token}.teamtailor.com/jobs.rss (public feed)
 *   - workday:         POST https://{token}.{instance}.myworkdayjobs.com/wday/cxs/{token}/{site}/jobs
 *   - greenhouse:      GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 *                      (falls back to boards-api.eu.greenhouse.io on 404)
 *   - icims:           GET https://{token}.icims.com/jobs/search?ss=1&in_iframe=1&pr={page}
 *                      (server-rendered portal HTML — iCIMS has no public JSON
 *                      feed, but the iframe search page is stable static HTML:
 *                      iCIMS_Anchor links + "Page X of Y" pagination)
 *   - successfactors:  GET {token}/search/?q=&startrow={n} where token is the
 *                      RMK career-site base URL (e.g. https://jobs.sap.com) —
 *                      server-rendered HTML with jobTitle-link anchors.
 *                      SuccessFactors Career Site Builder portals
 *                      (careerN.successfactors.com/eu) are JS-only and remain
 *                      unsupported (detected as "successfactors_csb").
 *
 * NOTE: board tokens rot like careers URLs do — curl-probe the endpoint
 * before debugging extraction logic (see replit.md gotchas).
 */

export type AtsPlatform =
  | "lever"
  | "ashby"
  | "workable"
  | "smartrecruiters"
  | "recruitee"
  | "teamtailor"
  | "workday"
  | "greenhouse"
  | "icims"
  | "successfactors";

export interface AtsEmployerConfig {
  /** Display / fallback company name. */
  company: string;
  platform: AtsPlatform;
  /** Board token / account slug / company identifier / workday tenant. */
  token: string;
  /** Workday only: instance host segment, e.g. "wd1" / "wd3". */
  workdayInstance?: string;
  /** Workday only: external career site name, e.g. "External" / "careers". */
  workdaySite?: string;
  /** Max jobs ingested per run for this employer (default 40). */
  maxJobs?: number;
  /**
   * SuccessFactors only: full-text `q=` search term for the RMK career site.
   * Global boards (e.g. jobs.sap.com) sort newest-first worldwide, so without
   * a query the first pages may contain zero UK rows for the location filter.
   */
  searchQuery?: string;
  /**
   * Optional location filter (case-insensitive substrings). When set, only
   * postings whose location matches one of these survive — used to keep
   * global boards (US-heavy) focused on UK/EU coverage.
   */
  locationIncludes?: string[];
  /** Sector tag stamped on this employer's vacancies when inferable. */
  sectorTag?: string | null;
}

export const DEFAULT_ATS_MAX_JOBS = 40;

export const ATS_EMPLOYERS: AtsEmployerConfig[] = [
  // ---- Lever ----
  {
    company: "Zopa",
    platform: "lever",
    token: "zopa",
    sectorTag: "banking",
  },
  {
    company: "Octopus Energy",
    platform: "lever",
    token: "octoenergy",
    locationIncludes: ["london", "united kingdom", "uk"],
  },
  // ---- Ashby ----
  {
    company: "Multiverse",
    platform: "ashby",
    token: "multiverse",
    locationIncludes: ["london", "united kingdom", "uk", "remote"],
    sectorTag: "it_tech",
  },
  {
    company: "Ramp",
    platform: "ashby",
    token: "ramp",
    locationIncludes: ["london", "united kingdom", "uk"],
    sectorTag: "it_tech",
  },
  // ---- Workable ----
  {
    company: "Marshmallow",
    platform: "workable",
    token: "marshmallow",
    sectorTag: "insurance",
  },
  {
    company: "Moneyhub",
    platform: "workable",
    token: "moneyhub",
    sectorTag: "it_tech",
  },
  {
    company: "Blueground",
    platform: "workable",
    token: "blueground",
    locationIncludes: ["london", "united kingdom", "uk"],
  },
  // ---- SmartRecruiters ----
  {
    company: "Visa",
    platform: "smartrecruiters",
    token: "Visa",
    locationIncludes: ["london", "united kingdom", "uk"],
    sectorTag: "banking",
  },
  {
    company: "Experian",
    platform: "smartrecruiters",
    token: "Experian",
    locationIncludes: ["london", "united kingdom", "uk", "nottingham"],
    sectorTag: "banking",
  },
  // ---- Recruitee ----
  {
    company: "Sendcloud",
    platform: "recruitee",
    token: "sendcloud",
  },
  {
    company: "Channable",
    platform: "recruitee",
    token: "channable",
  },
  // ---- Teamtailor ----
  {
    company: "Lunar",
    platform: "teamtailor",
    token: "lunar",
    sectorTag: "banking",
  },
  {
    company: "Ki Insurance",
    platform: "workable",
    token: "ki-insurance",
    locationIncludes: ["london", "united kingdom", "uk"],
    sectorTag: "insurance",
  },
  {
    company: "Together",
    platform: "smartrecruiters",
    token: "Together",
    sectorTag: "banking",
  },
  // ---- Workday ----
  {
    company: "Aviva",
    platform: "workday",
    token: "aviva",
    workdayInstance: "wd1",
    workdaySite: "External",
    locationIncludes: ["london", "united kingdom", "uk"],
    sectorTag: "insurance",
  },
  // Underwriting-heavy insurers / Lloyd's market (source-deepening phase).
  {
    company: "Hiscox",
    platform: "workday",
    token: "hiscox",
    workdayInstance: "wd3",
    workdaySite: "Hiscox_External_Site",
    maxJobs: 100,
    locationIncludes: ["london", "united kingdom", "uk", "york", "colchester"],
    sectorTag: "insurance",
  },
  {
    company: "QBE",
    platform: "workday",
    token: "qbe",
    workdayInstance: "wd3",
    workdaySite: "QBE-Careers",
    maxJobs: 100,
    locationIncludes: ["london", "united kingdom", "uk", "gbr"],
    sectorTag: "insurance",
  },
  {
    company: "AIG",
    platform: "workday",
    token: "aig",
    workdayInstance: "wd1",
    workdaySite: "aig",
    maxJobs: 100,
    locationIncludes: ["london", "united kingdom", "uk", "gbr"],
    sectorTag: "insurance",
  },
  {
    company: "AEGIS London",
    platform: "workday",
    token: "aegislondon",
    workdayInstance: "wd3",
    workdaySite: "Careers",
    sectorTag: "insurance",
  },
  {
    company: "London Stock Exchange Group",
    platform: "workday",
    token: "lseg",
    workdayInstance: "wd3",
    workdaySite: "careers",
    locationIncludes: ["london", "united kingdom", "uk"],
    sectorTag: "banking",
  },
  // ---- Greenhouse ----
  {
    company: "Monzo",
    platform: "greenhouse",
    token: "monzo",
    locationIncludes: ["london", "united kingdom", "uk", "cardiff", "remote"],
    sectorTag: "banking",
  },
  // ---- iCIMS (server-rendered portal HTML) ----
  {
    company: "Kingfisher",
    platform: "icims",
    token: "careers-kingfisher2",
    locationIncludes: ["london", "united kingdom", "uk"],
    sectorTag: "it_tech",
  },
  // ---- SuccessFactors (RMK career sites; token = site base URL) ----
  {
    company: "SAP",
    platform: "successfactors",
    token: "https://jobs.sap.com",
    searchQuery: "London",
    locationIncludes: ["london", "united kingdom", "uk", "gb"],
    sectorTag: "it_tech",
  },
];

export function resolveAtsMaxJobs(entry: AtsEmployerConfig): number {
  const cap = entry.maxJobs ?? DEFAULT_ATS_MAX_JOBS;
  return Math.min(Math.max(cap, 1), 100);
}
