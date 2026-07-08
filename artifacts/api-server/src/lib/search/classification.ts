import {
  classifyVacancy,
  inferCandidateFinProfile,
  type VacancyLike,
  type CandidateFinLike,
  type FinTags,
} from "./finClassify";
import { lookupCuratedTitle } from "./curatedTitles";
import type { FinSector } from "./finTaxonomy";
import {
  displayFamiliesForSector,
  matchesDisplayFamily,
} from "../../config/curatedTitles/displayFamilies";

/**
 * Human-friendly sector labels — the single source of truth for showing
 * sector keys in API responses and the UI. Keep in sync with FIN_SECTORS.
 */
export const SECTOR_LABELS: Record<FinSector, string> = {
  insurance: "Insurance",
  banking: "Banking",
  pensions: "Pensions",
  asset_management: "Asset Management",
  accountancy_finance: "Accountancy & Finance",
  it_tech: "IT & Tech",
};

export function sectorLabelOf(sector: FinSector | null): string | null {
  return sector ? (SECTOR_LABELS[sector] ?? null) : null;
}

/**
 * Normalized classification payload for job/match cards. `families` carries
 * the stable display-family keys (usable as filters); `familyLabels` the
 * human-friendly labels, index-aligned with `families`.
 */
export interface ClassificationDto {
  sector: FinSector;
  sectorLabel: string;
  families: string[];
  familyLabels: string[];
}

/**
 * Map already-computed classification tags (sector + fn + curated-entry tags)
 * to the display-family based classification payload. Returns null when the
 * job has no confidently classified sector — callers must render nothing
 * rather than invent labels.
 */
export function classificationFromTags(
  sector: FinSector | null,
  fn: string | null,
  curatedTags: readonly string[],
): ClassificationDto | null {
  if (!sector) return null;
  const matched = displayFamiliesForSector(sector).filter((df) =>
    matchesDisplayFamily(df, fn, curatedTags),
  );
  return {
    sector,
    sectorLabel: SECTOR_LABELS[sector],
    families: matched.map((df) => df.key),
    familyLabels: matched.map((df) => df.label),
  };
}

/**
 * Classify a vacancy for display on cards. Reuses the existing deterministic
 * classifier (curated-title override + term scoring) — no new engine.
 */
export function classifyJobForDisplay(job: VacancyLike): ClassificationDto | null {
  const tags: FinTags = classifyVacancy(job);
  const curatedTags = lookupCuratedTitle(job.title ?? null)?.entry.tags ?? [];
  return classificationFromTags(tags.sector, tags.fn, curatedTags);
}

/**
 * Classify a candidate's inferred background for display on match cards.
 * Uses the existing candidate profile inference; curated tags come from the
 * candidate's current title when it matches a curated entry.
 */
export function classifyCandidateForDisplay(
  candidate: CandidateFinLike,
): ClassificationDto | null {
  const tags = inferCandidateFinProfile(candidate);
  const curatedTags =
    lookupCuratedTitle(candidate.currentTitle ?? null)?.entry.tags ?? [];
  return classificationFromTags(tags.sector, tags.fn, curatedTags);
}
