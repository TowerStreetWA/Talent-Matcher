import type { CareersDirectoryConfig } from "../lib/directory/engine";
import {
  LONDON_DIRECTORY_UNRESOLVED,
  LONDON_INSURANCE_EMPLOYERS,
} from "./londonInsuranceEmployers";
import {
  CAREERS_DIRECTORY_SEED,
  CAREERS_DIRECTORY_SEED_UNRESOLVED,
  type SeedIndustryKey,
} from "./careersDirectorySeedEmployers";

/**
 * Registry of careers directories consumed by the directory engine
 * (lib/directory/engine.ts), the generic ingestion endpoint, the scheduled
 * sweep, and the coverage diagnostics.
 *
 * Each directory is config-only: employers come from a generated file
 * (never hand-edited), routing/sweeping logic lives in lib/directory/.
 *
 * Provider keys are `<providerPrefix>_<segment>`. The London insurance
 * directory keeps its original "london_insurance" prefix so existing
 * job_sources rows, dedupe behavior, and tenant opt-ins are untouched.
 */

const SEED_INDUSTRIES: SeedIndustryKey[] = [
  "banking",
  "pensions",
  "asset_management",
  "accountancy_finance",
  "it_tech",
];

function seedDirectory(industry: SeedIndustryKey): CareersDirectoryConfig {
  const seed = CAREERS_DIRECTORY_SEED[industry];
  return {
    key: industry,
    label: seed.label,
    industry,
    providerPrefix: `directory_${industry}`,
    segments: seed.segments,
    employers: seed.employers,
    unresolved: CAREERS_DIRECTORY_SEED_UNRESOLVED.filter((u) => u.industry === industry),
    sweep: { slots: 24, enabled: true },
  };
}

export const LONDON_INSURANCE_DIRECTORY: CareersDirectoryConfig = {
  key: "london_insurance",
  label: "London Insurance Market",
  industry: "insurance",
  providerPrefix: "london_insurance",
  segments: ["lloyds_syndicate", "company_market", "mga_coverholder", "broker"],
  employers: LONDON_INSURANCE_EMPLOYERS,
  unresolved: LONDON_DIRECTORY_UNRESOLVED,
  sweep: { slots: 24, enabled: true },
};

export const CAREERS_DIRECTORIES: CareersDirectoryConfig[] = [
  LONDON_INSURANCE_DIRECTORY,
  ...SEED_INDUSTRIES.map(seedDirectory),
];

export const CAREERS_DIRECTORY_KEYS: string[] = CAREERS_DIRECTORIES.map((d) => d.key);

export function directoryByKey(key: string): CareersDirectoryConfig | null {
  return CAREERS_DIRECTORIES.find((d) => d.key === key) ?? null;
}
