import type { AtsEmployerConfig, AtsPlatform } from "../../config/atsEmployers";
import {
  fetchAshby,
  fetchGreenhouse,
  fetchIcims,
  fetchLever,
  fetchRecruitee,
  fetchSmartRecruiters,
  fetchSuccessFactors,
  fetchTeamtailor,
  fetchWorkable,
  fetchWorkday,
  type AtsFetcherContext,
} from "../vacancies/ats/fetchers";
import { fetchSiteVacancies } from "../vacancies/employerSiteProvider";
import { firecrawlUnavailability } from "../firecrawl";
import type {
  NormalizedVacancy,
  ProviderFetchResult,
  VacancyProvider,
} from "../vacancies/types";
import { crawlBasicHtmlCareersPage } from "./basicHtmlCrawler";
import { recordIngestionPath } from "./ingestionPathRegistry";
import { resolveCareersBoard } from "./resolveCareersBoard";

/**
 * Generic careers-directory ingestion engine.
 *
 * A "directory" is a config-only list of employers (name + careersUrl +
 * segment) for one industry — e.g. the London Insurance Market directory —
 * plus routing/sweep metadata (config/careersDirectories.ts). This module
 * turns directory employers into vacancy providers:
 *
 *   - ATS-hosted boards (platformHint or resolved board URL) → the existing
 *     structured ATS fetchers, token parsed from the URL;
 *   - generic careers pages → careers→board resolution first (JS-heavy
 *     corporate shells often just embed/link an ATS board), then the
 *     Firecrawl careers-page scraper as the true fallback.
 *
 * All vacancies are re-attributed to sourceType "direct_employer" and a
 * per-segment sourceProvider (`<providerPrefix>_<segment>`) so Sources and
 * dedupe report directory coverage per market segment.
 */

/** ATS platform detected from a careers URL; careers_page = generic HTML site. */
export type DirectoryPlatformHint = AtsPlatform | "careers_page";

export interface CareersDirectoryEmployer {
  name: string;
  careersUrl: string;
  /** Directory-specific segment key (e.g. lloyds_syndicate, retail_bank). */
  segment: string;
  platformHint: DirectoryPlatformHint;
  /** Industry tag stamped on vacancies (FS taxonomy sector key). */
  sectorTag: string;
  notes?: string;
}

export interface CareersDirectorySweepConfig {
  /** Hour-slot count: employer idx % slots === UTC hour % slots (24 = ~daily). */
  slots: number;
  /** Include this directory in the scheduled sweep. */
  enabled: boolean;
}

export interface CareersDirectoryConfig {
  /** Stable directory key used in endpoints (e.g. "london_insurance"). */
  key: string;
  label: string;
  /** Industry / FS taxonomy sector key (insurance, banking, ...). */
  industry: string;
  /**
   * sourceProvider prefix: providers are `<prefix>_<segment>`. The London
   * insurance directory keeps its legacy "london_insurance" prefix.
   */
  providerPrefix: string;
  segments: readonly string[];
  employers: readonly CareersDirectoryEmployer[];
  unresolved: ReadonlyArray<{ name: string; segment: string; reason: string }>;
  sweep: CareersDirectorySweepConfig;
}

/** Default per-employer job cap for generic careers-page scrapes. */
export const DIRECTORY_SITE_MAX_JOBS = 8;
/** Default per-employer job cap for structured ATS boards. */
export const DIRECTORY_ATS_MAX_JOBS = 40;

export function directoryProviderKey(
  directory: Pick<CareersDirectoryConfig, "providerPrefix">,
  segment: string,
): string {
  return `${directory.providerPrefix}_${segment}`;
}

export function directoryProviderKeys(directory: CareersDirectoryConfig): string[] {
  return directory.segments.map((s) => directoryProviderKey(directory, s));
}

/** Locale path segments Workday inserts before the site name (en-US, en_GB...). */
const WORKDAY_LOCALE_SEGMENT = /^[a-z]{2}[-_][A-Za-z]{2}$/;

/**
 * Detect an ATS platform + board entry purely from a URL. Returns null when
 * the URL does not carry enough routing information for the platform's
 * public API. Used both for directory platformHints and by the
 * careers→board resolver on discovered board links.
 */
export function atsEntryFromUrl(
  rawUrl: string,
  opts: { company: string; sectorTag?: string | null; maxJobs?: number },
): AtsEmployerConfig | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const labels = host.split(".");
  const pathSegments = url.pathname.split("/").filter(Boolean);

  const base = {
    company: opts.company,
    maxJobs: opts.maxJobs ?? DIRECTORY_ATS_MAX_JOBS,
    sectorTag: opts.sectorTag ?? null,
  };

  // {token}.{wdN}.myworkdayjobs.com/[{locale}/]{site}
  if (host.endsWith(".myworkdayjobs.com") && labels.length >= 4) {
    const token = labels[0]!;
    const instance = labels[1]!;
    let site: string | undefined = pathSegments[0];
    if (site && WORKDAY_LOCALE_SEGMENT.test(site)) site = pathSegments[1];
    if (site === "wday") site = undefined;
    if (token && /^wd\d+$/.test(instance) && site) {
      return {
        ...base,
        platform: "workday",
        token,
        workdayInstance: instance,
        workdaySite: site,
      };
    }
    return null;
  }
  if (host.endsWith(".teamtailor.com") && labels.length >= 3 && labels[0] !== "www") {
    return { ...base, platform: "teamtailor", token: labels[0]! };
  }
  if (host.endsWith(".recruitee.com") && labels.length >= 3 && labels[0] !== "www") {
    return { ...base, platform: "recruitee", token: labels[0]! };
  }
  // apply.workable.com/{token} or {token}.workable.com
  if (host === "apply.workable.com" && pathSegments[0] && pathSegments[0] !== "api") {
    return { ...base, platform: "workable", token: pathSegments[0] };
  }
  if (
    host.endsWith(".workable.com") &&
    labels.length >= 3 &&
    !["www", "apply", "jobs", "help"].includes(labels[0]!)
  ) {
    return { ...base, platform: "workable", token: labels[0]! };
  }
  // jobs.lever.co/{token} (also jobs.eu.lever.co/{token})
  if ((host === "jobs.lever.co" || host === "jobs.eu.lever.co") && pathSegments[0]) {
    return { ...base, platform: "lever", token: pathSegments[0] };
  }
  // jobs.ashbyhq.com/{token}
  if (host === "jobs.ashbyhq.com" && pathSegments[0]) {
    return { ...base, platform: "ashby", token: pathSegments[0] };
  }
  // careers.smartrecruiters.com/{Token} or jobs.smartrecruiters.com/{Token}
  if (
    (host === "careers.smartrecruiters.com" || host === "jobs.smartrecruiters.com") &&
    pathSegments[0]
  ) {
    return { ...base, platform: "smartrecruiters", token: pathSegments[0] };
  }
  // boards.greenhouse.io/{token}, job-boards[.eu].greenhouse.io/{token},
  // or the embed form .../embed/job_board?for={token}
  if (
    host === "boards.greenhouse.io" ||
    host === "job-boards.greenhouse.io" ||
    host === "boards.eu.greenhouse.io" ||
    host === "job-boards.eu.greenhouse.io"
  ) {
    const token =
      pathSegments[0] === "embed"
        ? url.searchParams.get("for")
        : pathSegments[0];
    if (token && token !== "v1" && token !== "embed") {
      return { ...base, platform: "greenhouse", token: token.toLowerCase() };
    }
    return null;
  }
  // {tenant}.icims.com — the tenant subdomain is the portal token; the
  // fetcher reads the server-rendered /jobs/search iframe page.
  if (
    host.endsWith(".icims.com") &&
    labels.length >= 3 &&
    !["www", "media", "cdn", "jobs", "status", "help", "care", "community"].includes(labels[0]!)
  ) {
    return { ...base, platform: "icims", token: labels[0]! };
  }
  return null;
}

/**
 * Build a SuccessFactors RMK entry from a career-site URL. RMK sites live on
 * employer-owned domains (e.g. https://jobs.sap.com) so they cannot be
 * recognised from the URL alone — callers use this when the platform is
 * already known (directory platformHint, RMK HTML sniff, cached resolution).
 * The entry token is the site's base origin.
 */
export function successFactorsEntryFromUrl(
  rawUrl: string,
  opts: { company: string; sectorTag?: string | null; maxJobs?: number },
): AtsEmployerConfig | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return {
    company: opts.company,
    maxJobs: opts.maxJobs ?? DIRECTORY_ATS_MAX_JOBS,
    sectorTag: opts.sectorTag ?? null,
    platform: "successfactors",
    token: url.origin,
  };
}

type AtsFetcher = (entry: AtsEmployerConfig, ctx: AtsFetcherContext) => Promise<void>;

export const DIRECTORY_ATS_FETCHERS: Record<AtsPlatform, AtsFetcher> = {
  lever: fetchLever,
  ashby: fetchAshby,
  workable: fetchWorkable,
  smartrecruiters: fetchSmartRecruiters,
  recruitee: fetchRecruitee,
  teamtailor: fetchTeamtailor,
  workday: fetchWorkday,
  greenhouse: fetchGreenhouse,
  icims: fetchIcims,
  successfactors: fetchSuccessFactors,
};

function reattribute(
  vacancies: NormalizedVacancy[],
  directory: CareersDirectoryConfig,
  employer: CareersDirectoryEmployer,
): NormalizedVacancy[] {
  return vacancies.map((v) => ({
    ...v,
    companyName: v.companyName ?? employer.name,
    sourceType: "direct_employer",
    sourceProvider: directoryProviderKey(directory, employer.segment),
    sectorTag: employer.sectorTag,
  }));
}

async function fetchViaAts(
  entry: AtsEmployerConfig,
  warnings: string[],
): Promise<NormalizedVacancy[]> {
  const ctx: AtsFetcherContext = { vacancies: [], warnings };
  await DIRECTORY_ATS_FETCHERS[entry.platform](entry, ctx);
  return ctx.vacancies;
}

/**
 * Provider for a single directory employer. One runVacancyIngestion per
 * employer keeps funnel metrics per employer while all jobs of a segment
 * share the same job_sources row (`<prefix>_<segment>`).
 */
export function makeDirectoryEmployerProvider(
  directory: CareersDirectoryConfig,
  employer: CareersDirectoryEmployer,
): VacancyProvider {
  return {
    sourceType: "direct_employer",
    sourceProvider: directoryProviderKey(directory, employer.segment),

    async fetchVacancies(): Promise<ProviderFetchResult> {
      const warnings: string[] = [];
      const atsOpts = { company: employer.name, sectorTag: employer.sectorTag };
      const url = employer.careersUrl;
      const done = (
        vacancies: NormalizedVacancy[],
        record: Parameters<typeof recordIngestionPath>[1],
      ): ProviderFetchResult => {
        recordIngestionPath(url, record);
        return { vacancies: reattribute(vacancies, directory, employer), warnings };
      };

      // 1. Directory says the careers URL is itself an ATS board.
      if (employer.platformHint !== "careers_page") {
        const entry =
          employer.platformHint === "successfactors"
            ? successFactorsEntryFromUrl(url, atsOpts)
            : atsEntryFromUrl(url, atsOpts);
        if (entry && entry.platform === employer.platformHint) {
          const vacancies = await fetchViaAts(entry, warnings);
          return done(vacancies, {
            path: "ats",
            outcome: vacancies.length > 0 ? "jobs_found" : "no_jobs",
            jobs: vacancies.length,
            detail: entry.platform,
          });
        }
        warnings.push(
          `${employer.name}: careers URL did not parse as ${employer.platformHint} board — falling back`,
        );
      }

      // 2. Careers→board resolution: JS-heavy corporate pages often redirect
      //    to or embed a hosted ATS board the generic scraper can't read.
      const resolution = await resolveCareersBoard(url, atsOpts);
      if (resolution.entry) {
        const vacancies = await fetchViaAts(resolution.entry, warnings);
        if (vacancies.length > 0) {
          return done(vacancies, {
            path: "ats",
            outcome: "jobs_found",
            jobs: vacancies.length,
            detail: resolution.entry.platform,
          });
        }
        warnings.push(
          `${employer.name}: resolved to ${resolution.entry.platform} board (${resolution.boardUrl}) but it returned 0 jobs`,
        );
        return done([], {
          path: "ats",
          outcome: "no_jobs",
          jobs: 0,
          detail: resolution.entry.platform,
        });
      }
      if (resolution.outcome === "blocked_url") {
        warnings.push(`${employer.name}: careers URL blocked by SSRF guard`);
        return done([], { path: null, outcome: "blocked_url", jobs: 0, detail: null });
      }

      // 3. Basic self-hosted HTML crawl: simple/static careers pages are
      //    extracted directly so Firecrawl credits are reserved for
      //    genuinely JS-heavy sites.
      const crawl = await crawlBasicHtmlCareersPage(url);
      if (crawl.outcome === "blocked_url") {
        warnings.push(`${employer.name}: careers URL blocked by SSRF guard`);
        return done([], { path: null, outcome: "blocked_url", jobs: 0, detail: null });
      }
      if (crawl.outcome === "html_jobs_found") {
        const vacancies: NormalizedVacancy[] = crawl.jobs.map((job) => ({
          title: job.title,
          companyName: employer.name,
          locationText: job.locationText,
          remoteType: null,
          employmentType: null,
          salaryText: null,
          descriptionText: job.descriptionText,
          skills: [],
          postedAt: null,
          applyUrl: job.applyUrl,
          sourceType: "direct_employer",
          sourceProvider: "basic_html",
          sourceUrl: job.applyUrl,
        }));
        return done(vacancies, {
          path: "basic_html",
          outcome: "jobs_found",
          jobs: vacancies.length,
          detail: crawl.evidence.join(","),
        });
      }
      if (crawl.outcome === "html_no_jobs" && !crawl.jsHeavy) {
        // Static page parsed fine and genuinely lists no vacancies — do not
        // burn Firecrawl credits re-reading an empty page.
        warnings.push(`${employer.name}: static careers page lists no vacancies`);
        return done([], { path: "basic_html", outcome: "html_no_jobs", jobs: 0, detail: null });
      }

      // 4. JS-heavy (or unfetchable) page → Firecrawl, when it is usable.
      const unavailable = firecrawlUnavailability();
      if (unavailable) {
        warnings.push(
          `${employer.name}: JS-heavy careers page needs Firecrawl but it is unavailable (${unavailable.reason}: ${unavailable.message})`,
        );
        return done([], {
          path: null,
          outcome: "needs_firecrawl",
          jobs: 0,
          detail: unavailable.reason,
        });
      }
      try {
        const vacancies = await fetchSiteVacancies(
          { company: employer.name, careersUrl: url, maxJobs: DIRECTORY_SITE_MAX_JOBS },
          warnings,
        );
        return done(vacancies, {
          path: "firecrawl",
          outcome: vacancies.length > 0 ? "jobs_found" : "no_jobs",
          jobs: vacancies.length,
          detail: null,
        });
      } catch (err) {
        recordIngestionPath(url, {
          path: "firecrawl",
          outcome: firecrawlUnavailability() ? "needs_firecrawl" : "error",
          jobs: 0,
          detail: err instanceof Error ? err.message.slice(0, 200) : "unknown error",
        });
        throw err;
      }
    },
  };
}

export interface DirectoryBatchSelection {
  employers: CareersDirectoryEmployer[];
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
export function selectDirectoryEmployers(
  directory: CareersDirectoryConfig,
  opts: {
    segments?: string[];
    employers?: string[];
    offset?: number;
    limit?: number;
  },
): DirectoryBatchSelection {
  const segmentSet = opts.segments?.length ? new Set(opts.segments) : null;
  const nameSet = opts.employers?.length
    ? new Set(opts.employers.map((n) => n.trim().toLowerCase()))
    : null;

  const matching = directory.employers.filter((e) => {
    if (segmentSet && !segmentSet.has(e.segment)) return false;
    if (nameSet && !nameSet.has(e.name.toLowerCase())) return false;
    return true;
  });

  const seenUrls = new Map<string, string>();
  const deduped: CareersDirectoryEmployer[] = [];
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
