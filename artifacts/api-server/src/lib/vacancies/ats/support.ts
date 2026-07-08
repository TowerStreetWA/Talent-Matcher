import { IngestionError } from "../types";

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Shared HTTP helpers for ATS job-board fetchers. Every platform fetcher maps
 * transport failures onto IngestionError kinds the runner already understands.
 */
export async function fetchAtsResponse(
  platformLabel: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new IngestionError("timeout", `${platformLabel} request timed out`);
    }
    throw new IngestionError("upstream", `Could not reach ${platformLabel}`);
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 429) {
    throw new IngestionError("rate_limited", `${platformLabel} rate limit reached`);
  }
  return response;
}

export async function fetchAtsJson(
  platformLabel: string,
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetchAtsResponse(platformLabel, url, init);
  if (!response.ok) {
    throw new IngestionError("upstream", `${platformLabel} error (HTTP ${response.status})`);
  }
  try {
    return await response.json();
  } catch {
    throw new IngestionError("upstream", `${platformLabel} returned invalid JSON`);
  }
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITY_MAP[m] ?? m);
}

/** Strip HTML tags → plain text (best effort, for description fields). */
export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return text.length > 0 ? text : null;
}

/** Truncate long descriptions to keep rows sane. */
export function clampText(text: string | null, max = 6000): string | null {
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Best-effort Date from assorted ATS timestamp formats. */
export function parseDateLoose(raw: string | number | null | undefined): Date | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Recruitee style: "2025-12-21 10:19:52 UTC"
  const recruitee = trimmed.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/);
  const candidate = recruitee ? `${recruitee[1]}T${recruitee[2]}Z` : trimmed;
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Workday's relative "Posted Today" / "Posted 3 Days Ago" strings. */
export function parseWorkdayPostedOn(raw: string | null | undefined, now = new Date()): Date | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  if (text.includes("today")) return now;
  if (text.includes("yesterday")) return new Date(now.getTime() - 86_400_000);
  const m = text.match(/(\d+)\+?\s*days?\s*ago/);
  if (!m) return null;
  const days = Number(m[1]);
  if (!Number.isFinite(days)) return null;
  return new Date(now.getTime() - days * 86_400_000);
}

/** Case-insensitive substring match against configured location filters. */
export function matchesLocationFilter(
  locationText: string | null,
  includes: string[] | undefined,
): boolean {
  if (!includes || includes.length === 0) return true;
  if (!locationText) return false;
  const haystack = locationText.toLowerCase();
  return includes.some((needle) => haystack.includes(needle.toLowerCase()));
}
