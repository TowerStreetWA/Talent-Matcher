import type { AtsEmployerConfig, AtsPlatform } from "../../config/atsEmployers";
import {
  LONDON_INSURANCE_EMPLOYERS,
  type LondonInsuranceEmployer,
  type LondonMarketSegment,
} from "../../config/londonInsuranceEmployers";
import { fetchSiteVacancies } from "./employerSiteProvider";
import {
  fetchRecruitee,
  fetchTeamtailor,
  fetchWorkable,
  fetchWorkday,
  type AtsFetcherContext,
} from "./ats/fetchers";
import type { NormalizedVacancy, ProviderFetchResult, VacancyProvider } from "./types";

/**
 * Router layer for the London Insurance Market directory
 * (config/londonInsuranceEmployers.ts, generated from the canonical md).
 *
 * Each employer's platformHint decides how its careers page is ingested:
 *   - workday / teamtailor / recruitee / workable → the existing ATS
 *     fetchers (public JSON/RSS endpoints), with the board token parsed
 *     from the careers URL;
 *   - careers_page → the generic Firecrawl careers-page scraper
 *     (employerSiteProvider.fetchSiteVacancies).
 *
 * All vacancies are re-attributed to sourceType "direct_employer" and a
 * per-segment sourceProvider (london_insurance_<segment>) so the Sources
 * view and dedupe funnel report the directory coverage per market segment.
 */

export const LONDON_SEGMENTS: LondonMarketSegment[] = [
  "lloyds_syndicate",
  "company_market",
  "mga_coverholder",
  "broker",
];

export function londonProviderKey(segment: LondonMarketSegment): string {
  return `london_insurance_${segment}`;
}

export const LONDON_PROVIDER_KEYS: string[] = LONDON_SEGMENTS.map(londonProviderKey);

/** Default per-employer job cap for generic careers-page scrapes. */
const LONDON_SITE_MAX_JOBS = 8;
/** Default per-employer job cap for structured ATS boards. */
const LONDON_ATS_MAX_JOBS = 40;

/**
 * Parse an ATS employer entry (token/instance/site) from a careers URL.
 * Returns null when the URL does not carry enough routing information for
 * the platform's public API (callers should fall back to the generic
 * careers-page scraper).
 */
export function atsEntryFromCareersUrl(
  employer: Pick<LondonInsuranceEmployer, "name" | "careersUrl" | "platformHint">,
): AtsEmployerConfig | null {
  let url: URL;
  try {
    url = new URL(employer.careersUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const labels = host.split(".");
  const pathSegments = url.pathname.split("/").filter(Boolean);

  const base = {
    company: employer.name,
    maxJobs: LONDON_ATS_MAX_JOBS,
    sectorTag: "insurance" as const,
  };

  switch (employer.platformHint) {
    case "workday": {
      // {token}.{instance}.myworkdayjobs.com/{site}[...]
      if (!host.endsWith(".myworkdayjobs.com") || labels.length < 4) return null;
      const token = labels[0]!;
      const instance = labels[1]!;
      const site = pathSegments[0];
      if (!token || !/^wd\d+$/.test(instance) || !site) return null;
      return {
        ...base,
        platform: "workday",
        token,
        workdayInstance: instance,
        workdaySite: site,
      };
    }
    case "teamtailor": {
      if (!host.endsWith(".teamtailor.com") || labels.length < 3) return null;
      return { ...base, platform: "teamtailor", token: labels[0]! };
    }
    case "recruitee": {
      if (!host.endsWith(".recruitee.com") || labels.length < 3) return null;
      return { ...base, platform: "recruitee", token: labels[0]! };
    }
    case "workable": {
      // apply.workable.com/{token} or {token}.workable.com
      if (host === "apply.workable.com" && pathSegments[0]) {
        return { ...base, platform: "workable", token: pathSegments[0] };
      }
      if (host.endsWith(".workable.com") && labels.length >= 3 && labels[0] !== "www") {
        return { ...base, platform: "workable", token: labels[0]! };
      }
      return null;
    }
    case "careers_page":
      return null;
  }
}

type AtsFetcher = (entry: AtsEmployerConfig, ctx: AtsFetcherContext) => Promise<void>;

const LONDON_ATS_FETCHERS: Partial<Record<AtsPlatform, AtsFetcher>> = {
  workday: fetchWorkday,
  teamtailor: fetchTeamtailor,
  recruitee: fetchRecruitee,
  workable: fetchWorkable,
};

function reattribute(
  vacancies: NormalizedVacancy[],
  employer: LondonInsuranceEmployer,
): NormalizedVacancy[] {
  return vacancies.map((v) => ({
    ...v,
    companyName: v.companyName ?? employer.name,
    sourceType: "direct_employer",
    sourceProvider: londonProviderKey(employer.segment),
    sectorTag: "insurance",
  }));
}

/**
 * Provider for a single directory employer. One runVacancyIngestion per
 * employer keeps funnel metrics per employer while all jobs of a segment
 * share the same job_sources row (london_insurance_<segment>).
 */
export function makeLondonEmployerProvider(employer: LondonInsuranceEmployer): VacancyProvider {
  return {
    sourceType: "direct_employer",
    sourceProvider: londonProviderKey(employer.segment),

    async fetchVacancies(): Promise<ProviderFetchResult> {
      const warnings: string[] = [];
      const atsEntry = atsEntryFromCareersUrl(employer);
      if (atsEntry) {
        const fetcher = LONDON_ATS_FETCHERS[atsEntry.platform];
        if (fetcher) {
          const ctx: AtsFetcherContext = { vacancies: [], warnings };
          await fetcher(atsEntry, ctx);
          return { vacancies: reattribute(ctx.vacancies, employer), warnings };
        }
      }
      const vacancies = await fetchSiteVacancies(
        { company: employer.name, careersUrl: employer.careersUrl, maxJobs: LONDON_SITE_MAX_JOBS },
        warnings,
      );
      return { vacancies: reattribute(vacancies, employer), warnings };
    },
  };
}

export interface LondonBatchSelection {
  employers: LondonInsuranceEmployer[];
  /** Employers excluded because another selected employer shares the same careers board. */
  sharedBoardSkips: Array<{ name: string; sharesWith: string }>;
  /** Total employers matching the filter before offset/limit paging. */
  totalMatching: number;
}

/**
 * Select a bounded batch of directory employers for one ingestion run.
 * Employers sharing a careers URL (e.g. group-level boards listed under
 * several trading names) are fetched once per batch — the first name wins.
 */
export function selectLondonEmployers(opts: {
  segments?: LondonMarketSegment[];
  employers?: string[];
  offset?: number;
  limit?: number;
}): LondonBatchSelection {
  const segmentSet = opts.segments?.length ? new Set(opts.segments) : null;
  const nameSet = opts.employers?.length
    ? new Set(opts.employers.map((n) => n.trim().toLowerCase()))
    : null;

  const matching = LONDON_INSURANCE_EMPLOYERS.filter((e) => {
    if (segmentSet && !segmentSet.has(e.segment)) return false;
    if (nameSet && !nameSet.has(e.name.toLowerCase())) return false;
    return true;
  });

  const seenUrls = new Map<string, string>();
  const deduped: LondonInsuranceEmployer[] = [];
  const sharedBoardSkips: Array<{ name: string; sharesWith: string }> = [];
  for (const e of matching) {
    const urlKey = e.careersUrl.toLowerCase().replace(/\/+$/, "");
    const owner = seenUrls.get(urlKey);
    if (owner) {
      sharedBoardSkips.push({ name: e.name, sharesWith: owner });
      continue;
    }
    seenUrls.set(urlKey, e.name);
    deduped.push(e);
  }

  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.max(1, opts.limit ?? deduped.length);
  return {
    employers: deduped.slice(offset, offset + limit),
    sharedBoardSkips,
    totalMatching: deduped.length,
  };
}
