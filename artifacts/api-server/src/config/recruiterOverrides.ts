/**
 * Recruiter classification overrides — the safety valve for false
 * positives/negatives in lib/search/companyKind.ts. Overrides are checked
 * FIRST and beat every other rule.
 *
 * - FORCE_DIRECT_EMPLOYER: names/domains that look recruiter-like but are
 *   actually direct employers (or post first-party jobs).
 * - FORCE_RECRUITMENT_FIRM: recruiter edge cases the rules miss.
 *
 * Names match with the same normalized-equality rules as the registry;
 * domains match by hostname suffix.
 */

export interface RecruiterOverride {
  names?: string[];
  domains?: string[];
  notes?: string;
}

export const FORCE_DIRECT_EMPLOYER: RecruiterOverride[] = [
  {
    names: ["Government Recruitment Service"],
    notes:
      "Civil Service's own hiring arm — posts first-party government jobs despite the recruiter-like name.",
  },
  {
    names: ["Reed Smith", "Reed Smith LLP"],
    domains: ["reedsmith.com"],
    notes: "Global law firm, not the Reed recruitment group.",
  },
  {
    names: ["NHS Professionals"],
    notes: "NHS staff bank — first-party NHS shifts, treated as direct.",
  },
];

export const FORCE_RECRUITMENT_FIRM: RecruiterOverride[] = [
  {
    names: ["ITOL Recruit"],
    notes:
      "Training-plus-placement outfit; postings are agency-style ads (caught by name pattern anyway, pinned for stability).",
  },
];
