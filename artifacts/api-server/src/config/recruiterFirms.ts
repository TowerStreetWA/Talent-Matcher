/**
 * Recruiter firm registry — the single source of truth for which companies
 * are recruitment agencies. Consumed by lib/search/companyKind.ts; never
 * hardcode recruiter logic elsewhere.
 *
 * Matching semantics (implemented in companyKind.ts):
 * - `aliases` match on full normalized-name equality only (legal suffixes
 *   like Ltd/Limited/LLP/Group/UK and a trailing city are stripped first).
 *   Keep aliases specific: "Reed" must NOT be a substring rule or it would
 *   swallow direct employers like "Reed Smith".
 * - `domains` match by hostname suffix on the job's apply/source URL.
 * - `sectors` are informational (diagnostics), not used for matching.
 */

import type { FinSector } from "../lib/search/finTaxonomy";

export interface RecruiterFirm {
  /** Canonical display name. */
  name: string;
  /** Normalized-equality aliases (the canonical name is matched implicitly). */
  aliases?: string[];
  /** Hostname suffixes, e.g. "hays.co.uk". */
  domains?: string[];
  /** Sectors the firm mainly operates in (informational). */
  sectors?: FinSector[];
  notes?: string;
}

export const RECRUITER_FIRMS: RecruiterFirm[] = [
  // ── Cross-sector generalists ────────────────────────────────────────────
  {
    name: "Hays",
    aliases: [
      "Hays Specialist Recruitment",
      "Hays Specialist Recruitment Limited",
      "Hays Banking & Financial Services",
      "Hays Banking and Financial Services",
      "Hays Financial Markets",
      "Hays Investment Management",
      "Hays Accountancy & Finance",
      "Hays Accountancy and Finance",
      "Hays Technology",
      "Hays Pensions",
      "Hays Insurance",
    ],
    domains: ["hays.co.uk", "hays.com"],
  },
  {
    name: "Robert Walters",
    domains: ["robertwalters.co.uk", "robertwalters.com"],
  },
  {
    name: "Morgan McKinley",
    domains: ["morganmckinley.com"],
  },
  {
    name: "Michael Page",
    aliases: [
      "Michael Page Finance",
      "Michael Page Banking",
      "Michael Page Technology",
      "Michael Page International",
      "Page Personnel",
      "Page Executive",
      "PageGroup",
    ],
    domains: ["michaelpage.co.uk", "michaelpage.com", "pagepersonnel.co.uk"],
  },
  {
    name: "Reed",
    aliases: [
      "Reed Recruitment",
      "Reed Specialist Recruitment",
      "Reed Accountancy",
      "Reed Technology",
      "Reed Pensions & Benefits",
      "Reed Pensions and Benefits",
      "Reed Finance",
      "Reed Insurance",
    ],
    notes:
      "Alias equality only — must not match direct employers like Reed Smith. reed.co.uk domain deliberately omitted: it is the job-board apply domain for thousands of third-party postings.",
  },
  {
    name: "Randstad",
    aliases: ["Randstad Technologies", "Randstad UK", "Randstad CPE"],
    domains: ["randstad.co.uk", "randstad.com"],
  },
  { name: "Hudson", aliases: ["Hudson RPO"], domains: ["hudsonrpo.com"] },
  {
    name: "Robert Half",
    domains: ["roberthalf.co.uk", "roberthalf.com"],
  },
  { name: "Adecco", domains: ["adecco.co.uk"] },
  { name: "Manpower", aliases: ["ManpowerGroup"], domains: ["manpower.co.uk"] },

  // ── Banking / financial services ────────────────────────────────────────
  { name: "Walker Hamill", domains: ["walkerhamill.com"], sectors: ["banking", "asset_management"] },
  { name: "Goodman Masson", domains: ["goodmanmasson.com"], sectors: ["banking", "accountancy_finance"] },
  {
    name: "Selby Jennings",
    aliases: ["Selby Jennings London", "Phaidon International"],
    domains: ["selbyjennings.co.uk", "selbyjennings.com", "phaidoninternational.com"],
    sectors: ["banking", "asset_management"],
  },
  { name: "Barclay Simpson", domains: ["barclaysimpson.com"], sectors: ["banking"] },
  { name: "People First", aliases: ["People First Banking"], sectors: ["banking"] },
  { name: "Market Talent", sectors: ["banking"] },
  { name: "Taylor Root", domains: ["taylorroot.com"], sectors: ["banking"] },
  { name: "Bruin Financial", aliases: ["Bruin"], domains: ["bruinfinancial.com"], sectors: ["banking", "asset_management"] },
  {
    name: "Eames Consulting",
    aliases: ["Eames", "Eames Group"],
    domains: ["eamesconsulting.com"],
    sectors: ["banking", "insurance"],
  },
  {
    name: "IPS Group",
    aliases: ["IPS Group UK", "IPS"],
    domains: ["ipsgroup.co.uk"],
    sectors: ["insurance", "banking"],
  },
  { name: "McGregor Boyall", domains: ["mcgregor-boyall.com"], sectors: ["banking", "it_tech"] },
  {
    name: "HFG",
    aliases: ["High Finance Group", "HFG Insurance Recruitment"],
    domains: ["hfg.co.uk"],
    sectors: ["insurance", "banking"],
  },
  { name: "Pure Search", aliases: ["Pure"], domains: ["puresearch.com"], sectors: ["banking", "accountancy_finance"] },
  { name: "Dartmouth Partners", domains: ["dartmouthpartners.com"], sectors: ["banking", "asset_management"] },
  { name: "Mason Blake", domains: ["masonblake.com"], sectors: ["asset_management"] },
  { name: "Blackwood Group", sectors: ["banking", "asset_management"] },
  { name: "Emerald Group", sectors: ["insurance", "asset_management"] },
  { name: "PER", aliases: ["PER Private Equity Recruitment"], domains: ["per-people.com"], sectors: ["asset_management"] },
  { name: "Alto Partners", sectors: ["asset_management"] },
  { name: "Norman Broadbent", domains: ["normanbroadbent.com"], sectors: ["banking"] },
  { name: "Sheffield Haworth", domains: ["sheffieldhaworth.com"], sectors: ["banking"] },
  {
    name: "Oliver James",
    aliases: ["Oliver James Associates"],
    domains: ["oliverjames.com", "ojassociates.com"],
    sectors: ["insurance", "pensions", "banking"],
  },
  { name: "Harnham", aliases: ["Harnham - Data & Analytics Recruitment", "Harnham Data & Analytics Recruitment"], domains: ["harnham.com"], sectors: ["it_tech", "banking"] },

  // ── Pensions ────────────────────────────────────────────────────────────
  { name: "Pension Careers", sectors: ["pensions"] },
  { name: "Zatori Consulting", aliases: ["Zatori"], sectors: ["pensions"] },
  { name: "BranWell Ford", aliases: ["Branwell Ford Associates"], domains: ["branwellford.co.uk"], sectors: ["pensions"] },
  { name: "Alexander Lloyd", domains: ["alexanderlloyd.co.uk"], sectors: ["pensions", "accountancy_finance"] },
  { name: "abenefit2u", domains: ["abenefit2u.com"], sectors: ["pensions"] },
  { name: "BWD Search & Selection", aliases: ["BWD Search and Selection", "BWD"], domains: ["bwd-search.co.uk"], sectors: ["pensions"] },
  { name: "Star Actuarial Futures", aliases: ["Star Actuarial"], domains: ["staractuarial.com"], sectors: ["pensions", "insurance"] },
  { name: "Pensions Talent", sectors: ["pensions"] },
  { name: "Pensions People", sectors: ["pensions"] },
  { name: "Sammons Pensions", aliases: ["Sammons", "The Sammons Group"], domains: ["sammons.co.uk"], sectors: ["pensions"] },

  // ── Accountancy & finance ───────────────────────────────────────────────
  { name: "Nigel Wright", domains: ["nigelwright.com"], sectors: ["accountancy_finance"] },
  { name: "Sellick Partnership", domains: ["sellickpartnership.co.uk"], sectors: ["accountancy_finance"] },
  { name: "Marks Sattin", domains: ["markssattin.co.uk"], sectors: ["accountancy_finance"] },
  { name: "Brewer Morris", domains: ["brewermorris.com"], sectors: ["accountancy_finance"] },
  { name: "Investigo", domains: ["investigo.co.uk"], sectors: ["accountancy_finance", "it_tech"] },
  { name: "Vitae Financial Recruitment", domains: ["vitaefr.com"], sectors: ["accountancy_finance"] },

  // ── IT & technology ─────────────────────────────────────────────────────
  { name: "Nigel Frank", aliases: ["Nigel Frank International", "Frank Recruitment Group"], domains: ["nigelfrank.com", "frankgroup.com"], sectors: ["it_tech"] },
  { name: "Experis", domains: ["experis.co.uk", "experis.com"], sectors: ["it_tech"] },
  { name: "Akkodis", aliases: ["Modis"], domains: ["akkodis.com", "modis.com"], sectors: ["it_tech"] },
  { name: "Harvey Nash", domains: ["harveynash.com", "harveynash.co.uk"], sectors: ["it_tech", "accountancy_finance"] },
  { name: "Explore Group", aliases: ["Explore Tech Talent"], sectors: ["it_tech"] },
  { name: "Roc Search", domains: ["roc-search.com"], sectors: ["it_tech"] },
  { name: "Mortimer Spinks", sectors: ["it_tech"] },
  { name: "Venturi", aliases: ["Venturi Group"], domains: ["venturi-group.com"], sectors: ["it_tech"] },
  { name: "Understanding Recruitment", domains: ["understandingrecruitment.co.uk"], sectors: ["it_tech"] },
  { name: "La Fosse", aliases: ["La Fosse Associates"], domains: ["lafosse.com"], sectors: ["it_tech"] },
  { name: "Hydrogen Group", aliases: ["Hydrogen"], domains: ["hydrogengroup.com"], sectors: ["it_tech"] },
  { name: "Lorien", domains: ["lorienglobal.com"], sectors: ["it_tech"] },
  { name: "Computer Futures", domains: ["computerfutures.com"], sectors: ["it_tech"] },
  { name: "Austin Fraser", domains: ["austinfraser.com"], sectors: ["it_tech"] },
  { name: "Oscar Technology", aliases: ["Oscar"], domains: ["oscar-tech.com"], sectors: ["it_tech"] },
  { name: "Client Server", domains: ["client-server.com"], sectors: ["it_tech"] },
  { name: "Burns Sheehan", domains: ["burnssheehan.co.uk"], sectors: ["it_tech"] },
];

/**
 * Companies that are job boards / aggregators themselves (postings republished
 * from many employers). Matched with the same normalized-equality rules.
 */
export const JOB_BOARD_COMPANIES: string[] = [
  "Reed.co.uk",
  "Adzuna",
  "Indeed",
  "Totaljobs",
  "CV-Library",
  "CV Library",
  "eFinancialCareers",
  "Jobsite",
  "Monster",
  "CWJobs",
  "Jobserve",
];

/**
 * Name-pattern signals: if the company NAME itself contains one of these as a
 * word, it is a recruitment firm (e.g. "Massenhove Recruitment Limited",
 * "ITOL Recruit", "BWD Search & Selection"). Case-insensitive whole words.
 * Deliberately excludes broad words like "talent" or "people" (too many
 * direct-employer false positives) — add specific firms to the registry
 * instead.
 */
export const RECRUITER_NAME_PATTERNS: RegExp[] = [
  /\brecruitment\b/i,
  /\brecruiters?\b/i,
  /\brecruiting\b/i,
  /\brecruit\b/i,
  /\bstaffing\b/i,
  /\bheadhunt(?:ers?|ing)?\b/i,
  /\bsearch\s*(?:&|and)\s*selection\b/i,
  /\bexecutive\s+search\b/i,
  /\bresourcing\b/i,
  /\btalent\s+(?:acquisition\s+)?(?:partners?|agency|solutions)\b/i,
];

/**
 * Website/about-page phrases that identify a recruitment firm. STRONG signals
 * classify on a single hit; WEAK signals need two distinct hits. All matched
 * case-insensitively against whatever description text is available.
 */
export const RECRUITER_TEXT_SIGNALS_STRONG: string[] = [
  "recruitment agency",
  "recruitment consultancy",
  "recruitment firm",
  "staffing solutions",
  "staffing agency",
  "employment agency",
  "employment business",
  "executive search firm",
  "on behalf of our client",
  "on behalf of a client",
  "recruiting on behalf of",
  "we are recruiting for our client",
  "acting as an employment agency",
  "acting as an employment business",
  "specialist recruitment consultancy",
  "specialist recruiters",
];

export const RECRUITER_TEXT_SIGNALS_WEAK: string[] = [
  "our client",
  "executive search",
  "temp and perm",
  "temporary and permanent",
  "we are recruiting for",
  "our client base",
  "candidates and clients",
];
