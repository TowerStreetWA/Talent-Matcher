import {
  SECTOR_TERMS,
  FUNCTION_TERMS,
  FUNCTION_SECTOR_AFFINITY,
  EMPLOYER_TYPE_RULES,
  EMPLOYER_TYPE_SECTOR,
  FIN_SECTORS,
  FIN_FUNCTIONS,
  type FinSector,
  type FinFunction,
  type EmployerType,
} from "./finTaxonomy";
import type { NormalizedQuery } from "./normalize";
import { lookupCuratedTitle } from "./curatedTitles";

/**
 * Deterministic, rule-based financial-services classification.
 *
 * All decisions are driven by the explicit term lists in finTaxonomy.ts.
 * Tags are computed centrally at search/match time (not persisted) so the
 * taxonomy can be tuned without migrations or backfills — reclassification
 * is instant and always consistent with the current dictionaries.
 */

const normText = (value: string | null | undefined): string =>
  (value ?? "")
    .toLowerCase()
    .replace(/[-/–—]/g, " ")
    .replace(/[^a-z0-9&'.= ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasTerm = (haystack: string, term: string): boolean => {
  if (!haystack || !term) return false;
  let idx = haystack.indexOf(term);
  while (idx !== -1) {
    const before = idx === 0 ? " " : (haystack[idx - 1] ?? " ");
    const afterIdx = idx + term.length;
    const after = afterIdx >= haystack.length ? " " : (haystack[afterIdx] ?? " ");
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    idx = haystack.indexOf(term, idx + 1);
  }
  return false;
};

export interface VacancyLike {
  title: string | null;
  descriptionText?: string | null;
  companyName?: string | null;
  industry?: string | null;
  skills?: string[] | null;
}

export interface FinTags {
  sector: FinSector | null;
  fn: FinFunction | null;
  employerType: EmployerType | null;
  matchedTerms: string[];
}

/** Classify an employer purely from its name via the explicit rule table. */
export function classifyEmployerType(
  companyName: string | null | undefined,
): EmployerType | null {
  const name = normText(companyName);
  if (!name) return null;
  const padded = ` ${name} `;
  for (const rule of EMPLOYER_TYPE_RULES) {
    for (const kw of rule.nameKeywords) {
      const matched =
        kw.startsWith(" ") || kw.endsWith(" ")
          ? padded.includes(kw)
          : hasTerm(name, normText(kw));
      if (matched) return rule.type;
    }
  }
  return null;
}

interface SectorScore {
  score: number;
  strongHits: number;
  matched: string[];
}

function scoreSectors(title: string, body: string): Record<FinSector, SectorScore> {
  const out = {} as Record<FinSector, SectorScore>;
  for (const sector of FIN_SECTORS) {
    const terms = SECTOR_TERMS[sector];
    const s: SectorScore = { score: 0, strongHits: 0, matched: [] };
    for (const term of terms.strong) {
      const t = normText(term);
      if (hasTerm(title, t)) {
        s.score += 3;
        s.strongHits += 1;
        s.matched.push(term);
      } else if (hasTerm(body, t)) {
        s.score += 2;
        s.strongHits += 1;
        s.matched.push(term);
      }
    }
    for (const term of terms.contextual) {
      const t = normText(term);
      if (hasTerm(title, t) || hasTerm(body, t)) {
        s.score += 1;
        s.matched.push(term);
      }
    }
    out[sector] = s;
  }
  return out;
}

function pickFunction(
  title: string,
  body: string,
  sector: FinSector | null,
): { fn: FinFunction | null; matched: string[] } {
  let best: FinFunction | null = null;
  let bestScore = 0;
  let bestMatched: string[] = [];
  for (const fn of FIN_FUNCTIONS) {
    let score = 0;
    const matched: string[] = [];
    for (const term of FUNCTION_TERMS[fn]) {
      const t = normText(term);
      if (hasTerm(title, t)) {
        // Multi-word terms in the title are the strongest function signal
        score += t.includes(" ") ? 4 : 2;
        matched.push(term);
      } else if (hasTerm(body, t)) {
        score += 1;
        matched.push(term);
      }
    }
    if (score === 0) continue;
    // Affinity tiebreak: prefer functions that belong to the resolved sector
    const affinity = FUNCTION_SECTOR_AFFINITY[fn];
    if (sector && affinity?.includes(sector)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = fn;
      bestMatched = matched;
    }
  }
  return { fn: best, matched: bestMatched };
}

/**
 * Classify a vacancy into financial-services sector + function tags.
 * Returns null tags for anything outside financial services — a job must
 * have a strong term hit (or contextual hits corroborated by an FS employer
 * type) before it is tagged, so generic roles stay untagged.
 */
export function classifyVacancy(job: VacancyLike): FinTags {
  // Curated-title override: an explicit taxonomy entry beats term scoring.
  const curated = lookupCuratedTitle(job.title);
  if (curated) {
    return {
      sector: curated.entry.industry,
      fn: curated.entry.family,
      employerType: classifyEmployerType(job.companyName),
      matchedTerms: [curated.matchedVariant],
    };
  }

  const title = normText(job.title);
  const body = normText(
    [
      job.descriptionText ?? "",
      job.industry ?? "",
      ...(job.skills ?? []),
    ].join(" "),
  );
  const employerType = classifyEmployerType(job.companyName);
  const employerSector = employerType ? EMPLOYER_TYPE_SECTOR[employerType] : null;

  const scores = scoreSectors(title, body);
  let sector: FinSector | null = null;
  let bestScore = 0;
  for (const s of FIN_SECTORS) {
    const sc = scores[s];
    const qualifies =
      (sc.strongHits >= 1 && sc.score >= 3) ||
      (sc.score >= 2 && employerSector === s);
    if (!qualifies) continue;
    const effective = sc.score + (employerSector === s ? 2 : 0);
    if (effective > bestScore) {
      bestScore = effective;
      sector = s;
    }
  }

  const fnResult = sector
    ? pickFunction(title, body, sector)
    : { fn: null, matched: [] };

  const matchedTerms = sector
    ? [...new Set([...scores[sector].matched, ...fnResult.matched])]
    : [];

  return { sector, fn: fnResult.fn, employerType, matchedTerms };
}

export interface CandidateFinLike {
  currentTitle: string | null;
  currentCompany?: string | null;
  titles?: string[] | null;
  skills?: string[] | null;
  industries?: string[] | null;
}

/**
 * Infer a candidate's likely financial-services background from their titles,
 * skills, and industry history. Same rules as vacancies: title-weighted term
 * hits against the explicit taxonomy.
 */
export function inferCandidateFinProfile(candidate: CandidateFinLike): FinTags {
  const title = normText(
    [candidate.currentTitle ?? "", ...(candidate.titles ?? [])].join(" "),
  );
  const body = normText(
    [...(candidate.skills ?? []), ...(candidate.industries ?? [])].join(" "),
  );
  return classifyVacancy({
    title: title || null,
    descriptionText: body || null,
    companyName: candidate.currentCompany ?? null,
  });
}

export interface QueryFinIntent {
  sector: FinSector | null;
  fn: FinFunction | null;
  matchedTerms: string[];
  hasFinIntent: boolean;
}

/**
 * Detect whether a search query carries financial-services intent, and which
 * sector/function it points at. Ranking boosts are ONLY applied when this
 * returns hasFinIntent=true, so queries outside financial services are
 * completely unaffected by the FS ranking layer.
 */
export function inferQueryFinIntent(nq: NormalizedQuery): QueryFinIntent {
  const texts = [nq.cleaned, ...nq.variants].map(normText).filter(Boolean);
  const blob = ` ${texts.join(" | ")} `;

  const matchedTerms: string[] = [];
  let sector: FinSector | null = null;
  let sectorStrong = false;
  let bestSectorScore = 0;
  for (const s of FIN_SECTORS) {
    let score = 0;
    let strong = false;
    for (const term of SECTOR_TERMS[s].strong) {
      if (hasTerm(blob, normText(term))) {
        score += 3;
        strong = true;
        matchedTerms.push(term);
      }
    }
    for (const term of SECTOR_TERMS[s].contextual) {
      if (hasTerm(blob, normText(term))) {
        score += 1;
        matchedTerms.push(term);
      }
    }
    if (score > bestSectorScore) {
      bestSectorScore = score;
      sector = s;
      sectorStrong = strong;
    }
  }

  let fn: FinFunction | null = null;
  let bestFnScore = 0;
  for (const f of FIN_FUNCTIONS) {
    let score = 0;
    for (const term of FUNCTION_TERMS[f]) {
      const t = normText(term);
      if (hasTerm(blob, t)) {
        score += t.includes(" ") ? 2 : 1;
        matchedTerms.push(term);
      }
    }
    const affinity = FUNCTION_SECTOR_AFFINITY[f];
    if (sector && affinity?.includes(sector)) score += 1;
    if (score > bestFnScore) {
      bestFnScore = score;
      fn = f;
    }
  }

  // FS intent requires an unambiguous signal: a strong sector term, or a
  // contextual sector term corroborated by a recognized function term.
  const hasFinIntent = sectorStrong || (sector !== null && fn !== null);

  return {
    sector: hasFinIntent ? sector : null,
    fn: hasFinIntent ? fn : null,
    matchedTerms: hasFinIntent ? [...new Set(matchedTerms)] : [],
    hasFinIntent,
  };
}
