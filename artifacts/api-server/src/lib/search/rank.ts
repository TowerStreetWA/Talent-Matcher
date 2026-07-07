import type { NormalizedQuery } from "./normalize";
import {
  classifyVacancy,
  inferCandidateFinProfile,
  type QueryFinIntent,
  type FinTags,
} from "./finClassify";
import { EMPLOYER_TYPE_SECTOR } from "./finTaxonomy";

/**
 * Explicit score composition for search relevance. Each component is computed
 * independently and combined with the weights below — no hidden heuristics.
 * Higher-priority intent (exact title / phrase) always dominates weaker
 * signals (company, taxonomy, fuzzy blob text).
 */
export const WEIGHTS = {
  exactTitle: 100,
  phraseInTitle: 70,
  variantInTitle: 55,
  titleTokenHit: 20, // per token, capped at 40
  exactName: 100, // candidates only
  nameHit: 45, // candidates only
  companyWordHit: 25,
  companySubstringHit: 12,
  taxonomyHit: 15, // per skill/industry/known-title hit, capped at 30
  fuzzyBlobHit: 5,
  // Financial-services boosts — applied ONLY when the query itself carries
  // FS intent (see inferQueryFinIntent), so non-FS queries are unaffected.
  finSectorMatch: 45,
  finFunctionMatch: 40,
  finEmployerTypeMatch: 20,
  finDirectEmployer: 15,
} as const;

export interface ScoreBreakdown {
  exactTitle: number;
  phraseTitle: number;
  variantTitle: number;
  titleTokens: number;
  name: number;
  company: number;
  taxonomy: number;
  fuzzy: number;
  /** FS sector alignment boost (0 when query has no FS intent). */
  finSector: number;
  /** FS function alignment boost. */
  finFunction: number;
  /** Employer-type-to-sector alignment boost. */
  finEmployerType: number;
  /** Direct-employer source boost (FS queries only). */
  finDirectEmployer: number;
  /** Dev/internal explainability: how the document was classified. */
  finTags: FinTags | null;
  total: number;
}

const norm = (value: string | null | undefined): string =>
  (value ?? "").toLowerCase().replace(/[-/]/g, " ").replace(/\s+/g, " ").trim();

const wordBoundaryIncludes = (haystack: string, needle: string): boolean => {
  if (!haystack || !needle) return false;
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const before = idx === 0 ? " " : haystack[idx - 1];
  const afterIdx = idx + needle.length;
  const after = afterIdx >= haystack.length ? " " : haystack[afterIdx];
  return !/[a-z0-9]/.test(before ?? " ") && !/[a-z0-9]/.test(after ?? " ");
};

interface RankableFields {
  title: string;
  name?: string;
  company: string;
  taxonomy: string[]; // skills, industries, known title variants
  blob: string; // weak background text (description, location)
}

function scoreFields(nq: NormalizedQuery, fields: RankableFields): ScoreBreakdown {
  const title = norm(fields.title);
  const name = norm(fields.name);
  const company = norm(fields.company);
  const blob = norm(fields.blob);
  const taxonomy = fields.taxonomy.map(norm).filter(Boolean);

  const breakdown: ScoreBreakdown = {
    exactTitle: 0,
    phraseTitle: 0,
    variantTitle: 0,
    titleTokens: 0,
    name: 0,
    company: 0,
    taxonomy: 0,
    fuzzy: 0,
    finSector: 0,
    finFunction: 0,
    finEmployerType: 0,
    finDirectEmployer: 0,
    finTags: null,
    total: 0,
  };

  // 1. Exact title match (whole cleaned query or quoted phrase)
  const exactCandidates = [nq.cleaned, ...nq.phrases].filter(Boolean);
  if (title && exactCandidates.some((q) => q === title)) {
    breakdown.exactTitle = WEIGHTS.exactTitle;
  }

  // 2. Quoted phrase (or full multi-word query) appearing inside the title
  if (!breakdown.exactTitle && title) {
    const phraseCandidates = [
      ...nq.phrases,
      ...(nq.tokens.length > 1 && nq.cleaned ? [nq.cleaned] : []),
    ];
    if (phraseCandidates.some((p) => p && wordBoundaryIncludes(title, p))) {
      breakdown.phraseTitle = WEIGHTS.phraseInTitle;
    }
  }

  // 3. Normalized variant (synonym / abbreviation expansion) hitting the title
  if (!breakdown.exactTitle && !breakdown.phraseTitle && title) {
    const multiWordVariants = nq.variants.filter((v) => v.includes(" "));
    if (
      multiWordVariants.some(
        (v) => v === title || wordBoundaryIncludes(title, v),
      )
    ) {
      breakdown.variantTitle = WEIGHTS.variantInTitle;
    }
  }

  // 4. Individual token hits in the title (partial title intent)
  if (title && nq.tokens.length > 0) {
    let hits = 0;
    for (const token of nq.tokens) {
      const tokenVariants = nq.variants.filter(
        (v) => !v.includes(" ") && (v === token || v.startsWith(token)),
      );
      if (
        wordBoundaryIncludes(title, token) ||
        tokenVariants.some((v) => wordBoundaryIncludes(title, v))
      ) {
        hits += 1;
      }
    }
    breakdown.titleTokens = Math.min(hits * WEIGHTS.titleTokenHit, 40);
  }

  // 5. Person-name match (candidates)
  if (name) {
    if (exactCandidates.some((q) => q === name)) {
      breakdown.name = WEIGHTS.exactName;
    } else if (
      nq.tokens.some((t) => wordBoundaryIncludes(name, t)) ||
      (nq.cleaned && name.startsWith(nq.cleaned))
    ) {
      breakdown.name = WEIGHTS.nameHit;
    }
  }

  // 6. Employer / company match
  if (company) {
    if (
      exactCandidates.some((q) => q === company) ||
      nq.tokens.some((t) => wordBoundaryIncludes(company, t)) ||
      (nq.cleaned.length >= 3 && company.startsWith(nq.cleaned))
    ) {
      breakdown.company = WEIGHTS.companyWordHit;
    } else if (nq.cleaned.length >= 3 && company.includes(nq.cleaned)) {
      breakdown.company = WEIGHTS.companySubstringHit;
    }
  }

  // 7. Structured taxonomy hits (skills, industries, known title variants)
  if (taxonomy.length > 0) {
    let hits = 0;
    for (const entry of taxonomy) {
      if (
        nq.variants.some((v) => entry === v || wordBoundaryIncludes(entry, v))
      ) {
        hits += 1;
      }
    }
    breakdown.taxonomy = Math.min(hits * WEIGHTS.taxonomyHit, 30);
  }

  // 8. Weak fuzzy hit in background text only
  if (blob && nq.cleaned.length >= 3 && blob.includes(nq.cleaned)) {
    breakdown.fuzzy = WEIGHTS.fuzzyBlobHit;
  }

  breakdown.total =
    breakdown.exactTitle +
    breakdown.phraseTitle +
    breakdown.variantTitle +
    breakdown.titleTokens +
    breakdown.name +
    breakdown.company +
    breakdown.taxonomy +
    breakdown.fuzzy;
  return breakdown;
}

/**
 * Apply financial-services ranking boosts to an already-computed breakdown.
 * No-op unless the query carries FS intent — non-FS queries keep their exact
 * previous scores. Each boost is an explicit, independent component.
 */
function applyFinBoosts(
  breakdown: ScoreBreakdown,
  intent: QueryFinIntent | null | undefined,
  tags: FinTags,
  opts: { isDirectEmployer?: boolean } = {},
): void {
  breakdown.finTags = tags;
  if (!intent?.hasFinIntent) return;

  if (intent.sector && tags.sector === intent.sector) {
    breakdown.finSector = WEIGHTS.finSectorMatch;
  }
  if (intent.fn && tags.fn === intent.fn) {
    breakdown.finFunction = WEIGHTS.finFunctionMatch;
  }
  if (
    intent.sector &&
    tags.employerType &&
    EMPLOYER_TYPE_SECTOR[tags.employerType] === intent.sector
  ) {
    breakdown.finEmployerType = WEIGHTS.finEmployerTypeMatch;
  }
  // Direct-employer boost only for roles that themselves match the query's
  // sector — "prefer direct-employer FS roles", not any direct-sourced job.
  if (opts.isDirectEmployer && tags.sector !== null && tags.sector === intent.sector) {
    breakdown.finDirectEmployer = WEIGHTS.finDirectEmployer;
  }
  breakdown.total +=
    breakdown.finSector +
    breakdown.finFunction +
    breakdown.finEmployerType +
    breakdown.finDirectEmployer;
}

export interface JobLike {
  title: string | null;
  companyName: string | null;
  locationText: string | null;
  industry: string | null;
  skills: string[] | null;
  descriptionText: string | null;
  /** e.g. "direct_employer" — enables the direct-employer boost on FS queries. */
  sourceType?: string | null;
}

export function scoreJob(
  nq: NormalizedQuery,
  job: JobLike,
  finIntent?: QueryFinIntent | null,
): ScoreBreakdown {
  const breakdown = scoreFields(nq, {
    title: job.title ?? "",
    company: job.companyName ?? "",
    taxonomy: [...(job.skills ?? []), ...(job.industry ? [job.industry] : [])],
    blob: `${job.descriptionText ?? ""} ${job.locationText ?? ""}`,
  });
  const tags = classifyVacancy(job);
  applyFinBoosts(breakdown, finIntent, tags, {
    isDirectEmployer: job.sourceType === "direct_employer",
  });
  return breakdown;
}

export interface CandidateLike {
  firstName: string | null;
  lastName: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  locationText: string | null;
  skills: string[] | null;
  titles: string[] | null;
  industries: string[] | null;
}

export function scoreCandidate(
  nq: NormalizedQuery,
  candidate: CandidateLike,
  finIntent?: QueryFinIntent | null,
): ScoreBreakdown {
  const breakdown = scoreFields(nq, {
    title: candidate.currentTitle ?? "",
    name: `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim(),
    company: candidate.currentCompany ?? "",
    taxonomy: [
      ...(candidate.skills ?? []),
      ...(candidate.titles ?? []),
      ...(candidate.industries ?? []),
    ],
    blob: candidate.locationText ?? "",
  });
  const tags = inferCandidateFinProfile(candidate);
  applyFinBoosts(breakdown, finIntent, tags);
  return breakdown;
}
