import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, candidatesTable, jobsTable } from "@workspace/db";
import { ListSearchSuggestionsResponse } from "@workspace/api-zod";
import { tenantOf } from "../middlewares/auth";
import { normalizeQuery } from "../lib/search/normalize";

const router: IRouter = Router();

type SuggestionKind = "title" | "company" | "skill";

interface RankedSuggestion {
  label: string;
  kind: SuggestionKind;
  score: number;
  frequency: number;
}

const MAX_SUGGESTIONS = 8;

/**
 * Rank a suggestion label against the normalized query:
 * prefix match > word-boundary match > substring; matches via expanded
 * variants (synonyms/abbreviations) count slightly below direct matches.
 */
function suggestionScore(label: string, variants: string[], cleaned: string): number {
  const lower = label.toLowerCase();
  let best = 0;
  const scoreFor = (needle: string, direct: boolean): number => {
    if (!needle) return 0;
    const base = direct ? 1 : 0;
    if (lower.startsWith(needle)) return 6 + base;
    const idx = lower.indexOf(needle);
    if (idx === -1) return 0;
    const prev = lower[idx - 1] ?? " ";
    if (!/[a-z0-9]/.test(prev)) return 4 + base;
    return 2 + base;
  };
  best = Math.max(best, scoreFor(cleaned, true));
  for (const variant of variants) {
    best = Math.max(best, scoreFor(variant, variant === cleaned));
  }
  return best;
}

function collect(
  bucket: Map<string, RankedSuggestion>,
  label: string | null,
  kind: SuggestionKind,
  variants: string[],
  cleaned: string,
): void {
  const trimmed = (label ?? "").trim();
  if (trimmed.length < 2) return;
  const key = `${kind}:${trimmed.toLowerCase()}`;
  const existing = bucket.get(key);
  if (existing) {
    existing.frequency += 1;
    return;
  }
  const score = suggestionScore(trimmed, variants, cleaned);
  if (score <= 0) return;
  bucket.set(key, { label: trimmed, kind, score, frequency: 1 });
}

router.get("/search/suggestions", async (req, res): Promise<void> => {
  const scope = typeof req.query["scope"] === "string" ? req.query["scope"] : "";
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  if (scope !== "candidates" && scope !== "jobs") {
    res.status(400).json({ message: "scope must be candidates or jobs" });
    return;
  }
  if (q.trim().length < 2) {
    res.json(ListSearchSuggestionsResponse.parse([]));
    return;
  }

  const nq = normalizeQuery(q);
  const tenantId = tenantOf(req);
  const bucket = new Map<string, RankedSuggestion>();

  if (scope === "jobs") {
    const rows = await db
      .select({
        title: jobsTable.title,
        companyName: jobsTable.companyName,
        skills: jobsTable.skills,
      })
      .from(jobsTable)
      .where(eq(jobsTable.tenantId, tenantId))
      .limit(500);
    for (const row of rows) {
      collect(bucket, row.title, "title", nq.variants, nq.cleaned);
      collect(bucket, row.companyName, "company", nq.variants, nq.cleaned);
      for (const skill of row.skills ?? []) {
        collect(bucket, skill, "skill", nq.variants, nq.cleaned);
      }
    }
  } else {
    const rows = await db
      .select({
        currentTitle: candidatesTable.currentTitle,
        currentCompany: candidatesTable.currentCompany,
        titles: candidatesTable.titles,
        skills: candidatesTable.skills,
      })
      .from(candidatesTable)
      .where(eq(candidatesTable.tenantId, tenantId))
      .limit(500);
    for (const row of rows) {
      collect(bucket, row.currentTitle, "title", nq.variants, nq.cleaned);
      collect(bucket, row.currentCompany, "company", nq.variants, nq.cleaned);
      for (const title of row.titles ?? []) {
        collect(bucket, title, "title", nq.variants, nq.cleaned);
      }
      for (const skill of row.skills ?? []) {
        collect(bucket, skill, "skill", nq.variants, nq.cleaned);
      }
    }
  }

  const kindPriority: Record<SuggestionKind, number> = {
    title: 3,
    company: 2,
    skill: 1,
  };
  const suggestions = [...bucket.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        kindPriority[b.kind] - kindPriority[a.kind] ||
        b.frequency - a.frequency ||
        a.label.length - b.label.length,
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(({ label, kind }) => ({ label, kind }));

  req.log.info(
    {
      event: "search_suggestions",
      scope,
      rawQuery: q.slice(0, 200),
      normalizedQuery: nq.cleaned.slice(0, 200),
      suggestionCount: suggestions.length,
    },
    "search suggestions served",
  );

  res.json(ListSearchSuggestionsResponse.parse(suggestions));
});

export default router;
