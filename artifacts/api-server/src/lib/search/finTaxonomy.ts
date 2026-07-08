/**
 * Financial-services taxonomy for search and matching.
 *
 * Pure configuration — no logic. Extend the term lists and rule tables below
 * to teach the classifier and ranker new financial-services vocabulary.
 *
 * Terms are matched case-insensitively on word boundaries. "strong" terms are
 * unambiguous for the sector (a single title hit is enough to classify);
 * "contextual" terms are suggestive but need at least one more hit somewhere
 * before they count (avoids tagging generic roles like "analyst" or "broker"
 * used outside financial services).
 */

export const FIN_SECTORS = [
  "insurance",
  "banking",
  "pensions",
  "asset_management",
  "accountancy_finance",
] as const;
export type FinSector = (typeof FIN_SECTORS)[number];

export const FIN_FUNCTIONS = [
  "underwriting",
  "claims",
  "broking",
  "actuarial",
  "compliance",
  "risk",
  "operations",
  "investments",
  "pensions_admin",
  "client_service",
  "finance",
] as const;
export type FinFunction = (typeof FIN_FUNCTIONS)[number];

export const EMPLOYER_TYPES = [
  "insurer",
  "broker",
  "mga",
  "reinsurer",
  "bank",
  "pension_consultancy",
  "asset_manager",
  "wealth_manager",
] as const;
export type EmployerType = (typeof EMPLOYER_TYPES)[number];

export interface SectorTerms {
  strong: string[];
  contextual: string[];
}

export const SECTOR_TERMS: Record<FinSector, SectorTerms> = {
  insurance: {
    strong: [
      "underwriter",
      "underwriting",
      "bordereaux",
      "delegated authority",
      "binder",
      "lloyd's",
      "lloyds of london",
      "syndicate",
      "mga",
      "managing general agent",
      "reinsurance",
      "treaty",
      "facultative",
      "catastrophe modelling",
      "catastrophe modeling",
      "exposure management",
      "claims handler",
      "claims adjuster",
      "claims technician",
      "broking technician",
      "policy wordings",
      "insurer",
      "insurance",
      "actuary",
      "actuarial",
      "reserving",
      "pricing actuary",
    ],
    contextual: [
      "claims",
      "broker",
      "broking",
      "account handler",
      "wordings",
      "premium",
      "cover holder",
      "coverholder",
    ],
  },
  banking: {
    strong: [
      "kyc",
      "know your customer",
      "aml",
      "anti money laundering",
      "sanctions screening",
      "bank",
      "banking",
      "treasury",
      "liquidity risk",
      "alm",
      "asset liability management",
      "credit risk",
      "market risk",
      "operational risk",
      "front office",
      "middle office",
      "back office",
    ],
    contextual: [
      "onboarding",
      "sanctions",
      "payments",
      "financial crime",
      "capital markets",
      "trading desk",
      // Shared operations vocabulary (also common in asset management) —
      // needs corroboration before it can tag a job as banking.
      "settlements",
      "reconciliations",
      "custody",
    ],
  },
  pensions: {
    strong: [
      "pensions administrator",
      "pension administrator",
      "pensions administration",
      "pensions consultant",
      "pension scheme",
      "sipp",
      "ssas",
      "defined benefit",
      "defined contribution",
      "db pension",
      "dc pension",
      "trustee",
      "scheme events",
      "auto enrolment",
      "auto enrollment",
    ],
    contextual: [
      "pensions",
      "pension",
      "employee benefits",
      "governance",
      "implementation consultant",
      "final salary",
    ],
  },
  asset_management: {
    strong: [
      "fund accountant",
      "fund accounting",
      "fund controller",
      "investment operations",
      "fund operations",
      "transfer agency",
      "portfolio analyst",
      "performance analyst",
      "investment risk",
      "asset management",
      "asset manager",
      "fund manager",
      "portfolio manager",
      "client reporting",
      "esg analyst",
      "dealing desk",
      "nav",
    ],
    contextual: [
      "fund",
      "funds",
      "investments",
      "investment",
      "rfp",
      "product specialist",
      "dealing",
      "esg",
      "wealth management",
    ],
  },
  accountancy_finance: {
    strong: [
      "accountancy practice",
      "chartered accountant",
      "bookkeeper",
      "bookkeeping",
      "payroll",
      "financial accountant",
      "management accountant",
      "fp&a",
      "financial planning and analysis",
      "accounts payable",
      "accounts receivable",
      "credit controller",
      "audit senior",
      "tax manager",
      "tax consultant",
      "vat",
      "transfer pricing",
      "statutory accounts",
      "forensic accountant",
      "finance business partner",
    ],
    contextual: [
      "accountant",
      "audit",
      "tax",
      "billing",
      "ledger",
      "month end",
      "year end",
      "acca",
      "cima",
    ],
  },
};

/**
 * Function classification terms. First hit in the title wins over hits in
 * weaker fields; order within each list does not matter.
 */
export const FUNCTION_TERMS: Record<FinFunction, string[]> = {
  underwriting: [
    "underwriter",
    "underwriting",
    "assistant underwriter",
    "trading underwriter",
    "binder",
    "delegated authority",
    "bordereaux",
  ],
  claims: [
    "claims handler",
    "claims adjuster",
    "claims technician",
    "claims examiner",
    "claims",
    "loss adjuster",
  ],
  broking: [
    "broker",
    "broking",
    "broking technician",
    "account handler",
    "account executive",
    "placement",
  ],
  actuarial: [
    "actuary",
    "actuarial",
    "pricing actuary",
    "reserving actuary",
    "reserving",
    "catastrophe modelling",
    "catastrophe modeling",
    "exposure management",
  ],
  compliance: [
    "compliance",
    "kyc",
    "know your customer",
    "aml",
    "anti money laundering",
    "sanctions",
    "financial crime",
    "onboarding",
    "regulatory",
  ],
  risk: [
    "credit risk",
    "market risk",
    "operational risk",
    "liquidity risk",
    "investment risk",
    "risk analyst",
    "risk manager",
    "risk officer",
  ],
  operations: [
    "operations",
    "settlements",
    "reconciliations",
    "custody",
    "middle office",
    "back office",
    "transfer agency",
    "dealing",
    "scheme events",
    "investment operations",
    "fund operations",
  ],
  investments: [
    "portfolio manager",
    "fund manager",
    "investment manager",
    "portfolio analyst",
    "investment analyst",
    "esg analyst",
    "performance analyst",
    "treasury",
  ],
  pensions_admin: [
    "pensions administrator",
    "pension administrator",
    "pensions administration",
    "pensions admin",
    "sipp administrator",
    "ssas administrator",
  ],
  client_service: [
    "client reporting",
    "client service",
    "client services",
    "rfp",
    "product specialist",
    "relationship manager",
    "client onboarding",
  ],
  finance: [
    "fund accountant",
    "fund accounting",
    "fund controller",
    "financial accountant",
    "finance",
    "financial reporting",
  ],
};

/** Which sectors each function most plausibly belongs to (used as a tiebreak). */
export const FUNCTION_SECTOR_AFFINITY: Partial<Record<FinFunction, FinSector[]>> = {
  underwriting: ["insurance"],
  claims: ["insurance"],
  broking: ["insurance"],
  actuarial: ["insurance", "pensions"],
  pensions_admin: ["pensions"],
  investments: ["asset_management", "banking"],
};

export interface EmployerTypeRule {
  type: EmployerType;
  /** Case-insensitive substrings matched against the company name. */
  nameKeywords: string[];
}

/**
 * Rule-based employer classification, evaluated top to bottom — first match
 * wins, so more specific rules (mga, reinsurer) come before generic ones.
 */
export const EMPLOYER_TYPE_RULES: EmployerTypeRule[] = [
  { type: "reinsurer", nameKeywords: ["reinsurance", " re ", "swiss re", "munich re", "hannover re", "scor"] },
  { type: "mga", nameKeywords: ["mga", "managing general", "underwriting agency", "coverholder"] },
  {
    type: "broker",
    nameKeywords: ["broker", "broking", "marsh", "aon", "willis towers watson", "wtw", "gallagher", "howden", "lockton", "miller insurance", "bms group"],
  },
  {
    type: "insurer",
    nameKeywords: ["insurance", "insurer", "assurance", "underwriters", "syndicate", "aviva", "axa", "allianz", "zurich", "hiscox", "beazley", "chubb", "rsa", "direct line", "admiral group", "lv=", "aig", "qbe", "markel", "lancashire", "brit ", "atrium", "canopius", "tokio marine"],
  },
  {
    type: "pension_consultancy",
    nameKeywords: ["pension", "pensions", "xps", "barnett waddingham", "hymans robertson", "lcp", "lane clark", "isio", "broadstone", "first actuarial", "mercer", "buck ", "gallagher benefit"],
  },
  {
    type: "wealth_manager",
    nameKeywords: ["wealth", "st. james's place", "st james's place", "rathbones", "brewin dolphin", "evelyn partners", "quilter", "charles stanley", "tilney"],
  },
  {
    type: "asset_manager",
    nameKeywords: ["asset management", "investment management", "investments", "fund managers", "capital partners", "blackrock", "schroders", "abrdn", "fidelity", "vanguard", "m&g", "legal & general investment", "lgim", "baillie gifford", "janus henderson", "jupiter", "invesco", "state street", "northern trust", "bny mellon", "amundi", "t. rowe price", "man group"],
  },
  {
    type: "bank",
    nameKeywords: ["bank", "banking", "hsbc", "barclays", "natwest", "lloyds", "santander", "monzo", "starling", "revolut", "goldman sachs", "jpmorgan", "j.p. morgan", "morgan stanley", "citi", "ubs", "deutsche", "bnp paribas", "societe generale", "credit suisse", "standard chartered", "nationwide"],
  },
];

/** Sector each employer type belongs to (for sector alignment boosts). */
export const EMPLOYER_TYPE_SECTOR: Record<EmployerType, FinSector> = {
  insurer: "insurance",
  broker: "insurance",
  mga: "insurance",
  reinsurer: "insurance",
  bank: "banking",
  pension_consultancy: "pensions",
  asset_manager: "asset_management",
  wealth_manager: "asset_management",
};
