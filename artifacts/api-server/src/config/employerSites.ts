/**
 * Seed configuration for direct-employer vacancy discovery.
 *
 * Each entry points at a public careers/jobs listing page. The employer-site
 * ingestion job scrapes the listing page to find job detail links, then
 * extracts structured vacancy fields from each detail page via Firecrawl.
 *
 * This list is deliberately manual and small in this phase — controlled and
 * explainable discovery, not open-ended crawling. Add or remove employers here.
 */
export interface EmployerSiteConfig {
  /** Display / fallback company name. */
  company: string;
  /** Public careers or jobs listing page URL. */
  careersUrl: string;
  /** Max job detail pages to extract per run (default 8). */
  maxJobs?: number;
}

export const EMPLOYER_SITES: EmployerSiteConfig[] = [
  {
    company: "Monzo",
    careersUrl: "https://job-boards.greenhouse.io/monzo",
    maxJobs: 6,
  },
  {
    company: "Octopus Energy",
    careersUrl: "https://jobs.lever.co/octoenergy",
    maxJobs: 6,
  },
];
