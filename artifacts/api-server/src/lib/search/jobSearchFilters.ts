import { FIN_SECTORS, type FinSector } from "./finTaxonomy";

/**
 * Explicit, inspectable input-mapping dictionaries for the recruiter-facing
 * job search (/jobs/search). Extend the maps below to teach the search new
 * sector spellings or location groupings — no logic changes needed.
 */

/** User-supplied sector/industry text -> internal FS sector tag. */
export const SECTOR_INPUT_ALIASES: Record<string, FinSector> = {
  insurance: "insurance",
  insurer: "insurance",
  "general insurance": "insurance",
  "london market": "insurance",
  reinsurance: "insurance",
  banking: "banking",
  bank: "banking",
  "retail banking": "banking",
  "investment banking": "banking",
  pensions: "pensions",
  pension: "pensions",
  retirement: "pensions",
  "asset management": "asset_management",
  "asset mgmt": "asset_management",
  asset_management: "asset_management",
  "investment management": "asset_management",
  "fund management": "asset_management",
  "wealth management": "asset_management",
};

/**
 * Rule-based location normalization: each group lists spellings that should
 * match one another. The first entry is the canonical form; a query for any
 * member broadens the ILIKE filter to all members.
 */
export const LOCATION_GROUPS: string[][] = [
  ["london", "greater london", "city of london"],
  ["manchester", "greater manchester"],
  ["birmingham", "west midlands"],
  ["edinburgh", "lothian"],
  ["glasgow", "strathclyde"],
  ["leeds", "west yorkshire"],
  ["bristol", "avon"],
  ["newcastle", "newcastle upon tyne", "tyne and wear"],
  ["uk", "united kingdom", "great britain", "britain"],
  ["remote", "fully remote", "work from home", "wfh"],
];

const normInput = (value: string): string =>
  value.toLowerCase().replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Resolve free-text sector input to an internal sector tag.
 * Returns null when the input doesn't map to a known sector.
 */
export function resolveSectorInput(raw: string | null | undefined): FinSector | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().trim();
  if ((FIN_SECTORS as readonly string[]).includes(cleaned)) {
    return cleaned as FinSector;
  }
  return SECTOR_INPUT_ALIASES[normInput(raw)] ?? null;
}

/**
 * Expand a location input into the list of interchangeable spellings to
 * ILIKE against. Always includes the cleaned input itself.
 */
export function expandLocationInput(raw: string): string[] {
  const cleaned = normInput(raw);
  if (!cleaned) return [];
  const variants = new Set<string>([cleaned]);
  for (const group of LOCATION_GROUPS) {
    if (group.some((member) => member === cleaned)) {
      for (const member of group) variants.add(member);
    }
  }
  return [...variants];
}
