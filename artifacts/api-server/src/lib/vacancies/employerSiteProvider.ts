import { z } from "zod/v4";
import {
  FirecrawlError,
  extractResearchJob,
  firecrawlExtractJson,
  validateResearchUrl,
} from "../firecrawl";
import { EMPLOYER_SITES, type EmployerSiteConfig } from "../../config/employerSites";
import {
  IngestionError,
  type EmployerSiteFetchInput,
  type NormalizedVacancy,
  type ProviderFetchResult,
  type VacancyProvider,
} from "./types";

const DEFAULT_MAX_JOBS_PER_SITE = 8;

const JOB_LINKS_JSON_SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      description: "Links to individual job posting detail pages found on this careers page",
      items: {
        type: "object",
        properties: {
          url: { type: "string", description: "Absolute or relative URL of the job detail page" },
          title: { type: ["string", "null"], description: "Job title shown for this link" },
        },
        required: ["url"],
      },
    },
  },
  required: ["jobs"],
} as const;

const jobLinksSchema = z.object({
  jobs: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().nullable().catch(null),
      }),
    )
    .catch([]),
});

function toIngestionError(err: unknown): IngestionError {
  if (err instanceof FirecrawlError) {
    const kind =
      err.kind === "config" ? "config" : err.kind === "timeout" ? "timeout" : "upstream";
    return new IngestionError(kind, err.message);
  }
  if (err instanceof IngestionError) return err;
  return new IngestionError("upstream", err instanceof Error ? err.message : "Unknown error");
}

/** Resolve a possibly-relative link against the careers page and validate it. */
function resolveJobUrl(raw: string, base: URL): URL | null {
  try {
    const absolute = new URL(raw, base);
    return validateResearchUrl(absolute.toString());
  } catch {
    return null;
  }
}

async function fetchSiteVacancies(
  site: EmployerSiteConfig,
  warnings: string[],
): Promise<NormalizedVacancy[]> {
  const careersUrl = validateResearchUrl(site.careersUrl);
  const rawLinks = await firecrawlExtractJson(
    careersUrl,
    "List the links to individual job posting detail pages on this careers/jobs page. Only include links that lead to a single specific job vacancy, not category or team pages.",
    JOB_LINKS_JSON_SCHEMA as unknown as Record<string, unknown>,
  );
  const parsed = jobLinksSchema.parse(rawLinks);

  const seen = new Set<string>();
  const jobUrls: URL[] = [];
  for (const link of parsed.jobs) {
    const url = resolveJobUrl(link.url, careersUrl);
    if (!url) continue;
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    jobUrls.push(url);
    if (jobUrls.length >= (site.maxJobs ?? DEFAULT_MAX_JOBS_PER_SITE)) break;
  }

  if (jobUrls.length === 0) {
    warnings.push(`${site.company}: no job detail links found on ${site.careersUrl}`);
    return [];
  }

  // Extract detail pages with limited concurrency so a full site run stays
  // well within HTTP request timeouts while remaining polite to Firecrawl.
  const results = await mapWithConcurrency(jobUrls, EXTRACT_CONCURRENCY, async (url) => {
    try {
      const job = await extractResearchJob(url);
      if (!job.title) {
        warnings.push(`${site.company}: no title extracted from ${url.toString()}`);
        return null;
      }
      const vacancy: NormalizedVacancy = {
        title: job.title,
        companyName: job.company ?? site.company,
        locationText: job.location,
        remoteType: job.remoteType,
        employmentType: job.contractType,
        salaryText: job.salaryText,
        descriptionText: job.description,
        skills: job.skills,
        postedAt: null,
        applyUrl: url.toString(),
        sourceType: "direct_employer",
        sourceProvider: "company_site",
        sourceUrl: url.toString(),
      };
      return vacancy;
    } catch (err) {
      const e = toIngestionError(err);
      if (e.kind === "config") throw e;
      warnings.push(`${site.company}: failed to extract ${url.toString()} (${e.message})`);
      return null;
    }
  });
  return results.filter((v): v is NormalizedVacancy => v !== null);
}

const EXTRACT_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export const employerSiteProvider: VacancyProvider = {
  sourceType: "direct_employer",
  sourceProvider: "company_site",

  async fetchVacancies(input: EmployerSiteFetchInput): Promise<ProviderFetchResult> {
    const companies = input.companies?.map((c) => c.toLowerCase());
    const sites = EMPLOYER_SITES.filter(
      (s) => !companies || companies.includes(s.company.toLowerCase()),
    );
    if (sites.length === 0) {
      throw new IngestionError("config", "No employer sites configured for this run");
    }

    const warnings: string[] = [];
    const vacancies: NormalizedVacancy[] = [];
    for (const site of sites) {
      try {
        vacancies.push(...(await fetchSiteVacancies(site, warnings)));
      } catch (err) {
        const e = toIngestionError(err);
        if (e.kind === "config") throw e;
        warnings.push(`${site.company}: careers page ingestion failed (${e.message})`);
      }
    }
    return { vacancies, warnings };
  },
};
