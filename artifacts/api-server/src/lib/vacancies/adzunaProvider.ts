import { z } from "zod/v4";
import {
  IngestionError,
  type JobBoardQuery,
  type NormalizedVacancy,
  type ProviderFetchResult,
  type VacancyProvider,
} from "./types";

/**
 * Adzuna job-board provider — official Adzuna Search API
 * (https://developer.adzuna.com/), UK country endpoint. Requires
 * ADZUNA_APP_ID + ADZUNA_APP_KEY. sourceType "job_board": direct employer
 * copies of the same role outrank Adzuna copies in dedupe.
 */

const ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs/gb/search";
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_SIZE = 50;
const DEFAULT_MAX_RESULTS = 50;
const MAX_PAGES_PER_QUERY = 5;

const adzunaJobSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    title: z.string().nullish(),
    company: z.object({ display_name: z.string().nullish() }).loose().nullish(),
    location: z.object({ display_name: z.string().nullish() }).loose().nullish(),
    description: z.string().nullish(),
    redirect_url: z.string().nullish(),
    created: z.string().nullish(),
    salary_min: z.number().nullish(),
    salary_max: z.number().nullish(),
    contract_time: z.string().nullish(),
  })
  .loose();

const adzunaResponseSchema = z
  .object({
    results: z.array(adzunaJobSchema).nullish(),
    count: z.number().nullish(),
  })
  .loose();

function credentials(): { appId: string; appKey: string } {
  const appId = process.env["ADZUNA_APP_ID"];
  const appKey = process.env["ADZUNA_APP_KEY"];
  if (!appId || !appKey) {
    throw new IngestionError("config", "ADZUNA_APP_ID / ADZUNA_APP_KEY are not configured");
  }
  return { appId: appId.trim(), appKey: appKey.trim() };
}

/** Adzuna titles/descriptions carry <strong> highlight markup — strip it. */
export function stripAdzunaMarkup(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(/<\/?strong>/gi, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function adzunaSalaryText(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
  if (min != null && max != null && Math.round(max) !== Math.round(min)) {
    return `${fmt(min)} - ${fmt(max)}`;
  }
  return fmt((min ?? max)!);
}

async function fetchAdzunaPage(
  page: number,
  params: URLSearchParams,
): Promise<z.infer<typeof adzunaResponseSchema>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${ADZUNA_BASE_URL}/${page}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new IngestionError("timeout", "Adzuna API request timed out");
    }
    throw new IngestionError("upstream", "Could not reach the Adzuna API");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    throw new IngestionError("rate_limited", "Adzuna API rate limit reached — try again later");
  }
  if (response.status === 401 || response.status === 403) {
    throw new IngestionError("config", "Adzuna API rejected the app credentials");
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const parsed = adzunaResponseSchema.safeParse(payload);
  if (!response.ok || !parsed.success) {
    throw new IngestionError("upstream", `Adzuna API error (HTTP ${response.status})`);
  }
  return parsed.data;
}

export const adzunaProvider: VacancyProvider = {
  sourceType: "job_board",
  sourceProvider: "adzuna_api",

  async fetchVacancies(input: JobBoardQuery): Promise<ProviderFetchResult> {
    const query = input.query?.trim();
    if (!query) {
      throw new IngestionError("config", "A search query is required for Adzuna ingestion");
    }
    const { appId, appKey } = credentials();
    const maxResults = Math.max(1, input.maxResults ?? DEFAULT_MAX_RESULTS);

    const warnings: string[] = [];
    const vacancies: NormalizedVacancy[] = [];

    for (let page = 1; page <= MAX_PAGES_PER_QUERY && vacancies.length < maxResults; page++) {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: String(Math.min(PAGE_SIZE, maxResults - vacancies.length)),
        what: query,
        "content-type": "application/json",
      });
      if (input.location?.trim()) params.set("where", input.location.trim());

      const data = await fetchAdzunaPage(page, params);
      const results = data.results ?? [];
      if (results.length === 0) break;

      for (const job of results) {
        if (vacancies.length >= maxResults) break;
        const title = stripAdzunaMarkup(job.title);
        if (!title) {
          warnings.push("Skipped an Adzuna result without a title");
          continue;
        }
        const url = job.redirect_url ?? null;
        vacancies.push({
          title,
          companyName: job.company?.display_name ?? null,
          locationText: job.location?.display_name ?? null,
          remoteType: null,
          employmentType: job.contract_time === "full_time" ? "Full-time" : job.contract_time === "part_time" ? "Part-time" : null,
          salaryText: adzunaSalaryText(job.salary_min, job.salary_max),
          descriptionText: stripAdzunaMarkup(job.description),
          skills: [],
          postedAt: job.created ? new Date(job.created) : null,
          applyUrl: url,
          sourceType: "job_board",
          sourceProvider: "adzuna_api",
          sourceUrl: url,
          sectorTag: input.sectorTag ?? null,
        });
      }

      const total = data.count ?? 0;
      if (page * PAGE_SIZE >= total) break;
    }

    return { vacancies, warnings };
  },
};
