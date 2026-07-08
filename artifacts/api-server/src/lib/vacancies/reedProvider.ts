import { z } from "zod/v4";
import {
  IngestionError,
  type JobBoardQuery,
  type NormalizedVacancy,
  type ProviderFetchResult,
  type VacancyProvider,
} from "./types";

/**
 * Reed job-board provider — official Reed Jobseeker API
 * (https://www.reed.co.uk/api). Basic auth with the API key as username.
 * sourceType "job_board": in dedupe, direct employer and Google-on-employer-
 * domain copies outrank Reed copies of the same role.
 */

const REED_BASE_URL = "https://www.reed.co.uk/api/1.0/search";
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_SIZE = 100;
const DEFAULT_MAX_RESULTS = 50;
const MAX_PAGES_PER_QUERY = 5;

const reedJobSchema = z
  .object({
    jobId: z.number().nullish(),
    employerName: z.string().nullish(),
    jobTitle: z.string().nullish(),
    locationName: z.string().nullish(),
    minimumSalary: z.number().nullish(),
    maximumSalary: z.number().nullish(),
    currency: z.string().nullish(),
    date: z.string().nullish(),
    jobDescription: z.string().nullish(),
    jobUrl: z.string().nullish(),
  })
  .loose();

const reedResponseSchema = z
  .object({
    results: z.array(reedJobSchema).nullish(),
    totalResults: z.number().nullish(),
  })
  .loose();

function apiKey(): string {
  const key = process.env["REED_API_KEY"];
  if (!key) {
    throw new IngestionError("config", "REED_API_KEY is not configured");
  }
  return key.trim();
}

/** Reed posts dates as "DD/MM/YYYY". */
export function parseReedDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function reedSalaryText(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (min == null && max == null) return null;
  const symbol = currency === "GBP" || currency == null ? "£" : `${currency} `;
  const fmt = (n: number) => `${symbol}${Math.round(n).toLocaleString("en-GB")}`;
  if (min != null && max != null && max !== min) return `${fmt(min)} - ${fmt(max)}`;
  return fmt((min ?? max)!);
}

async function fetchReedPage(
  key: string,
  params: URLSearchParams,
): Promise<z.infer<typeof reedResponseSchema>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${REED_BASE_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new IngestionError("timeout", "Reed API request timed out");
    }
    throw new IngestionError("upstream", "Could not reach the Reed API");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    throw new IngestionError("rate_limited", "Reed API rate limit reached — try again later");
  }
  if (response.status === 401 || response.status === 403) {
    throw new IngestionError("config", "Reed API rejected the API key");
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const parsed = reedResponseSchema.safeParse(payload);
  if (!response.ok || !parsed.success) {
    throw new IngestionError("upstream", `Reed API error (HTTP ${response.status})`);
  }
  return parsed.data;
}

export const reedProvider: VacancyProvider = {
  sourceType: "job_board",
  sourceProvider: "reed_api",

  async fetchVacancies(input: JobBoardQuery): Promise<ProviderFetchResult> {
    const query = input.query?.trim();
    if (!query) {
      throw new IngestionError("config", "A search query is required for Reed ingestion");
    }
    const key = apiKey();
    const maxResults = Math.max(1, input.maxResults ?? DEFAULT_MAX_RESULTS);

    const warnings: string[] = [];
    const vacancies: NormalizedVacancy[] = [];

    for (let page = 0; page < MAX_PAGES_PER_QUERY && vacancies.length < maxResults; page++) {
      const params = new URLSearchParams({
        keywords: query,
        resultsToTake: String(Math.min(PAGE_SIZE, maxResults - vacancies.length)),
        resultsToSkip: String(page * PAGE_SIZE),
      });
      if (input.location?.trim()) params.set("locationName", input.location.trim());

      const data = await fetchReedPage(key, params);
      const results = data.results ?? [];
      if (results.length === 0) break;

      for (const job of results) {
        if (vacancies.length >= maxResults) break;
        if (!job.jobTitle) {
          warnings.push("Skipped a Reed result without a title");
          continue;
        }
        const url = job.jobUrl ?? (job.jobId != null ? `https://www.reed.co.uk/jobs/${job.jobId}` : null);
        vacancies.push({
          title: job.jobTitle,
          companyName: job.employerName ?? null,
          locationText: job.locationName ?? null,
          remoteType: null,
          employmentType: null,
          salaryText: reedSalaryText(job.minimumSalary, job.maximumSalary, job.currency),
          descriptionText: job.jobDescription ?? null,
          skills: [],
          postedAt: parseReedDate(job.date),
          applyUrl: url,
          sourceType: "job_board",
          sourceProvider: "reed_api",
          sourceUrl: url,
          sectorTag: input.sectorTag ?? null,
        });
      }

      const total = data.totalResults ?? 0;
      if ((page + 1) * PAGE_SIZE >= total) break;
    }

    return { vacancies, warnings };
  },
};
