import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Generator: parses the canonical multi-sector careers-directory seed JSON
 * and emits the data-only employer config at
 * artifacts/api-server/src/config/careersDirectorySeedEmployers.ts.
 *
 * (Insurance is generated separately from the London Insurance Market
 * directory md by generateLondonInsuranceEmployers.ts.)
 *
 * Re-run after editing the seed:
 *   pnpm --filter @workspace/scripts run generate:careers-directory
 */

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const INPUT = resolve(
  REPO_ROOT,
  "artifacts/api-server/src/config/data/careers-directory-seed.json",
);
const OUTPUT = resolve(
  REPO_ROOT,
  "artifacts/api-server/src/config/careersDirectorySeedEmployers.ts",
);

const KNOWN_INDUSTRIES = [
  "banking",
  "pensions",
  "asset_management",
  "accountancy_finance",
  "it_tech",
] as const;
type Industry = (typeof KNOWN_INDUSTRIES)[number];

type PlatformHint =
  | "lever"
  | "ashby"
  | "workable"
  | "smartrecruiters"
  | "recruitee"
  | "teamtailor"
  | "workday"
  | "greenhouse"
  | "icims"
  | "careers_page";

interface SeedEmployer {
  name?: unknown;
  careersUrl?: unknown;
  segment?: unknown;
  locationIncludes?: unknown;
  notes?: unknown;
}

interface SeedIndustry {
  label?: unknown;
  segments?: unknown;
  employers?: unknown;
}

interface Seed {
  industries?: Record<string, SeedIndustry>;
}

function detectPlatform(url: string): PlatformHint {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    path = u.pathname;
  } catch {
    return "careers_page";
  }
  if (host.endsWith(".myworkdayjobs.com")) return "workday";
  if (host.endsWith(".teamtailor.com") && !host.startsWith("www.")) return "teamtailor";
  if (host.endsWith(".recruitee.com") && !host.startsWith("www.")) return "recruitee";
  if (host === "apply.workable.com" && path.split("/").filter(Boolean).length > 0)
    return "workable";
  if (host.endsWith(".workable.com") && !["www", "jobs", "help"].includes(host.split(".")[0]!))
    return "workable";
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") return "lever";
  if (host === "jobs.ashbyhq.com") return "ashby";
  if (host === "careers.smartrecruiters.com" || host === "jobs.smartrecruiters.com")
    return "smartrecruiters";
  if (
    [
      "boards.greenhouse.io",
      "job-boards.greenhouse.io",
      "boards.eu.greenhouse.io",
      "job-boards.eu.greenhouse.io",
    ].includes(host) &&
    path.split("/").filter(Boolean).length > 0
  )
    return "greenhouse";
  if (
    host.endsWith(".icims.com") &&
    !["www", "media", "cdn", "jobs", "status", "help", "care", "community"].includes(
      host.split(".")[0]!,
    )
  )
    return "icims";
  return "careers_page";
}

function main(): void {
  const seed = JSON.parse(readFileSync(INPUT, "utf8")) as Seed;
  if (!seed.industries) throw new Error("seed JSON has no industries object");

  const industryBlocks: string[] = [];
  const unresolved: Array<{ name: string; industry: string; segment: string; reason: string }> =
    [];
  const counts: Record<string, number> = {};

  for (const industry of KNOWN_INDUSTRIES) {
    const block = seed.industries[industry];
    if (!block) throw new Error(`seed JSON missing industry: ${industry}`);
    const segments = Array.isArray(block.segments) ? (block.segments as string[]) : [];
    if (segments.length === 0) throw new Error(`${industry}: no segments`);
    const employers = Array.isArray(block.employers) ? (block.employers as SeedEmployer[]) : [];

    const rows: string[] = [];
    const seenNames = new Set<string>();
    for (const e of employers) {
      const name = typeof e.name === "string" ? e.name.trim() : "";
      const careersUrl = typeof e.careersUrl === "string" ? e.careersUrl.trim() : "";
      const segment = typeof e.segment === "string" ? e.segment.trim() : "";
      if (!name) throw new Error(`${industry}: employer with no name`);
      if (seenNames.has(name.toLowerCase()))
        throw new Error(`${industry}: duplicate employer ${name}`);
      seenNames.add(name.toLowerCase());
      if (!segments.includes(segment))
        throw new Error(`${industry}: ${name} has unknown segment "${segment}"`);
      if (!careersUrl) {
        unresolved.push({ name, industry, segment, reason: "no careers URL in seed" });
        continue;
      }
      try {
        new URL(careersUrl);
      } catch {
        unresolved.push({ name, industry, segment, reason: "invalid careers URL in seed" });
        continue;
      }
      counts[industry] = (counts[industry] ?? 0) + 1;
      const locationIncludes = Array.isArray(e.locationIncludes)
        ? e.locationIncludes.filter((v): v is string => typeof v === "string" && v.length > 0)
        : [];
      if (Array.isArray(e.locationIncludes) && locationIncludes.length !== e.locationIncludes.length)
        throw new Error(`${industry}: ${name} has non-string locationIncludes entries`);
      const fields = [
        `      name: ${JSON.stringify(name)},`,
        `      careersUrl: ${JSON.stringify(careersUrl)},`,
        `      segment: ${JSON.stringify(segment)},`,
        `      platformHint: ${JSON.stringify(detectPlatform(careersUrl))},`,
        `      sectorTag: ${JSON.stringify(industry)},`,
        ...(locationIncludes.length
          ? [`      locationIncludes: ${JSON.stringify(locationIncludes)},`]
          : []),
        ...(typeof e.notes === "string" && e.notes
          ? [`      notes: ${JSON.stringify(e.notes)},`]
          : []),
      ];
      rows.push(`    {\n${fields.join("\n")}\n    },`);
    }

    industryBlocks.push(
      `  ${industry}: {\n` +
        `    label: ${JSON.stringify(typeof block.label === "string" ? block.label : industry)},\n` +
        `    segments: ${JSON.stringify(segments)},\n` +
        `    employers: [\n${rows.join("\n")}\n    ],\n` +
        `  },`,
    );
  }

  const unresolvedEntries = unresolved
    .map(
      (u) =>
        `  { name: ${JSON.stringify(u.name)}, industry: ${JSON.stringify(u.industry)}, segment: ${JSON.stringify(u.segment)}, reason: ${JSON.stringify(u.reason)} },`,
    )
    .join("\n");

  const out = `// AUTO-GENERATED from src/config/data/careers-directory-seed.json
// by scripts/src/generateCareersDirectorySeed.ts — DO NOT hand-edit.
// To update: edit the seed JSON, then run
//   pnpm --filter @workspace/scripts run generate:careers-directory
//
// Data-only config: no business logic. Routing (ATS vs generic careers-page
// scraping, careers→board resolution) lives in lib/directory/engine.ts.

export type SeedIndustryKey =
  | "banking"
  | "pensions"
  | "asset_management"
  | "accountancy_finance"
  | "it_tech";

export interface SeedDirectoryEmployer {
  name: string;
  careersUrl: string;
  segment: string;
  platformHint:
    | "lever"
    | "ashby"
    | "workable"
    | "smartrecruiters"
    | "recruitee"
    | "teamtailor"
    | "workday"
    | "greenhouse"
    | "icims"
    | "careers_page";
  sectorTag: SeedIndustryKey;
  locationIncludes?: string[];
  notes?: string;
}

export interface SeedIndustryDirectory {
  label: string;
  segments: string[];
  employers: SeedDirectoryEmployer[];
}

export const CAREERS_DIRECTORY_SEED: Record<SeedIndustryKey, SeedIndustryDirectory> = {
${industryBlocks.join("\n")}
};

/** Seed rows that could not be included (e.g. no careers URL). */
export const CAREERS_DIRECTORY_SEED_UNRESOLVED: Array<{
  name: string;
  industry: string;
  segment: string;
  reason: string;
}> = [
${unresolvedEntries}
];
`;

  writeFileSync(OUTPUT, out);
  // eslint-disable-next-line no-console
  console.log(
    `Wrote seed directories: ${Object.entries(counts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}; unresolved ${unresolved.length}`,
  );
}

main();
