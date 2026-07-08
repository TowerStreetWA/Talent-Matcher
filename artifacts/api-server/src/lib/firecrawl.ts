import { z } from "zod/v4";

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v2";
const REQUEST_TIMEOUT_MS = 60_000;
const PAGE_TIMEOUT_MS = 30_000;

export type FirecrawlErrorKind = "config" | "blocked_url" | "upstream" | "timeout";

export class FirecrawlError extends Error {
  readonly kind: FirecrawlErrorKind;

  constructor(kind: FirecrawlErrorKind, message: string) {
    super(message);
    this.name = "FirecrawlError";
    this.kind = kind;
  }
}

/**
 * Firecrawl availability circuit breaker. When credits run out every call
 * fails identically, so callers with a self-hosted fallback (the careers
 * directory engine) can skip Firecrawl entirely and surface a clear
 * "needs_firecrawl" diagnostic instead of hammering a dead upstream.
 */
export type FirecrawlUnavailableReason = "disabled" | "not_configured" | "no_credits";

export interface FirecrawlUnavailability {
  reason: FirecrawlUnavailableReason;
  message: string;
  /** null = permanent until config changes; otherwise re-probe after this. */
  until: Date | null;
}

const NO_CREDITS_BACKOFF_MS = 30 * 60 * 1000; // re-probe every 30 min post top-up
const NO_CREDITS_PATTERN = /insufficient credits|payment required|upgrade your plan/i;

let noCreditsUntil: Date | null = null;
let noCreditsMessage = "";

/** Returns why Firecrawl is unavailable right now, or null when usable. */
export function firecrawlUnavailability(): FirecrawlUnavailability | null {
  if (process.env["FIRECRAWL_DISABLED"] === "true") {
    return {
      reason: "disabled",
      message: "Firecrawl is disabled via FIRECRAWL_DISABLED",
      until: null,
    };
  }
  if (!process.env["FIRECRAWL_API_KEY"]) {
    return {
      reason: "not_configured",
      message: "FIRECRAWL_API_KEY is not configured",
      until: null,
    };
  }
  if (noCreditsUntil && noCreditsUntil.getTime() > Date.now()) {
    return { reason: "no_credits", message: noCreditsMessage, until: noCreditsUntil };
  }
  return null;
}

/** Test hook / manual reset after a credit top-up. */
export function clearFirecrawlNoCreditsFlag(): void {
  noCreditsUntil = null;
  noCreditsMessage = "";
}

function noteFirecrawlOutcome(err: unknown): void {
  if (
    err instanceof FirecrawlError &&
    err.kind === "upstream" &&
    NO_CREDITS_PATTERN.test(err.message)
  ) {
    noCreditsUntil = new Date(Date.now() + NO_CREDITS_BACKOFF_MS);
    noCreditsMessage = err.message;
  }
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "broadcasthost"]);
const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localdomain", ".home.arpa"];

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return true; // malformed — treat as blocked
  const [a, b] = octets as [number, number, number, number];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    h === "::" ||
    h === "::1" ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h.startsWith("fe80") ||
    h.startsWith("::ffff:")
  );
}

/**
 * Validate a user-supplied research URL. Only public http(s) URLs are
 * allowed; localhost, private/link-local IPs, and internal hostnames are
 * rejected to keep the endpoint SSRF-safe even though fetching happens on
 * Firecrawl's infrastructure.
 */
export function validateResearchUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new FirecrawlError("blocked_url", "Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new FirecrawlError("blocked_url", "Only http and https URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new FirecrawlError("blocked_url", "URLs with embedded credentials are not allowed");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    !host.includes(".") ||
    isPrivateIpv4(host) ||
    (host.includes(":") && isPrivateIpv6(host)) ||
    host.startsWith("[")
  ) {
    throw new FirecrawlError("blocked_url", "This URL points to a blocked or internal host");
  }
  return parsed;
}

const scrapeMetadataSchema = z
  .object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    ogSiteName: z.string().nullish(),
    language: z.string().nullish(),
    statusCode: z.number().nullish(),
    sourceURL: z.string().nullish(),
  })
  .loose();

const scrapeResponseSchema = z
  .object({
    success: z.boolean().optional(),
    data: z
      .object({
        markdown: z.string().nullish(),
        json: z.unknown().nullish(),
        metadata: scrapeMetadataSchema.nullish(),
      })
      .loose()
      .nullish(),
    error: z.string().nullish(),
  })
  .loose();

export const extractedJobSchema = z.object({
  title: z.string().nullable().catch(null),
  company: z.string().nullable().catch(null),
  location: z.string().nullable().catch(null),
  salaryText: z.string().nullable().catch(null),
  contractType: z.string().nullable().catch(null),
  description: z.string().nullable().catch(null),
  skills: z.array(z.string()).catch([]),
  experienceLevel: z.string().nullable().catch(null),
  remoteType: z.string().nullable().catch(null),
  confidenceNotes: z.string().nullable().catch(null),
});

export type ExtractedJobFields = z.infer<typeof extractedJobSchema>;

export interface ScrapedPageResult {
  markdown: string;
  metadata: {
    title: string | null;
    description: string | null;
    siteName: string | null;
    language: string | null;
    statusCode: number | null;
    sourceUrl: string;
  };
}

const JOB_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: ["string", "null"], description: "Job title exactly as posted" },
    company: { type: ["string", "null"], description: "Hiring company name" },
    location: { type: ["string", "null"], description: "Job location (city/country)" },
    salaryText: {
      type: ["string", "null"],
      description: "Salary or compensation exactly as written, or null if absent",
    },
    contractType: {
      type: ["string", "null"],
      description: "e.g. permanent, contract, freelance, internship",
    },
    description: {
      type: ["string", "null"],
      description: "Concise summary of the role and responsibilities (max ~1200 chars)",
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Distinct technical and professional skills mentioned",
    },
    experienceLevel: {
      type: ["string", "null"],
      description: "e.g. junior, mid, senior, lead, principal",
    },
    remoteType: {
      type: ["string", "null"],
      description: "e.g. remote, hybrid, on-site",
    },
    confidenceNotes: {
      type: ["string", "null"],
      description:
        "Short note on extraction confidence: fields that were missing, ambiguous, or inferred",
    },
  },
  required: ["title", "company", "location", "skills"],
} as const;

function apiKey(): string {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) {
    throw new FirecrawlError("config", "FIRECRAWL_API_KEY is not configured");
  }
  return key;
}

async function firecrawlScrape(body: Record<string, unknown>): Promise<
  z.infer<typeof scrapeResponseSchema>
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof FirecrawlError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new FirecrawlError("timeout", "Firecrawl request timed out");
    }
    throw new FirecrawlError("upstream", "Could not reach Firecrawl");
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const parsed = scrapeResponseSchema.safeParse(payload);
  if (!response.ok || !parsed.success || parsed.data.success === false || !parsed.data.data) {
    const upstreamMessage =
      (parsed.success ? parsed.data.error : null) ?? `Firecrawl error (HTTP ${response.status})`;
    const error = new FirecrawlError("upstream", upstreamMessage);
    noteFirecrawlOutcome(error);
    throw error;
  }
  // A successful call proves credits are back — clear any stale flag.
  clearFirecrawlNoCreditsFlag();
  return parsed.data;
}

export async function scrapeResearchPage(url: URL): Promise<ScrapedPageResult> {
  const result = await firecrawlScrape({
    url: url.toString(),
    formats: ["markdown"],
    onlyMainContent: true,
    timeout: PAGE_TIMEOUT_MS,
  });
  const data = result.data;
  const metadata = data?.metadata ?? {};
  return {
    markdown: data?.markdown ?? "",
    metadata: {
      title: metadata.title ?? null,
      description: metadata.description ?? null,
      siteName: metadata.ogSiteName ?? null,
      language: metadata.language ?? null,
      statusCode: metadata.statusCode ?? null,
      sourceUrl: metadata.sourceURL ?? url.toString(),
    },
  };
}

/**
 * Generic structured extraction: scrape a page and return the raw JSON produced
 * by Firecrawl for the given prompt + JSON schema. Callers must validate the
 * result themselves (e.g. with zod).
 */
export async function firecrawlExtractJson(
  url: URL,
  prompt: string,
  schema: Record<string, unknown>,
): Promise<unknown> {
  const result = await firecrawlScrape({
    url: url.toString(),
    formats: [{ type: "json", prompt, schema }],
    onlyMainContent: true,
    timeout: PAGE_TIMEOUT_MS,
  });
  const raw = result.data?.json;
  if (raw == null || typeof raw !== "object") {
    throw new FirecrawlError("upstream", "Firecrawl returned no structured data");
  }
  return raw;
}

export async function extractResearchJob(url: URL): Promise<ExtractedJobFields> {
  const result = await firecrawlScrape({
    url: url.toString(),
    formats: [
      {
        type: "json",
        prompt:
          "Extract the job vacancy posted on this page. Use null for any field not present. Do not invent salary or location data.",
        schema: JOB_EXTRACTION_JSON_SCHEMA,
      },
    ],
    onlyMainContent: true,
    timeout: PAGE_TIMEOUT_MS,
  });
  const raw = result.data?.json;
  if (raw == null || typeof raw !== "object") {
    throw new FirecrawlError("upstream", "Firecrawl returned no structured job data");
  }
  return extractedJobSchema.parse(raw);
}
