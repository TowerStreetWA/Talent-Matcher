/**
 * Apollo.io People Search enrichment.
 * Searches for TA contacts and hiring-manager contacts for a given company.
 * Requires APOLLO_API_KEY to be set; no-ops gracefully when missing.
 */
import { logger } from "./logger";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

/** Generic fallback when no specific config matches. */
export const DEFAULT_TARGET_TITLES = [
  "Talent Acquisition Manager",
  "Talent Partner",
  "Talent Acquisition Partner",
  "HR Manager",
  "Recruiter",
  "Recruitment Manager",
  "Head of Talent",
  "Talent Acquisition Lead",
];

export const DEFAULT_MANAGER_TITLES = [
  "Manager",
  "Head of",
  "Director",
  "VP",
  "Vice President",
  "Lead",
  "Principal",
];

export interface ApolloContact {
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

async function searchPeople(
  companyName: string,
  personTitles: string[],
  maxResults = 3,
): Promise<ApolloContact[]> {
  const apiKey = process.env["APOLLO_API_KEY"];
  if (!apiKey) {
    logger.warn("APOLLO_API_KEY not set — skipping Apollo enrichment");
    return [];
  }

  try {
    const response = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        q_organization_name: companyName,
        person_titles: personTitles,
        page: 1,
        per_page: maxResults,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.warn(
        { status: response.status, body: body.slice(0, 200), companyName },
        "Apollo API returned non-200",
      );
      return [];
    }

    const data = (await response.json()) as {
      people?: {
        name?: string;
        title?: string;
        email?: string;
        sanitized_phone?: string;
        linkedin_url?: string;
      }[];
    };

    return (data.people ?? []).slice(0, maxResults).map((p) => ({
      fullName: p.name ?? "Unknown",
      title: p.title ?? null,
      email: p.email ?? null,
      phone: p.sanitized_phone ?? null,
      linkedinUrl: p.linkedin_url ?? null,
    }));
  } catch (err) {
    logger.error({ err, companyName }, "Apollo enrichment fetch failed");
    return [];
  }
}

export interface EnrichmentResult {
  taContacts: ApolloContact[];
  managerContacts: ApolloContact[];
}

export async function enrichCompany(
  companyName: string,
  targetTitles: string[],
  managerTitles: string[],
): Promise<EnrichmentResult> {
  const [taContacts, managerContacts] = await Promise.all([
    searchPeople(companyName, targetTitles, 3),
    searchPeople(companyName, managerTitles, 3),
  ]);
  return { taContacts, managerContacts };
}
