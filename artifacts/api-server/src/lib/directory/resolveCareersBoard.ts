import type { AtsEmployerConfig } from "../../config/atsEmployers";
import { validateResearchUrl } from "../firecrawl";
import { atsEntryFromUrl, successFactorsEntryFromUrl } from "./engine";

/**
 * Careers→board resolution: given an employer careers URL (often a JS-heavy
 * corporate shell), discover the hosted ATS board where the jobs actually
 * live by (1) following redirects and checking the final URL, then (2)
 * scanning the served HTML for ATS board links/embeds.
 *
 * Results are cached in-memory (per process) so ingestion batches and the
 * hourly sweep don't re-probe the same page; the cache is advisory only —
 * cold processes simply re-resolve.
 */

export type ResolutionOutcome =
  | "careers_url_is_board" // careers URL itself parses as an ATS board
  | "redirected_to_board" // final URL after redirects is an ATS board
  | "board_link_in_html" // HTML references a supported ATS board
  | "unsupported_ats" // detected a known-but-unsupported ATS (e.g. Taleo, SuccessFactors CSB)
  | "no_board_detected" // fetched OK, nothing recognisable found
  | "blocked_url" // SSRF guard: non-http(s), private/internal host, or redirect to one
  | "fetch_failed"; // network error / timeout / non-2xx

export interface BoardResolution {
  outcome: ResolutionOutcome;
  /** Parsed ATS entry ready for the structured fetchers (null unless resolved). */
  entry: AtsEmployerConfig | null;
  /** The board URL the entry was parsed from (null unless resolved). */
  boardUrl: string | null;
  /** Final URL after redirects (null when the fetch failed). */
  finalUrl: string | null;
  /** Unsupported-ATS name when outcome is "unsupported_ats". */
  unsupportedAts: string | null;
  checkedAt: Date;
}

const RESOLVE_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HTML_BYTES = 512 * 1024;

const cache = new Map<string, BoardResolution>();

/** Read-only view of the resolution cache (diagnostics). */
export function cachedResolution(careersUrl: string): BoardResolution | null {
  const hit = cache.get(cacheKey(careersUrl));
  if (!hit) return null;
  if (Date.now() - hit.checkedAt.getTime() > CACHE_TTL_MS) return null;
  return hit;
}

/** Test hook. */
export function clearResolutionCache(): void {
  cache.clear();
}

function cacheKey(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

/**
 * ATS platforms we can detect in HTML but have no structured fetcher for.
 * Greenhouse/iCIMS/SuccessFactors-RMK moved out of this list in July 2026 —
 * they now have first-class fetchers. The remaining detection-only entries
 * are here because their public surfaces are JS-only or session-gated:
 *  - successfactors_csb: Career Site Builder portals (careerN.successfactors.
 *    com/eu) render entirely client-side from an authenticated OData API
 *  - taleo: portals are JS shells over a session-token API
 *  - oracle_cloud / avature / eightfold: JS-only SPAs, no stable public JSON
 *  - personio / bamboohr / rippling / jazzhr / comeet: hosted boards exist
 *    but are low-volume in our sectors; detection first, fetchers when
 *    scorecard data shows enough employers to justify them
 */
const UNSUPPORTED_ATS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "successfactors_csb", pattern: /\.successfactors\.(?:com|eu)/i },
  { name: "taleo", pattern: /\.taleo\.net/i },
  { name: "oracle_cloud", pattern: /\.oraclecloud\.com\/hcmUI/i },
  { name: "avature", pattern: /\.avature\.net/i },
  { name: "eightfold", pattern: /\.eightfold\.ai/i },
  { name: "personio", pattern: /\.personio\.(?:de|com)/i },
  { name: "bamboohr", pattern: /\.bamboohr\.com/i },
  { name: "rippling", pattern: /ats\.rippling\.com/i },
  { name: "jazzhr", pattern: /\.applytojob\.com/i },
  { name: "comeet", pattern: /\.comeet\.co/i },
];

/**
 * Candidate ATS board URLs referenced in a page's HTML (href/src/config
 * strings). Ordered by position in the document.
 */
const BOARD_URL_PATTERN = new RegExp(
  [
    String.raw`https?://[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com/[A-Za-z0-9_\-/]+`,
    String.raw`https?://[a-z0-9-]+\.teamtailor\.com`,
    String.raw`https?://[a-z0-9-]+\.recruitee\.com`,
    String.raw`https?://apply\.workable\.com/[a-z0-9-]+`,
    String.raw`https?://[a-z0-9-]+\.workable\.com`,
    String.raw`https?://jobs(?:\.eu)?\.lever\.co/[A-Za-z0-9-]+`,
    String.raw`https?://jobs\.ashbyhq\.com/[A-Za-z0-9%-]+`,
    String.raw`https?://(?:careers|jobs)\.smartrecruiters\.com/[A-Za-z0-9_-]+`,
    // embed variant must precede the generic form so ?for= survives the match
    String.raw`https?://(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io/embed/job_board\?for=[A-Za-z0-9_-]+`,
    String.raw`https?://(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io/[A-Za-z0-9_-]+`,
    String.raw`https?://[a-z0-9-]+\.icims\.com`,
  ].join("|"),
  "gi",
);

export function detectBoardUrlsInHtml(html: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of html.matchAll(BOARD_URL_PATTERN)) {
    const url = match[0]!.replace(/[")'\\,;]+$/, "");
    const key = cacheKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  return urls;
}

export function detectUnsupportedAts(html: string): string | null {
  for (const { name, pattern } of UNSUPPORTED_ATS_PATTERNS) {
    if (pattern.test(html)) return name;
  }
  return null;
}

const MAX_REDIRECT_HOPS = 5;

/** SSRF guard: only public http(s) URLs pass (shared with research routes). */
function safePublicUrl(raw: string): URL | null {
  try {
    return validateResearchUrl(raw);
  } catch {
    return null;
  }
}

export type FetchPageResult =
  | { kind: "ok"; finalUrl: string; html: string }
  | { kind: "blocked" }
  | { kind: "failed" };

/**
 * Fetch a careers page following redirects manually so every hop is
 * SSRF-validated — a public careers URL must not be able to bounce the
 * server into localhost, private ranges, or cloud metadata endpoints.
 * Shared by the board resolver and the basic HTML crawler — the only
 * self-hosted fetch path for external careers pages.
 */
export async function fetchPage(url: string): Promise<FetchPageResult> {
  let current = safePublicUrl(url);
  if (!current) return { kind: "blocked" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      const response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { kind: "failed" };
        let target: string;
        try {
          target = new URL(location, current).toString();
        } catch {
          return { kind: "failed" };
        }
        const next = safePublicUrl(target);
        if (!next) return { kind: "blocked" };
        // Redirect landed on a recognisable ATS board — no need to fetch
        // the (usually JS-only) board page itself.
        if (atsEntryFromUrl(next.toString(), { company: "probe" })) {
          return { kind: "ok", finalUrl: next.toString(), html: "" };
        }
        current = next;
        continue;
      }

      if (!response.ok) return { kind: "failed" };
      const reader = response.body?.getReader();
      if (!reader) return { kind: "ok", finalUrl: current.toString(), html: "" };
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (bytes < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          bytes += value.byteLength;
        }
      }
      await reader.cancel().catch(() => undefined);
      const html = Buffer.concat(chunks).toString("utf8");
      return { kind: "ok", finalUrl: current.toString(), html };
    }
    return { kind: "failed" }; // redirect loop / too many hops
  } catch {
    return { kind: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a careers URL to a structured ATS board entry when possible.
 * Never throws — failures return outcome "fetch_failed" so callers can fall
 * back to generic scraping.
 */
export async function resolveCareersBoard(
  careersUrl: string,
  opts: { company: string; sectorTag?: string | null; maxJobs?: number },
): Promise<BoardResolution> {
  const key = cacheKey(careersUrl);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.checkedAt.getTime() <= CACHE_TTL_MS) {
    // Re-bind company/sector for this caller: cache stores URL-level facts.
    return hit.entry ? { ...hit, entry: rebindEntry(hit, opts) } : hit;
  }

  const resolution = await resolveUncached(careersUrl, opts);
  cache.set(key, resolution);
  return resolution;
}

/**
 * Re-derive a cached entry with this caller's company/sector. SuccessFactors
 * boards aren't URL-recognisable (employer-owned domains), so they rebind via
 * the dedicated helper; everything else re-parses the board URL.
 */
function rebindEntry(
  hit: BoardResolution,
  opts: { company: string; sectorTag?: string | null; maxJobs?: number },
): AtsEmployerConfig | null {
  if (!hit.boardUrl) return hit.entry;
  if (hit.entry?.platform === "successfactors") {
    return successFactorsEntryFromUrl(hit.boardUrl, opts);
  }
  return atsEntryFromUrl(hit.boardUrl, opts);
}

/** Marker present in every server-rendered SuccessFactors RMK career site. */
const RMK_MARKER = /class="jobTitle-link"/;

async function resolveUncached(
  careersUrl: string,
  opts: { company: string; sectorTag?: string | null; maxJobs?: number },
): Promise<BoardResolution> {
  const checkedAt = new Date();

  // 0. The careers URL may itself already be a board URL.
  const direct = atsEntryFromUrl(careersUrl, opts);
  if (direct) {
    return {
      outcome: "careers_url_is_board",
      entry: direct,
      boardUrl: careersUrl,
      finalUrl: careersUrl,
      unsupportedAts: null,
      checkedAt,
    };
  }

  const page = await fetchPage(careersUrl);
  if (page.kind !== "ok") {
    return {
      outcome: page.kind === "blocked" ? "blocked_url" : "fetch_failed",
      entry: null,
      boardUrl: null,
      finalUrl: null,
      unsupportedAts: null,
      checkedAt,
    };
  }

  // 1. Redirect landed directly on a board.
  const fromFinal = atsEntryFromUrl(page.finalUrl, opts);
  if (fromFinal) {
    return {
      outcome: "redirected_to_board",
      entry: fromFinal,
      boardUrl: page.finalUrl,
      finalUrl: page.finalUrl,
      unsupportedAts: null,
      checkedAt,
    };
  }

  // 2. HTML references a supported board.
  for (const boardUrl of detectBoardUrlsInHtml(page.html)) {
    const entry = atsEntryFromUrl(boardUrl, opts);
    if (entry) {
      return {
        outcome: "board_link_in_html",
        entry,
        boardUrl,
        finalUrl: page.finalUrl,
        unsupportedAts: null,
        checkedAt,
      };
    }
  }

  // 3. Page itself is a server-rendered SuccessFactors RMK career site
  //    (employer-owned domain, so URL parsing alone can't spot it).
  if (RMK_MARKER.test(page.html)) {
    const entry = successFactorsEntryFromUrl(page.finalUrl, opts);
    if (entry) {
      return {
        outcome: "board_link_in_html",
        entry,
        boardUrl: entry.token,
        finalUrl: page.finalUrl,
        unsupportedAts: null,
        checkedAt,
      };
    }
  }

  // 4. Known-but-unsupported ATS — worth surfacing in diagnostics.
  const unsupported =
    detectUnsupportedAts(page.finalUrl) ?? detectUnsupportedAts(page.html);
  return {
    outcome: unsupported ? "unsupported_ats" : "no_board_detected",
    entry: null,
    boardUrl: null,
    finalUrl: page.finalUrl,
    unsupportedAts: unsupported,
    checkedAt,
  };
}
