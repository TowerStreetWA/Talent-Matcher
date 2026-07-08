/** Discovery source taxonomy (job_board / agency reserved for future phases). */
export type VacancySourceType = "direct_employer" | "google_jobs" | "job_board" | "agency";

/** Normalized vacancy shape produced by every discovery provider. */
export interface NormalizedVacancy {
  title: string;
  companyName: string | null;
  locationText: string | null;
  remoteType: string | null;
  employmentType: string | null;
  salaryText: string | null;
  descriptionText: string | null;
  skills: string[];
  postedAt: Date | null;
  /** Where a candidate would apply (may equal sourceUrl). */
  applyUrl: string | null;
  sourceType: VacancySourceType;
  /** e.g. "company_site", "google_jobs_serpapi", "linkedin_via_google_jobs" */
  sourceProvider: string;
  /** Canonical job detail URL at the source. */
  sourceUrl: string | null;
  /** Sector tag inherited from the ingestion search pattern (nullable). */
  sectorTag?: string | null;
}

export type IngestionErrorKind = "config" | "rate_limited" | "upstream" | "timeout";

export class IngestionError extends Error {
  readonly kind: IngestionErrorKind;

  constructor(kind: IngestionErrorKind, message: string) {
    super(message);
    this.name = "IngestionError";
    this.kind = kind;
  }
}

/**
 * Provider abstraction: every discovery source maps its raw results into
 * NormalizedVacancy so ingestion, dedupe, and storage stay provider-agnostic.
 */
export interface VacancyProvider {
  readonly sourceType: VacancySourceType;
  readonly sourceProvider: string;
  fetchVacancies(input: GoogleJobsQuery | EmployerSiteFetchInput): Promise<ProviderFetchResult>;
}

export interface GoogleJobsQuery {
  query: string;
  location?: string | null;
  company?: string | null;
  /** Fetch up to this many results via pagination (default: one page ≈ 10). */
  maxResults?: number | null;
  /** Sector tag stamped onto every vacancy from this query (nullable). */
  sectorTag?: string | null;
}

export interface EmployerSiteFetchInput {
  /** Restrict to specific configured companies (default: all configured). */
  companies?: string[];
}

export interface ProviderFetchResult {
  vacancies: NormalizedVacancy[];
  /** Non-fatal per-item problems (bad detail page, unparsable result, ...). */
  warnings: string[];
}
