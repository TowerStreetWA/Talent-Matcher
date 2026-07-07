import { z } from "zod/v4";

const COMPANIES_HOUSE_BASE_URL = "https://api.company-information.service.gov.uk";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_SEARCH_RESULTS = 5;

export type CompaniesHouseErrorKind =
  | "config"
  | "invalid_input"
  | "not_found"
  | "rate_limited"
  | "upstream"
  | "timeout";

export class CompaniesHouseError extends Error {
  readonly kind: CompaniesHouseErrorKind;

  constructor(kind: CompaniesHouseErrorKind, message: string) {
    super(message);
    this.name = "CompaniesHouseError";
    this.kind = kind;
  }
}

/**
 * Recruiter-readable descriptions for SIC codes commonly seen on hiring
 * companies. Checked before falling back to the division-level table.
 */
const CURATED_SIC_CODES: Record<string, string> = {
  "62012": "Business & domestic software development",
  "62020": "IT consultancy",
  "62090": "Other IT & computer services",
  "63110": "Data processing, hosting & related activities",
  "63120": "Web portals",
  "58290": "Other software publishing",
  "62011": "Ready-made interactive leisure & entertainment software",
  "64110": "Central banking",
  "64191": "Banks",
  "64205": "Financial holding companies",
  "64303": "Investment trusts / venture capital",
  "64999": "Other financial services (not insurance/pensions)",
  "66190": "Financial intermediation support services",
  "66300": "Fund management",
  "69101": "Barristers",
  "69102": "Solicitors",
  "69201": "Accounting & auditing",
  "70221": "Financial management consultancy",
  "70229": "Management consultancy (other)",
  "71121": "Engineering design for industrial processes",
  "72190": "R&D in natural sciences & engineering",
  "73110": "Advertising agencies",
  "74909": "Other professional, scientific & technical activities",
  "78101": "Motion picture, TV & other theatrical casting",
  "78109": "Recruitment agency / employment placement",
  "78200": "Temporary staffing agency",
  "78300": "HR provision & management of HR functions",
  "82990": "Other business support services",
  "86101": "Hospital activities",
  "85421": "First-degree level higher education",
};

/**
 * UK SIC 2007 division (first two digits) -> readable sector label. Used
 * when a code is not in the curated map so every SIC code gets a
 * human-readable description.
 */
const SIC_DIVISIONS: Record<string, string> = {
  "01": "Agriculture & farming",
  "02": "Forestry & logging",
  "03": "Fishing & aquaculture",
  "05": "Coal mining",
  "06": "Oil & gas extraction",
  "07": "Metal ore mining",
  "08": "Other mining & quarrying",
  "09": "Mining support services",
  "10": "Food manufacturing",
  "11": "Beverage manufacturing",
  "12": "Tobacco products",
  "13": "Textile manufacturing",
  "14": "Apparel manufacturing",
  "15": "Leather goods manufacturing",
  "16": "Wood products manufacturing",
  "17": "Paper products manufacturing",
  "18": "Printing & recorded media",
  "19": "Coke & refined petroleum",
  "20": "Chemicals manufacturing",
  "21": "Pharmaceuticals manufacturing",
  "22": "Rubber & plastics manufacturing",
  "23": "Non-metallic mineral products",
  "24": "Basic metals manufacturing",
  "25": "Fabricated metal products",
  "26": "Electronics & computer manufacturing",
  "27": "Electrical equipment manufacturing",
  "28": "Machinery & equipment manufacturing",
  "29": "Motor vehicle manufacturing",
  "30": "Other transport equipment",
  "31": "Furniture manufacturing",
  "32": "Other manufacturing",
  "33": "Repair & installation of machinery",
  "35": "Energy supply (electricity & gas)",
  "36": "Water supply",
  "37": "Sewerage",
  "38": "Waste collection & recycling",
  "39": "Environmental remediation",
  "41": "Construction of buildings",
  "42": "Civil engineering",
  "43": "Specialised construction",
  "45": "Motor vehicle trade & repair",
  "46": "Wholesale trade",
  "47": "Retail trade",
  "49": "Land transport & logistics",
  "50": "Water transport",
  "51": "Air transport",
  "52": "Warehousing & transport support",
  "53": "Postal & courier services",
  "55": "Accommodation & hotels",
  "56": "Food & beverage service",
  "58": "Publishing",
  "59": "Film, TV & music production",
  "60": "Broadcasting",
  "61": "Telecommunications",
  "62": "Software & IT services",
  "63": "Information services",
  "64": "Financial services",
  "65": "Insurance & pensions",
  "66": "Financial support services",
  "68": "Real estate",
  "69": "Legal & accounting",
  "70": "Head offices & management consultancy",
  "71": "Architecture & engineering",
  "72": "Scientific research & development",
  "73": "Advertising & market research",
  "74": "Other professional & technical services",
  "75": "Veterinary services",
  "77": "Rental & leasing",
  "78": "Recruitment & employment services",
  "79": "Travel & tour operators",
  "80": "Security & investigation",
  "81": "Facilities & landscaping services",
  "82": "Office & business support services",
  "84": "Public administration & defence",
  "85": "Education",
  "86": "Healthcare",
  "87": "Residential care",
  "88": "Social work",
  "90": "Arts & entertainment",
  "91": "Libraries, museums & culture",
  "92": "Gambling & betting",
  "93": "Sports & recreation",
  "94": "Membership organisations",
  "95": "Repair of goods",
  "96": "Other personal services",
  "97": "Household employers",
  "99": "International organisations",
};

/** Translate a raw SIC code into a recruiter-readable description. */
export function describeSicCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed === "99999") return "Dormant company";
  if (trimmed === "74990") return "Non-trading company";
  const curated = CURATED_SIC_CODES[trimmed];
  if (curated) return curated;
  const division = SIC_DIVISIONS[trimmed.padStart(5, "0").slice(0, 2)];
  return division ?? "Unclassified";
}

const COMPANY_NUMBER_PATTERN = /^[A-Za-z0-9]{6,10}$/;

export function normalizeCompanyNumber(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!COMPANY_NUMBER_PATTERN.test(trimmed)) {
    throw new CompaniesHouseError("invalid_input", "Invalid company number");
  }
  return trimmed;
}

const searchItemSchema = z
  .object({
    company_number: z.string(),
    title: z.string(),
    company_status: z.string().nullish(),
    company_type: z.string().nullish(),
    date_of_creation: z.string().nullish(),
    address_snippet: z.string().nullish(),
  })
  .loose();

const searchResponseSchema = z
  .object({ items: z.array(searchItemSchema.loose()).nullish() })
  .loose();

const profileResponseSchema = z
  .object({
    company_name: z.string(),
    company_number: z.string(),
    company_status: z.string().nullish(),
    type: z.string().nullish(),
    jurisdiction: z.string().nullish(),
    date_of_creation: z.string().nullish(),
    sic_codes: z.array(z.string()).nullish(),
    registered_office_address: z.object({ locality: z.string().nullish() }).loose().nullish(),
    accounts: z
      .object({
        last_accounts: z.object({ made_up_to: z.string().nullish() }).loose().nullish(),
      })
      .loose()
      .nullish(),
  })
  .loose();

export interface CompanySearchItem {
  companyNumber: string;
  name: string;
  status: string | null;
  companyType: string | null;
  incorporationDate: string | null;
  addressSnippet: string | null;
}

export interface CompanyProfileResult {
  companyNumber: string;
  name: string;
  status: string | null;
  companyType: string | null;
  jurisdiction: string | null;
  incorporationDate: string | null;
  sicCodes: Array<{ code: string; description: string }>;
  registeredOfficeLocality: string | null;
  lastAccountsDate: string | null;
}

function apiKey(): string {
  const key = process.env["COMPANIES_HOUSE_API_KEY"]?.trim();
  if (!key) {
    throw new CompaniesHouseError("config", "COMPANIES_HOUSE_API_KEY is not configured");
  }
  return key;
}

async function companiesHouseGet(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${COMPANIES_HOUSE_BASE_URL}${path}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey()}:`).toString("base64")}`,
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof CompaniesHouseError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new CompaniesHouseError("timeout", "Companies House request timed out");
    }
    throw new CompaniesHouseError("upstream", "Could not reach Companies House");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    throw new CompaniesHouseError("not_found", "Company not found");
  }
  if (response.status === 429) {
    throw new CompaniesHouseError(
      "rate_limited",
      "Companies House rate limit reached — try again in a few minutes",
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new CompaniesHouseError("config", "Companies House rejected the API key");
  }
  if (!response.ok) {
    throw new CompaniesHouseError("upstream", `Companies House error (HTTP ${response.status})`);
  }
  try {
    return await response.json();
  } catch {
    throw new CompaniesHouseError("upstream", "Companies House returned an invalid response");
  }
}

export async function searchCompanies(query: string): Promise<CompanySearchItem[]> {
  const data = await companiesHouseGet(
    `/search/companies?q=${encodeURIComponent(query)}&items_per_page=${MAX_SEARCH_RESULTS}`,
  );
  const parsed = searchResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new CompaniesHouseError("upstream", "Companies House returned an unexpected shape");
  }
  return (parsed.data.items ?? []).slice(0, MAX_SEARCH_RESULTS).map((item) => ({
    companyNumber: item.company_number,
    name: item.title,
    status: item.company_status ?? null,
    companyType: item.company_type ?? null,
    incorporationDate: item.date_of_creation ?? null,
    addressSnippet: item.address_snippet ?? null,
  }));
}

export async function getCompanyProfile(companyNumber: string): Promise<CompanyProfileResult> {
  const data = await companiesHouseGet(`/company/${encodeURIComponent(companyNumber)}`);
  const parsed = profileResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new CompaniesHouseError("upstream", "Companies House returned an unexpected shape");
  }
  const p = parsed.data;
  return {
    companyNumber: p.company_number,
    name: p.company_name,
    status: p.company_status ?? null,
    companyType: p.type ?? null,
    jurisdiction: p.jurisdiction ?? null,
    incorporationDate: p.date_of_creation ?? null,
    sicCodes: (p.sic_codes ?? []).map((code) => ({
      code,
      description: describeSicCode(code),
    })),
    registeredOfficeLocality: p.registered_office_address?.locality ?? null,
    lastAccountsDate: p.accounts?.last_accounts?.made_up_to ?? null,
  };
}
