/**
 * In-memory record of how each directory employer was last ingested — which
 * path it took (ATS fetcher, basic HTML crawler, Firecrawl) and what the
 * outcome was. Advisory-only (per-process, like the board-resolution cache):
 * cold processes simply have no record until the next run. Consumed by the
 * careers-directory coverage diagnostics so it's obvious how much coverage
 * comes "for free" from ATS + basic HTML, and which employers are truly
 * blocked on Firecrawl credits.
 */

export type IngestionPath = "ats" | "basic_html" | "firecrawl";

export type IngestionPathOutcome =
  | "jobs_found"
  | "no_jobs"
  | "html_no_jobs" // basic crawler parsed a static page but found no listings
  | "needs_firecrawl" // JS-heavy page and Firecrawl unavailable (credits/config)
  | "blocked_url"
  | "fetch_failed"
  | "unsupported_ats"
  | "error";

export interface IngestionPathRecord {
  path: IngestionPath | null;
  outcome: IngestionPathOutcome;
  jobs: number;
  /** Extraction evidence / unavailability reason, for diagnostics. */
  detail: string | null;
  checkedAt: Date;
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const records = new Map<string, IngestionPathRecord>();

function key(careersUrl: string): string {
  return careersUrl.toLowerCase().replace(/\/+$/, "");
}

/** Opportunistically drop expired entries so the map cannot grow unbounded. */
function pruneExpired(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [k, v] of records) {
    if (v.checkedAt.getTime() < cutoff) records.delete(k);
  }
}

export function recordIngestionPath(
  careersUrl: string,
  record: Omit<IngestionPathRecord, "checkedAt">,
): void {
  pruneExpired();
  records.set(key(careersUrl), { ...record, checkedAt: new Date() });
}

export function ingestionPathRecord(careersUrl: string): IngestionPathRecord | null {
  const hit = records.get(key(careersUrl));
  if (!hit) return null;
  if (Date.now() - hit.checkedAt.getTime() > TTL_MS) return null;
  return hit;
}

/** Test hook. */
export function clearIngestionPathRegistry(): void {
  records.clear();
}
