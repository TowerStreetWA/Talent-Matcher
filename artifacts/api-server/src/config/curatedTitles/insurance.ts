import type { CuratedTitleEntry } from "./types";

/**
 * Curated insurance job titles (full supplied list, structured).
 *
 * ── HOW TO EXTEND ──────────────────────────────────────────────────────────
 * PASTE ADDITIONAL TITLES HERE: add one entry per canonical title, following
 * the shape below. Keep variants lowercase-insensitive (matching ignores
 * case/punctuation). `industry` must be a FinSector and `family` a
 * FinFunction from lib/search/finTaxonomy.ts; `tags` are free-form finer
 * groupings (executive_leadership, reinsurance, ...). New industries get
 * their own file next to this one (e.g. banking.ts) — export it from
 * index.ts. No code changes are needed: search synonyms and vacancy
 * classification pick these up automatically.
 *
 * FALSE-POSITIVE RULE: titles that also exist outside insurance (e.g.
 * "Chief Risk Officer", "Operational Risk Manager", "Distribution Manager",
 * "Head of Pricing", "Sales Agent") are only included with an "insurance"
 * qualifier so a bank or logistics vacancy is never force-tagged insurance.
 * Single-word variants (e.g. "uw", "adjuster") only ever match exactly.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const INSURANCE_TITLES: CuratedTitleEntry[] = [
  // ── Executive leadership ─────────────────────────────────────────────────
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Chief Insurance Officer",
    variants: ["head of insurance", "insurance director", "director of insurance"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Chief Underwriting Officer",
    variants: ["cuo"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Chief Claims Officer",
    variants: [],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Chief Risk Officer (Insurance)",
    variants: ["chief risk officer insurance", "insurance chief risk officer"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Chief Actuary",
    variants: ["chief actuarial officer"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Chief Broking Officer",
    variants: ["head of broking", "head of insurance placement", "head of placement insurance"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Chief Distribution Officer",
    variants: [],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "compliance",
    canonicalTitle: "Chief Compliance Officer (Insurance)",
    variants: ["chief compliance officer insurance"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Head of Underwriting",
    variants: ["underwriting director"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Head of Claims",
    variants: ["claims director"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Head of Actuarial",
    variants: ["head of pricing insurance", "head of insurance pricing"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Head of Risk (Insurance)",
    variants: ["head of risk insurance", "head of enterprise risk management insurance"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Head of Loss Control",
    variants: ["head of risk engineering"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "insurance",
    family: "client_service",
    canonicalTitle: "Head of Product (Insurance)",
    variants: ["head of product insurance", "head of insurance product"],
    seniority: "executive",
    tags: ["executive_leadership", "product_marketing"],
  },

  // ── Underwriting ─────────────────────────────────────────────────────────
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Underwriter",
    variants: [
      "insurance underwriter",
      "uw",
      "underwriting specialist",
      "line underwriter",
      "product underwriter",
      "technical underwriter",
    ],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Assistant Underwriter",
    variants: [
      "underwriting assistant",
      "junior underwriter",
      "trainee underwriter",
      "underwriting technician",
      "uw assistant",
    ],
    seniority: "junior",
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Senior Underwriter",
    variants: ["lead underwriter", "principal underwriter", "senior insurance underwriter"],
    seniority: "senior",
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Underwriting Manager",
    variants: ["underwriting team leader", "underwriting supervisor"],
    seniority: "senior",
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Portfolio Underwriter",
    variants: ["portfolio manager underwriting"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Commercial Underwriter",
    variants: ["commercial lines underwriter"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Personal Lines Underwriter",
    variants: [],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Specialty Underwriter",
    variants: ["specialty lines underwriter"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Motor Underwriter",
    variants: ["auto underwriter"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Property Underwriter",
    variants: [],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Casualty Underwriter",
    variants: ["liability underwriter"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Marine Underwriter",
    variants: [],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Aviation Underwriter",
    variants: [],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Energy Underwriter",
    variants: [],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Cyber Underwriter",
    variants: [],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Agriculture Underwriter",
    variants: ["agricultural underwriter"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Financial Lines Underwriter",
    variants: [],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Medical Underwriter",
    variants: ["life underwriter", "health underwriter"],
    tags: ["health_medical_specialist"],
  },

  // ── Actuarial ────────────────────────────────────────────────────────────
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Actuary",
    variants: ["general insurance actuary", "non life actuary", "life actuary"],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Trainee Actuary",
    variants: [
      "actuarial trainee",
      "graduate actuarial analyst",
      "graduate actuary",
      "actuarial student",
    ],
    seniority: "junior",
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Actuarial Analyst",
    variants: ["senior actuarial analyst", "actuarial associate"],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Pricing Actuary",
    variants: ["pricing analyst insurance", "senior pricing analyst insurance"],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Reserving Actuary",
    variants: ["reserving analyst"],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Capital Actuary",
    variants: ["capital modelling actuary", "capital modeling actuary"],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Risk Actuary",
    variants: [],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Actuarial Consultant",
    variants: [],
  },
  {
    industry: "insurance",
    family: "actuarial",
    canonicalTitle: "Actuarial Manager",
    variants: [],
    seniority: "senior",
  },
  // "Pensions Actuary" moved to pensions.ts (actuarial_risk family).

  // ── Claims ───────────────────────────────────────────────────────────────
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Claims Handler",
    variants: [
      "claims advisor",
      "claims adviser",
      "claims representative",
      "claims technician",
      "claims negotiator",
    ],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Claims Adjuster",
    variants: ["adjuster", "insurance adjuster", "field adjuster", "field claims adjuster"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Claims Examiner",
    variants: ["claims assessor"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Claims Analyst",
    variants: [],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Claims Investigator",
    variants: [
      "insurance investigator",
      "insurance fraud investigator",
      "special investigations unit investigator",
      "siu investigator",
    ],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Loss Adjuster",
    variants: ["loss adjustor", "chartered loss adjuster", "major loss adjuster"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Senior Claims Handler",
    variants: ["senior claims adjuster"],
    seniority: "senior",
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Claims Manager",
    variants: ["claims team leader", "claims supervisor", "claims team manager"],
    seniority: "senior",
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Claims Consultant",
    variants: [],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "FNOL Claims Handler",
    variants: ["first notification of loss handler", "fnol handler"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Motor Claims Handler",
    variants: ["motor claims engineer", "auto claims handler"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Property Claims Handler",
    variants: [],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Casualty Claims Handler",
    variants: ["liability claims handler"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Personal Injury Claims Handler",
    variants: [],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Complex Claims Adjuster",
    variants: [],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Catastrophe Claims Adjuster",
    variants: ["cat adjuster", "catastrophe adjuster"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "PPI Claims Handler",
    variants: [],
  },

  // ── Broking & distribution ───────────────────────────────────────────────
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Insurance Broker",
    variants: [
      "commercial insurance broker",
      "corporate insurance broker",
      "account broker",
      "placing broker",
      "broking executive",
    ],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Wholesale Broker",
    variants: [],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Insurance Agent",
    variants: [
      "insurance producer",
      "captive insurance agent",
      "independent insurance agent",
      "insurance sales agent",
    ],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Health Insurance Agent",
    variants: ["life insurance agent"],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Insurance Advisor",
    variants: ["insurance adviser"],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Protection Adviser (Insurance)",
    variants: [
      "insurance protection adviser",
      "protection insurance adviser",
      "protection insurance advisor",
      "financial adviser protection",
      "mortgage and protection adviser",
    ],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Employee Benefits Consultant",
    variants: ["employee benefits broker"],
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
    family: "broking",
    canonicalTitle: "Business Development Manager (Insurance)",
    variants: [
      "insurance business development manager",
      "business development manager insurance",
      "new business executive insurance",
    ],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Distribution Manager (Insurance)",
    variants: [
      "insurance distribution manager",
      "distribution manager insurance",
      "regional distribution manager insurance",
    ],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Affinity Partnerships Manager (Insurance)",
    variants: ["affinity partnerships manager insurance", "affinity partnerships manager"],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Bancassurance Manager",
    variants: ["bancassurance specialist"],
  },

  // ── Sales & account management ───────────────────────────────────────────
  {
    industry: "insurance",
    family: "client_service",
    canonicalTitle: "Insurance Sales Executive",
    variants: [
      "insurance sales representative",
      "insurance sales manager",
      "telesales executive insurance",
    ],
    tags: ["sales_account_management"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Insurance Customer Service Agent",
    variants: [
      "customer service representative insurance",
      "call centre agent insurance",
      "policy service representative",
      "client services executive insurance",
    ],
    tags: ["sales_account_management"],
  },
  {
    industry: "insurance",
    family: "client_service",
    canonicalTitle: "Account Manager (Insurance)",
    variants: [
      "insurance account manager",
      "key account manager insurance",
      "corporate account manager insurance",
      "client relationship manager insurance",
      "insurance account executive",
      "insurance account handler",
    ],
    tags: ["sales_account_management"],
  },
  {
    industry: "insurance",
    family: "client_service",
    canonicalTitle: "Retention Specialist (Insurance)",
    variants: ["retention specialist insurance", "renewals executive", "renewal specialist insurance"],
    tags: ["sales_account_management"],
  },

  // ── Risk & compliance ────────────────────────────────────────────────────
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Risk Manager (Insurance)",
    variants: [
      "insurance risk manager",
      "risk manager insurance",
      "enterprise risk manager insurance",
      "operational risk manager insurance",
      "credit risk manager insurance",
    ],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Insurance Risk Analyst",
    variants: [
      "risk analyst insurance",
      "financial risk specialist insurance",
      "exposure management analyst",
    ],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Loss Control Specialist",
    variants: ["loss control consultant"],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Risk Engineer",
    variants: ["risk control engineer", "insurance risk engineer"],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Insurance Risk Surveyor",
    variants: ["risk surveyor"],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Health and Safety Risk Consultant (Insurance)",
    variants: ["health and safety risk consultant insurance"],
  },
  {
    industry: "insurance",
    family: "compliance",
    canonicalTitle: "Insurance Compliance Officer",
    variants: [
      "compliance officer insurance",
      "regulatory compliance manager insurance",
      "regulatory compliance analyst insurance",
    ],
  },
  {
    industry: "insurance",
    family: "compliance",
    canonicalTitle: "Conduct Risk Manager (Insurance)",
    variants: ["conduct risk manager insurance", "insurance conduct risk manager"],
  },
  {
    industry: "insurance",
    family: "compliance",
    canonicalTitle: "Sanctions Screening Specialist (Insurance)",
    variants: ["sanctions screening specialist insurance", "financial crime officer insurance"],
  },
  {
    industry: "insurance",
    family: "compliance",
    canonicalTitle: "Complaints Handler (Insurance)",
    variants: ["insurance complaints handler", "complaints handler insurance", "complaints manager insurance"],
  },

  // ── Product & marketing ──────────────────────────────────────────────────
  {
    industry: "insurance",
    family: "client_service",
    canonicalTitle: "Product Manager (Insurance)",
    variants: [
      "insurance product manager",
      "product manager insurance",
      "insurance product owner",
      "insurance product analyst",
      "insurance policy development manager",
    ],
    tags: ["product_marketing"],
  },
  {
    industry: "insurance",
    family: "client_service",
    canonicalTitle: "Proposition Manager (Insurance)",
    variants: ["insurance proposition manager", "proposition manager insurance"],
    tags: ["product_marketing"],
  },
  {
    industry: "insurance",
    family: "client_service",
    canonicalTitle: "Insurance Marketing Manager",
    variants: [
      "marketing manager insurance",
      "digital marketing manager insurance",
      "brand manager insurance",
      "distribution marketing manager insurance",
      "market development manager insurance",
    ],
    tags: ["product_marketing"],
  },
  {
    industry: "insurance",
    family: "client_service",
    canonicalTitle: "Customer Insight Analyst (Insurance)",
    variants: ["customer insight analyst insurance", "crm manager insurance"],
    tags: ["product_marketing"],
  },

  // ── Operations & administration ──────────────────────────────────────────
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Insurance Administrator",
    variants: ["insurance administrative assistant", "insurance clerk", "insurance officer"],
    seniority: "junior",
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Policy Administrator",
    variants: [
      "policy processing clerk",
      "insurance policy processing clerk",
      "insurance claims and processing clerk",
      "policy services administrator",
      "policy servicing administrator",
    ],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Documentation Specialist (Insurance)",
    variants: ["documentation specialist insurance", "schedule issuance clerk", "endorsements clerk"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Operations Analyst (Insurance)",
    variants: ["insurance operations analyst", "operations analyst insurance", "insurance operations executive"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Operations Manager (Insurance)",
    variants: [
      "insurance operations manager",
      "operations manager insurance",
      "contact centre manager insurance",
      "business continuity manager insurance",
    ],
    seniority: "senior",
  },

  // ── Finance & investment ─────────────────────────────────────────────────
  {
    industry: "insurance",
    family: "finance",
    canonicalTitle: "Insurance Accountant",
    variants: [
      "financial controller insurance",
      "finance manager insurance",
      "financial analyst insurance",
    ],
    tags: ["finance_investment"],
  },
  {
    industry: "insurance",
    family: "investments",
    canonicalTitle: "Investment Analyst (Insurance)",
    variants: ["investment analyst insurance", "treasury analyst insurance"],
    tags: ["finance_investment"],
  },
  {
    industry: "insurance",
    family: "investments",
    canonicalTitle: "ALM Analyst",
    variants: ["asset liability management analyst", "asset and liability management analyst"],
    tags: ["finance_investment"],
  },
  {
    industry: "insurance",
    family: "finance",
    canonicalTitle: "Capital Management Manager (Insurance)",
    variants: ["capital management manager insurance"],
    tags: ["finance_investment"],
  },

  // ── Data, change & technology ────────────────────────────────────────────
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Insurance Business Analyst",
    variants: [
      "business analyst insurance",
      "business analyst general insurance",
      "business analyst life insurance",
      "systems analyst insurance",
    ],
    tags: ["data_change_technology"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Insurance Data Analyst",
    variants: [
      "data analyst insurance",
      "pricing data analyst",
      "data scientist insurance",
      "mi analyst insurance",
      "reporting analyst insurance",
      "portfolio analyst insurance",
    ],
    tags: ["data_change_technology"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Digital Transformation Manager (Insurance)",
    variants: ["digital transformation manager insurance", "insurance product owner digital"],
    tags: ["data_change_technology"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Underwriting Systems Manager",
    variants: ["policy administration system analyst", "pas analyst"],
    tags: ["data_change_technology"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Guidewire Specialist",
    variants: [
      "guidewire developer",
      "guidewire consultant",
      "duck creek specialist",
      "sapiens specialist",
    ],
    tags: ["data_change_technology"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Insurance Solutions Architect",
    variants: ["insurance implementation consultant", "insurance technology consultant"],
    tags: ["data_change_technology"],
  },

  // ── Health & medical specialist ──────────────────────────────────────────
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Medical Claims Assessor",
    variants: [
      "life and health claims assessor",
      "life & health claims assessor",
      "clinical reviewer insurance",
    ],
    tags: ["health_medical_specialist"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Nurse Case Manager (Insurance)",
    variants: ["nurse case manager insurance", "rehabilitation case manager"],
    tags: ["health_medical_specialist"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Workers' Compensation Specialist",
    variants: ["workers compensation specialist", "disability claims manager"],
    tags: ["health_medical_specialist"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Travel Claims Handler",
    variants: ["pet insurance claims handler"],
    tags: ["health_medical_specialist"],
  },
  {
    industry: "insurance",
    family: "risk",
    canonicalTitle: "Marine Surveyor (Insurance)",
    variants: ["marine surveyor insurance", "aviation surveyor insurance"],
    tags: ["health_medical_specialist"],
  },

  // ── Reinsurance ──────────────────────────────────────────────────────────
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Reinsurance Underwriter",
    variants: ["treaty underwriter", "facultative underwriter", "ri underwriter"],
    tags: ["reinsurance"],
  },
  {
    industry: "insurance",
    family: "broking",
    canonicalTitle: "Reinsurance Broker",
    variants: [],
    tags: ["reinsurance"],
  },
  {
    industry: "insurance",
    family: "underwriting",
    canonicalTitle: "Reinsurance Analyst",
    variants: ["retrocession analyst"],
    tags: ["reinsurance"],
  },
  {
    industry: "insurance",
    family: "operations",
    canonicalTitle: "Reinsurance Technician",
    variants: [],
    tags: ["reinsurance"],
  },
  {
    industry: "insurance",
    family: "claims",
    canonicalTitle: "Reinsurance Claims Specialist",
    variants: ["reinsurance claims handler"],
    tags: ["reinsurance"],
  },
];
