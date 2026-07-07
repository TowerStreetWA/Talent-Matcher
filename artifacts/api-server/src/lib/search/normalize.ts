import { ABBREVIATIONS, SYNONYM_GROUPS, STOP_WORDS } from "./dictionaries";

export interface NormalizedQuery {
  /** Original user input, untouched. */
  raw: string;
  /** Lowercased, punctuation-cleaned, whitespace-collapsed query. */
  cleaned: string;
  /** Exact phrases the user quoted — never expanded or split. */
  phrases: string[];
  /** Meaningful tokens from the unquoted part (stop words removed, singularized). */
  tokens: string[];
  /**
   * All match variants to try against text fields: the cleaned query, quoted
   * phrases, abbreviation expansions, and synonym alternatives. Deduped.
   */
  variants: string[];
}

const singularize = (word: string): string => {
  if (word.length > 3 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
};

const cleanText = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[/,;:!?()[\]{}<>*&^%$#@~`|\\+=_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const synonymAlternatives = (term: string): string[] => {
  const out: string[] = [];
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(term)) {
      for (const member of group) {
        if (member !== term) out.push(member);
      }
    }
  }
  return out;
};

/**
 * Normalize a recruiter-style search query into a set of explicit, inspectable
 * match variants. Quoted phrases are preserved exactly; everything else is
 * lowercased, cleaned, singular-tolerant, and expanded via the domain
 * dictionaries (abbreviations + synonym groups).
 */
export function normalizeQuery(raw: string): NormalizedQuery {
  const phrases: string[] = [];
  let rest = raw;
  const quoted = raw.match(/"([^"]+)"/g);
  if (quoted) {
    for (const q of quoted) {
      const phrase = cleanText(q.slice(1, -1));
      if (phrase) phrases.push(phrase);
    }
    rest = raw.replace(/"[^"]*"/g, " ");
  }

  const cleanedRest = cleanText(rest.replace(/-/g, " "));
  const cleaned = [phrases.join(" "), cleanedRest].filter(Boolean).join(" ").trim();

  const rawTokens = cleanedRest.split(" ").filter(Boolean);
  const tokens: string[] = [];
  for (const token of rawTokens) {
    if (STOP_WORDS.has(token)) continue;
    tokens.push(singularize(token));
  }

  const variantSet = new Set<string>();
  const add = (value: string): void => {
    const v = value.trim();
    if (v.length >= 2) variantSet.add(v);
  };

  if (cleaned) add(cleaned);
  for (const phrase of phrases) add(phrase);
  if (cleanedRest && cleanedRest !== cleaned) add(cleanedRest);

  // Whole-query expansion: "swe" -> "software engineer"
  const wholeKey = cleanedRest.replace(/\s+/g, "");
  for (const expansion of ABBREVIATIONS[wholeKey] ?? []) add(expansion);
  for (const alt of synonymAlternatives(cleanedRest)) add(alt);

  // Per-token expansion, and expanded whole-query with each token substituted
  for (const token of tokens) {
    add(token);
    const expansions = [
      ...(ABBREVIATIONS[token] ?? []),
      ...synonymAlternatives(token),
    ];
    for (const expansion of expansions) {
      add(expansion);
      if (tokens.length > 1) {
        add(tokens.map((t) => (t === token ? expansion : t)).join(" "));
      }
    }
  }

  // Two-word combos benefit from synonym alternatives too ("front end dev")
  if (tokens.length > 1) {
    const joined = tokens.join(" ");
    for (const alt of synonymAlternatives(joined)) add(alt);
  }

  return { raw, cleaned, phrases, tokens, variants: [...variantSet] };
}
