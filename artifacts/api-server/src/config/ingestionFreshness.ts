/**
 * Freshness thresholds for ingested vacancies — pure configuration.
 *
 * A job discovered by an ingestion provider is considered stale (and is
 * marked "expired" by the expiry sweep) when it has not been re-discovered
 * within its threshold. Thresholds are resolved by the job's sourceProvider
 * first, then its sourceType, then the default.
 *
 * Only ingestion-backed jobs (sourceProvider set) are ever expired — manual
 * and seeded demo jobs have no re-discovery loop, so the sweep never touches
 * them.
 */

export const DEFAULT_STALE_AFTER_DAYS = 30;

/** Per-provider overrides (most specific). */
export const STALE_AFTER_DAYS_BY_PROVIDER: Record<string, number> = {
  // Google-discovered listings churn fast; LinkedIn-hosted copies follow the
  // same discovery loop.
  google_jobs_serpapi: 14,
  linkedin_via_google_jobs: 14,
  // Direct employer career pages are re-scraped less often and stay live longer.
  company_site: 21,
  // ATS-hosted employer boards behave like career sites (structured feeds,
  // postings stay live until filled).
  ats_lever: 21,
  ats_ashby: 21,
  ats_workable: 21,
  ats_smartrecruiters: 21,
  ats_recruitee: 21,
  ats_teamtailor: 21,
  ats_workday: 21,
  // Job boards churn like Google-discovered listings.
  reed_api: 14,
  adzuna_api: 14,
};

/** Per-sourceType fallbacks when no provider override exists. */
export const STALE_AFTER_DAYS_BY_SOURCE_TYPE: Record<string, number> = {
  google_jobs: 14,
  direct_employer: 21,
  job_board: 14,
};

export function resolveStaleAfterDays(job: {
  sourceProvider: string | null;
  sourceType: string | null;
}): number {
  if (job.sourceProvider != null) {
    const byProvider = STALE_AFTER_DAYS_BY_PROVIDER[job.sourceProvider];
    if (byProvider !== undefined) return byProvider;
  }
  if (job.sourceType != null) {
    const byType = STALE_AFTER_DAYS_BY_SOURCE_TYPE[job.sourceType];
    if (byType !== undefined) return byType;
  }
  return DEFAULT_STALE_AFTER_DAYS;
}
