/**
 * Recruiter-domain dictionaries for query normalization.
 * Keep these explicit and data-driven: extend the maps/groups below to teach
 * search new shorthand without touching normalization or ranking logic.
 *
 * Insurance-domain abbreviations and synonyms are auto-derived from
 * insuranceSynonyms.ts — do not duplicate them here manually.
 */
import { INSURANCE_SYNONYMS } from "./insuranceSynonyms";

/** Shorthand token -> list of expanded phrases it may mean. */
export const ABBREVIATIONS: Record<string, string[]> = {
  swe: ["software engineer"],
  sde: ["software engineer"],
  se: ["software engineer"],
  dev: ["developer"],
  eng: ["engineer"],
  fe: ["frontend"],
  be: ["backend"],
  fs: ["full stack"],
  pm: ["product manager", "project manager"],
  po: ["product owner"],
  em: ["engineering manager"],
  qa: ["quality assurance", "qa automation"],
  ba: ["business analyst"],
  da: ["data analyst"],
  ds: ["data scientist"],
  ml: ["machine learning"],
  ai: ["machine learning", "artificial intelligence"],
  sre: ["site reliability engineer"],
  devops: ["devops engineer"],
  ux: ["user experience", "product designer"],
  ui: ["user interface", "product designer"],
  hr: ["human resources"],
  hrbp: ["human resources business partner"],
  ta: ["talent acquisition"],
  gl: ["general ledger"],
  ap: ["accounts payable"],
  ar: ["accounts receivable"],
  fpa: ["financial planning and analysis"],
  cpa: ["accountant"],
  rn: ["registered nurse"],
  js: ["javascript"],
  ts: ["typescript"],
  py: ["python"],
  k8s: ["kubernetes"],
  infosec: ["security engineer"],
  cs: ["customer success"],
  csm: ["customer success manager"],
  bd: ["business development"],
  bdr: ["business development representative"],
  sdr: ["sales development representative"],
  ae: ["account executive"],
  // Financial services shorthand
  kyc: ["know your customer"],
  aml: ["anti money laundering"],
  alm: ["asset liability management"],
  mga: ["managing general agent"],
  db: ["defined benefit"],
  dc: ["defined contribution"],
  sipp: ["self invested personal pension"],
  ssas: ["small self administered scheme"],
  rfp: ["request for proposal"],
  esg: ["esg analyst", "environmental social governance"],
  uw: ["underwriter", "underwriting"],
  ri: ["reinsurance"],
  // Insurance-domain abbreviations — derived from INSURANCE_SYNONYMS
  ...Object.fromEntries(
    Object.entries(INSURANCE_SYNONYMS).flatMap(([canonical, aliases]) =>
      aliases
        .filter((a) => a.length <= 6 && /^[A-Z&/]+$/.test(a))
        .map((abbr) => [abbr.toLowerCase().replace(/&/g, "and").replace(/\//g, ""), [canonical.toLowerCase()]]),
    ),
  ),
};

/**
 * Groups of interchangeable title/role terms. Any member of a group expands
 * the query to also try the other members.
 */
export const SYNONYM_GROUPS: string[][] = [
  ["developer", "engineer", "programmer"],
  ["frontend", "front end", "front-end"],
  ["backend", "back end", "back-end"],
  ["full stack", "fullstack", "full-stack"],
  ["software engineer", "software developer"],
  ["quality assurance", "qa", "test engineer", "tester"],
  ["site reliability engineer", "sre", "platform engineer"],
  ["machine learning", "ml"],
  ["data scientist", "data science"],
  ["product designer", "ux designer", "ui designer"],
  ["engineering manager", "development manager"],
  ["accountant", "accounting"],
  ["general ledger", "gl accountant"],
  ["talent acquisition", "recruiter", "recruitment"],
  ["human resources", "people operations", "people ops"],
  ["customer success", "account management"],
  ["javascript", "js"],
  ["typescript", "ts"],
  // Financial services title/role groups
  ["underwriter", "underwriting"],
  ["assistant underwriter", "underwriting assistant", "trading underwriter"],
  ["claims handler", "claims adjuster", "claims technician"],
  ["broker", "broking technician", "account handler"],
  ["delegated authority", "da analyst", "binder technician"],
  ["bordereaux", "bordereaux analyst", "bordereau"],
  ["actuary", "actuarial"],
  ["catastrophe modelling", "catastrophe modeling", "cat modelling", "exposure management"],
  ["reinsurance", "treaty reinsurance", "facultative reinsurance"],
  ["know your customer", "kyc analyst", "client onboarding"],
  ["anti money laundering", "aml analyst", "financial crime"],
  ["settlements", "reconciliations"],
  ["pensions administrator", "pension administrator", "pensions admin"],
  ["pensions consultant", "pension consultant"],
  ["defined benefit", "final salary"],
  ["employee benefits", "benefits consultant"],
  ["fund accountant", "fund accounting", "fund controller"],
  ["investment operations", "fund operations", "asset management operations"],
  ["transfer agency", "ta operations"],
  ["portfolio analyst", "investment analyst"],
  ["client reporting", "investment reporting"],
  // Insurance synonym groups — derived from INSURANCE_SYNONYMS
  ...Object.entries(INSURANCE_SYNONYMS).map(([canonical, aliases]) => [
    canonical.toLowerCase(),
    ...aliases.map((a) => a.toLowerCase()),
  ]),
];

/** Words that carry no search intent on their own. */
export const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "or",
  "the",
  "to",
  "with",
]);
