import type { AtsEmployerConfig } from "../../config/atsEmployers";
import type {
  LondonInsuranceEmployer,
  LondonMarketSegment,
} from "../../config/londonInsuranceEmployers";
import { LONDON_INSURANCE_DIRECTORY } from "../../config/careersDirectories";
import {
  atsEntryFromUrl,
  directoryProviderKey,
  makeDirectoryEmployerProvider,
  selectDirectoryEmployers,
  type DirectoryBatchSelection,
} from "../directory/engine";
import type { VacancyProvider } from "./types";

/**
 * London Insurance Market directory — thin compatibility wrapper over the
 * generic careers-directory engine (lib/directory/engine.ts). The directory
 * itself is registered in config/careersDirectories.ts; provider keys stay
 * `london_insurance_<segment>` so existing job_sources rows, dedupe, and
 * tenant opt-ins are untouched.
 */

export const LONDON_SEGMENTS = LONDON_INSURANCE_DIRECTORY.segments as LondonMarketSegment[];

export function londonProviderKey(segment: LondonMarketSegment): string {
  return directoryProviderKey(LONDON_INSURANCE_DIRECTORY, segment);
}

export const LONDON_PROVIDER_KEYS: string[] = LONDON_SEGMENTS.map(londonProviderKey);

/**
 * Parse an ATS employer entry from a careers URL according to the
 * employer's platformHint. Returns null when the URL does not carry enough
 * routing information (callers fall back to resolution + generic scraping).
 */
export function atsEntryFromCareersUrl(
  employer: Pick<LondonInsuranceEmployer, "name" | "careersUrl" | "platformHint">,
): AtsEmployerConfig | null {
  if (employer.platformHint === "careers_page") return null;
  const entry = atsEntryFromUrl(employer.careersUrl, {
    company: employer.name,
    sectorTag: "insurance",
  });
  return entry && entry.platform === employer.platformHint ? entry : null;
}

export function makeLondonEmployerProvider(employer: LondonInsuranceEmployer): VacancyProvider {
  return makeDirectoryEmployerProvider(LONDON_INSURANCE_DIRECTORY, employer);
}

export type LondonBatchSelection = DirectoryBatchSelection;

export function selectLondonEmployers(opts: {
  segments?: LondonMarketSegment[];
  employers?: string[];
  offset?: number;
  limit?: number;
}): DirectoryBatchSelection {
  return selectDirectoryEmployers(LONDON_INSURANCE_DIRECTORY, opts);
}
