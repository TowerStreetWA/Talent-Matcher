import { CURATED_TITLES, type CuratedTitleEntry } from "../../config/curatedTitles";

/**
 * Loader for the curated title taxonomy (config/curatedTitles/).
 *
 * Provides:
 *  - lookupCuratedTitle(): match a job/CV title against curated entries
 *    (exact normalized match first, then longest whole-word variant contained
 *    in the title) — used by finClassify as a classification override.
 *  - curatedSynonymGroups(): each entry's [canonical, ...variants] as a
 *    synonym group — merged into search query expansion in normalize.ts.
 */

const normTitle = (value: string | null | undefined): string =>
  (value ?? "")
    .toLowerCase()
    .replace(/[-/–—]/g, " ")
    .replace(/[^a-z0-9&' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface VariantIndexEntry {
  normalized: string;
  entry: CuratedTitleEntry;
}

let exactIndex: Map<string, CuratedTitleEntry> | null = null;
let containsIndex: VariantIndexEntry[] | null = null;

function buildIndexes(): void {
  exactIndex = new Map();
  containsIndex = [];
  for (const entry of CURATED_TITLES) {
    for (const raw of [entry.canonicalTitle, ...entry.variants]) {
      const normalized = normTitle(raw);
      if (!normalized) continue;
      if (!exactIndex.has(normalized)) exactIndex.set(normalized, entry);
      containsIndex.push({ normalized, entry });
    }
  }
  // Longest variants first so "senior insurance underwriter" wins over "underwriter"
  containsIndex.sort((a, b) => b.normalized.length - a.normalized.length);
}

const containsWholePhrase = (haystack: string, phrase: string): boolean => {
  let idx = haystack.indexOf(phrase);
  while (idx !== -1) {
    const before = idx === 0 ? " " : (haystack[idx - 1] ?? " ");
    const afterIdx = idx + phrase.length;
    const after = afterIdx >= haystack.length ? " " : (haystack[afterIdx] ?? " ");
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    idx = haystack.indexOf(phrase, idx + 1);
  }
  return false;
};

export interface CuratedTitleMatch {
  entry: CuratedTitleEntry;
  /** The curated variant (normalized) that matched. */
  matchedVariant: string;
}

/**
 * Match a title against the curated taxonomy. Exact normalized match wins;
 * otherwise the longest curated variant contained (whole-word) in the title.
 * Single-word variants (e.g. "uw") only match exactly, to avoid false hits
 * inside unrelated titles.
 */
export function lookupCuratedTitle(
  title: string | null | undefined,
): CuratedTitleMatch | null {
  const normalized = normTitle(title);
  if (!normalized) return null;
  if (!exactIndex || !containsIndex) buildIndexes();

  const exact = exactIndex!.get(normalized);
  if (exact) return { entry: exact, matchedVariant: normalized };

  for (const { normalized: variant, entry } of containsIndex!) {
    if (!variant.includes(" ")) continue;
    if (containsWholePhrase(normalized, variant)) {
      return { entry, matchedVariant: variant };
    }
  }
  return null;
}

let cachedGroups: string[][] | null = null;

/** Synonym groups derived from curated titles: [canonical, ...variants]. */
export function curatedSynonymGroups(): string[][] {
  if (cachedGroups) return cachedGroups;
  cachedGroups = CURATED_TITLES.map((entry) => {
    const group = new Set<string>();
    const add = (v: string): void => {
      const n = normTitle(v);
      if (n) group.add(n);
    };
    add(entry.canonicalTitle);
    for (const v of entry.variants) add(v);
    return [...group];
  }).filter((g) => g.length > 1);
  return cachedGroups;
}
