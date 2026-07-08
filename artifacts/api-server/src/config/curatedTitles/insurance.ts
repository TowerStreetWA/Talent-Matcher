import type { CuratedTitleEntry } from "./types";

/**
 * Curated insurance job titles.
 *
 * ── HOW TO EXTEND ──────────────────────────────────────────────────────────
 * PASTE ADDITIONAL TITLES HERE: add one entry per canonical title, following
 * the shape below. Keep variants lowercase-insensitive (matching ignores
 * case/punctuation). `industry` must be a FinSector and `family` a
 * FinFunction from lib/search/finTaxonomy.ts. New industries get their own
 * file next to this one (e.g. banking.ts) — export it from index.ts.
 * No code changes are needed: search synonyms and vacancy classification
 * pick these up automatically.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const INSURANCE_TITLES: CuratedTitleEntry[] = [
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Underwriter",
    variants: ["insurance underwriter", "uw", "underwriting specialist"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Senior Underwriter",
    variants: ["senior insurance underwriter", "lead underwriter"],
    seniority: "senior",
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Underwriting Assistant",
    variants: ["assistant underwriter", "underwriting technician", "uw assistant"],
    seniority: "junior",
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Claims Handler",
    variants: ["claims adjuster", "claims examiner", "claims negotiator", "claims technician"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Claims Manager",
    variants: ["head of claims", "claims team leader", "claims team manager"],
    seniority: "senior",
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Loss Adjuster",
    variants: ["loss adjustor", "chartered loss adjuster"],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Insurance Broker",
    variants: ["commercial insurance broker", "account broker", "placing broker"],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Account Executive (Insurance)",
    variants: ["insurance account executive", "commercial account executive", "account handler"],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Broker Support Technician",
    variants: ["broking technician", "insurance technician", "broker support"],
    seniority: "junior",
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Actuarial Analyst",
    variants: ["actuarial associate", "trainee actuary", "actuarial student"],
    seniority: "junior",
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Pricing Actuary",
    variants: ["pricing analyst insurance", "actuarial pricing manager"],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Reserving Actuary",
    variants: ["reserving analyst", "actuarial reserving manager"],
  },
  {
    industry: "insurance",
    family: "compliance",
    canonicalTitle: "Insurance Compliance Officer",
    variants: ["compliance officer insurance", "regulatory compliance analyst insurance"],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Insurance Risk Analyst",
    variants: ["risk analyst insurance", "insurance risk manager", "exposure management analyst"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Insurance Operations Analyst",
    variants: ["insurance operations executive", "policy administrator", "policy servicing administrator"],
  },
];
