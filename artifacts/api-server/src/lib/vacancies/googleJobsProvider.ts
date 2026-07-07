import { z } from "zod/v4";
import { isAggregatorHost } from "./dedupe";
import {
  IngestionError,
  type GoogleJobsQuery,
  type NormalizedVacancy,
  type ProviderFetchResult,
  type VacancyProvider,
} from "./types";

const SERPAPI_BASE_URL = "https://serpapi.com/search.json";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RESULTS = 10;

const applyOptionSchema = z
  .object({
    title: z.string().nullish(),
    link: z.string().nullish(),
  })
  .loose();

const jobResultSchema = z
  .object({
    title: z.string().nullish(),
    company_name: z.string().nullish(),
    location: z.string().nullish(),
    description: z.string().nullish(),
    share_link: z.string().nullish(),
    apply_options: z.array(applyOptionSchema).nullish(),
    detected_extensions: z
      .object({
        posted_at: z.string().nullish(),
        schedule_type: z.string().nullish(),
        salary: z.string().nullish(),
        work_from_home: z.boolean().nullish(),
      })
      .loose()
      .nullish(),
  })
  .loose();

const serpApiResponseSchema = z
  .object({
    error: z.string().nullish(),
    jobs_results: z.array(jobResultSchema).nullish(),
  })
  .loose();

function apiKey(): string {
  const key = process.env["SERPAPI_API_KEY"];
  if (!key) {
    throw new IngestionError("config", "SERPAPI_API_KEY is not configured");
  }
  return key.trim();
}

/** Parse SerpApi's relative "posted_at" strings ("3 days ago") best-effort. */
export function parsePostedAt(raw: string | null | undefined, now = new Date()): Date | null {
  if (!raw) return null;
  const m = raw.toLowerCase().match(/(\d+)\s*(minute|hour|day|week|month)s?\s*ago/);
  if (!m) return null;
  const value = Number(m[1]);
  const unitMs: Record<string, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 7 * 86_400_000,
    month: 30 * 86_400_000,
  };
  const ms = unitMs[m[2]!];
  if (!ms || !Number.isFinite(value)) return null;
  return new Date(now.getTime() - value * ms);
}

/**
 * Choose the best job detail URL: prefer an apply link on the employer's own
 * domain over aggregator links; fall back to the first apply link, then the
 * Google share link.
 */
function pickSourceUrl(job: z.infer<typeof jobResultSchema>): string | null {
  const links = (job.apply_options ?? [])
    .map((o) => o.link)
    .filter((l): l is string => typeof l === "string" && l.length > 0);
  const employerLink = links.find((l) => !isAggregatorHost(l));
  return employerLink ?? links[0] ?? job.share_link ?? null;
}

export const googleJobsProvider: VacancyProvider = {
  sourceType: "google_jobs",
  sourceProvider: "google_jobs_serpapi",

  async fetchVacancies(input: GoogleJobsQuery): Promise<ProviderFetchResult> {
    const query = input.query?.trim();
    if (!query) {
      throw new IngestionError("config", "A search query is required for Google Jobs ingestion");
    }
    const q = input.company ? `${query} ${input.company.trim()}` : query;

    const params = new URLSearchParams({
      engine: "google_jobs",
      q,
      hl: "en",
      gl: "gb",
      api_key: apiKey(),
    });
    if (input.location?.trim()) params.set("location", input.location.trim());

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${SERPAPI_BASE_URL}?${params.toString()}`, {
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new IngestionError("timeout", "Google Jobs (SerpApi) request timed out");
      }
      throw new IngestionError("upstream", "Could not reach SerpApi");
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) {
      throw new IngestionError("rate_limited", "SerpApi rate limit reached — try again later");
    }
    if (response.status === 401 || response.status === 403) {
      throw new IngestionError("config", "SerpApi rejected the API key");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const parsed = serpApiResponseSchema.safeParse(payload);
    if (!response.ok || !parsed.success) {
      throw new IngestionError("upstream", `SerpApi error (HTTP ${response.status})`);
    }
    if (parsed.data.error) {
      // SerpApi reports "no results" as an error string; treat as empty.
      if (/hasn't returned any results|no results/i.test(parsed.data.error)) {
        return { vacancies: [], warnings: [] };
      }
      throw new IngestionError("upstream", `SerpApi error: ${parsed.data.error}`);
    }

    const warnings: string[] = [];
    const vacancies: NormalizedVacancy[] = [];
    for (const job of (parsed.data.jobs_results ?? []).slice(0, MAX_RESULTS)) {
      if (!job.title) {
        warnings.push("Skipped a Google Jobs result without a title");
        continue;
      }
      const ext = job.detected_extensions;
      vacancies.push({
        title: job.title,
        companyName: job.company_name ?? null,
        locationText: job.location ?? null,
        remoteType: ext?.work_from_home ? "remote" : null,
        employmentType: ext?.schedule_type ?? null,
        salaryText: ext?.salary ?? null,
        descriptionText: job.description ?? null,
        skills: [],
        postedAt: parsePostedAt(ext?.posted_at),
        applyUrl: pickSourceUrl(job),
        sourceType: "google_jobs",
        sourceProvider: "google_jobs_serpapi",
        sourceUrl: pickSourceUrl(job),
      });
    }
    return { vacancies, warnings };
  },
};
