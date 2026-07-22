/**
 * Insurance-domain synonym dictionary.
 *
 * Each key is the canonical form. Values are all known aliases.
 * Used across:
 *  - job search query expansion (via dictionaries.ts)
 *  - CV skill normalisation (cvParser.ts)
 *  - match scoring (matching.ts)
 *  - role analysis AI prompt context (dashboard.ts)
 *
 * To extend: add new canonical keys or extra aliases — no other files need changing.
 */

type SynonymMap = Record<string, string[]>;

export const INSURANCE_SYNONYMS: SynonymMap = {
  // ── Business classes / lines ────────────────────────────────────────────
  "Accident and Health": ["A&H", "A and H", "A/H", "Accident & Health", "Accident and Health"],
  "Credit and Political Risks Insurance": [
    "CRPI",
    "Credit & Political Risks Insurance",
    "Credit and Political Risks",
    "Credit Political Risks Insurance",
    "Credit Political Risks",
  ],
  "Commercial General Liability": ["CGL", "Commercial GL", "Commercial G.L.", "General Liability", "GL"],
  "Errors and Omissions": ["E&O", "E and O", "Errors & Omissions", "Professional Indemnity", "Professional Liability"],
  "Directors and Officers Liability": ["D&O", "D and O", "Directors & Officers", "Directors and Officers"],
  "Excess and Surplus Lines": ["E&S", "Excess & Surplus", "Surplus Lines"],
  "Business Owners Policy": ["BOP", "Business Owner Policy", "Business Owners Package"],
  "Workers Compensation": ["WC", "Workers Comp", "Work Comp"],
  "Commercial Property": ["Commercial Property", "Property", "Buildings", "Real Property"],
  "Marine Insurance": ["Marine", "Cargo", "Hull", "Hull & Machinery"],
  "Aviation Insurance": ["Aviation", "Aero", "Aircraft Insurance"],
  "Reinsurance": ["Re", "Re-insurance", "Retrocession"],
  "Cyber Insurance": ["Cyber", "Cyber Liability", "Cyber Risk", "Technology Insurance"],
  "Professional Indemnity": ["PI", "P.I.", "Professional Indemnity", "Professional Liability"],

  // ── Roles ───────────────────────────────────────────────────────────────
  "Underwriter": ["UW", "Insurance Underwriter", "Risk Underwriter"],
  "Accident and Health Underwriter": [
    "A&H Underwriter",
    "A and H Underwriter",
    "A/H Underwriter",
    "Accident & Health Underwriter",
    "Accident and Health Underwriter",
  ],
  "Credit and Political Risks Underwriter": [
    "CRPI Underwriter",
    "Credit & Political Risks Underwriter",
    "Credit and Political Risks Underwriter",
  ],
  "Active Underwriter": ["AU", "Active UW", "Active Underwriter"],
  "Assistant Underwriter": ["Asst Underwriter", "Assistant UW", "Assistant Underwriter"],
  "Senior Underwriter": ["Sr Underwriter", "Senior UW", "Senior Underwriter"],
  "Broker": ["Insurance Broker", "Placement Broker", "Account Executive"],
  "Claims Adjuster": ["Claims Handler", "Claims Technician", "Loss Adjuster"],
  "Claims Manager": ["Claims Lead", "Claims Manager", "Claims Team Lead"],
  "Managing General Agent": ["MGA", "Managing General Agent"],
  "Managing General Underwriter": ["MGU", "Managing General Underwriter"],
  "Third Party Administrator": ["TPA", "Third-Party Administrator", "Third Party Admin"],
  "Account Handler": ["Account Handler", "Client Handler", "Broker Handler"],
  "Account Executive": ["AE", "Account Exec", "Account Executive"],
  "Pricing Analyst": ["Pricing Analyst", "Actuarial Analyst", "Pricing Specialist"],
  "Actuary": ["Actuary", "Actuarial Analyst", "Capital Actuary"],
  "Portfolio Manager": ["Portfolio Underwriter", "Portfolio Manager"],
};

// ── Internal indices (built once at module load) ─────────────────────────

const _normaliseText = (input: string): string =>
  input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,/()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** exact normalised text → canonical form */
const _canonicalIndex = new Map<string, string>();

for (const [canonical, aliases] of Object.entries(INSURANCE_SYNONYMS)) {
  _canonicalIndex.set(_normaliseText(canonical), canonical);
  for (const alias of aliases) {
    _canonicalIndex.set(_normaliseText(alias), canonical);
  }
}

/**
 * Resolve an insurance term to its canonical form.
 * Returns the input unchanged when no match is found.
 *
 * Example: normaliseInsuranceTerm("D&O") → "Directors and Officers Liability"
 */
export function normaliseInsuranceTerm(term: string): string {
  return _canonicalIndex.get(_normaliseText(term)) ?? term;
}

/**
 * Returns the canonical form for skill matching — same as normaliseInsuranceTerm
 * but guaranteed never to throw. Used inside hot matching loops.
 */
export function canonicalSkill(skill: string): string {
  return normaliseInsuranceTerm(skill);
}

/**
 * Extract all canonical insurance terms mentioned in free text.
 */
export function extractInsuranceTerms(text: string): string[] {
  const matches = new Set<string>();
  const normalised = _normaliseText(text);
  for (const [canonical, aliases] of Object.entries(INSURANCE_SYNONYMS)) {
    const all = [canonical, ...aliases];
    for (const term of all) {
      if (normalised.includes(_normaliseText(term))) {
        matches.add(canonical);
        break;
      }
    }
  }
  return Array.from(matches);
}

/**
 * A compact list of canonical→aliases pairs for injecting into AI prompts.
 * Format: "Canonical Term: alias1, alias2, ..."
 * Keeps the prompt short by omitting entries where the only alias is the canonical itself.
 */
export function insuranceSynonymPromptHint(): string {
  return Object.entries(INSURANCE_SYNONYMS)
    .map(([canonical, aliases]) => {
      const distinct = aliases.filter((a) => a.toLowerCase() !== canonical.toLowerCase());
      return distinct.length ? `${canonical}: ${distinct.join(", ")}` : null;
    })
    .filter(Boolean)
    .join("\n");
}
