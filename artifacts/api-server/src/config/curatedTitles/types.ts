import type { FinSector, FinFunction } from "../../lib/search/finTaxonomy";

/**
 * A curated job-title entry: one canonical recruiter-facing title plus the
 * real-world variants that should map to it.
 *
 * These entries are pure configuration — no logic lives here. They feed two
 * places:
 *  1. Search: every entry's [canonicalTitle, ...variants] becomes a synonym
 *     group, so searching any variant also finds the others.
 *  2. Classification: a vacancy whose title matches an entry is tagged with
 *     the entry's industry + family directly (overrides term scoring).
 */
export interface CuratedTitleEntry {
  /** Industry the title belongs to (uses the FS taxonomy sectors). */
  industry: FinSector;
  /** Functional family within the industry (uses the FS taxonomy functions). */
  family: FinFunction;
  /** The preferred, canonical form of the title. */
  canonicalTitle: string;
  /** Alternative spellings/phrasings seen in real job ads and CVs. */
  variants: string[];
  /** Optional typical seniority band for the canonical title. */
  seniority?: "junior" | "mid" | "senior" | "executive";
}
