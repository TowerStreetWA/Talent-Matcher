import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Generator: parses the canonical London Insurance Market directory markdown
 * (all five section tables) and emits the data-only employer config at
 * artifacts/api-server/src/config/londonInsuranceEmployers.ts.
 *
 * Re-run after editing the directory md:
 *   pnpm --filter @workspace/scripts run generate:london-directory
 */

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const INPUT = resolve(
  REPO_ROOT,
  "artifacts/api-server/src/config/data/London-Insurance-Market-Directory.md",
);
const OUTPUT = resolve(REPO_ROOT, "artifacts/api-server/src/config/londonInsuranceEmployers.ts");

type Segment = "lloyds_syndicate" | "company_market" | "mga_coverholder" | "broker";
type PlatformHint = "workday" | "teamtailor" | "recruitee" | "workable" | "careers_page";

interface ParsedRow {
  name: string;
  careersUrl: string | null;
  segment: Segment;
  note: string | null;
}

interface Employer {
  name: string;
  careersUrl: string;
  segment: Segment;
  platformHint: PlatformHint;
  notes: string[];
  syndicates: string[];
  alsoSegments: Set<Segment>;
}

const SECTION_SEGMENTS: Array<{ heading: RegExp; segment: Segment }> = [
  { heading: /^## Section 1:/, segment: "lloyds_syndicate" },
  { heading: /^## Section 2:/, segment: "company_market" },
  { heading: /^## Section 3:/, segment: "mga_coverholder" },
  { heading: /^## Section 4:/, segment: "mga_coverholder" },
  { heading: /^## Section 5:/, segment: "broker" },
];

function extractUrl(cell: string): string | null {
  const md = cell.match(/\]\((https?:\/\/[^)\s]+)\)/);
  if (md?.[1]) return md[1];
  const bare = cell.match(/https?:\/\/[^\s|]+/);
  return bare ? bare[0] : null;
}

function cleanCell(cell: string): string {
  return cell.replace(/\*\*/g, "").trim();
}

function detectPlatform(url: string): PlatformHint {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "careers_page";
  }
  if (host.endsWith(".myworkdayjobs.com")) return "workday";
  if (host.endsWith(".teamtailor.com")) return "teamtailor";
  if (host.endsWith(".recruitee.com")) return "recruitee";
  if (host.endsWith(".workable.com") || host === "workable.com") return "workable";
  return "careers_page";
}

function parseRows(md: string): { rows: ParsedRow[]; skipped: Array<{ name: string; segment: Segment; reason: string }> } {
  const lines = md.split("\n");
  const rows: ParsedRow[] = [];
  const skipped: Array<{ name: string; segment: Segment; reason: string }> = [];
  let segment: Segment | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const match = SECTION_SEGMENTS.find((s) => s.heading.test(line));
      segment = match ? match.segment : null;
      continue;
    }
    if (!segment || !line.trim().startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(cleanCell);
    if (cells.length < 2) continue;
    // Skip header + separator rows.
    if (cells.every((c) => /^[-\s:]*$/.test(c))) continue;
    const headerWords = /^(syndicate no\.?|company|mga|coverholder|broker)$/i;
    if (headerWords.test(cells[0]!)) continue;

    let name: string;
    let careersCell: string;
    let note: string | null = null;

    if (segment === "lloyds_syndicate") {
      // | Syndicate No. | Managing Agent | Careers Page |
      if (cells.length < 3 || !/^\d+$/.test(cells[0]!)) continue;
      name = cells[1]!;
      careersCell = cells[2]!;
      note = `syndicate ${cells[0]}`;
    } else if (cells.length >= 3) {
      // | Name | Specialism/Class | Careers Page |
      name = cells[0]!;
      careersCell = cells[2]!;
      note = cells[1] && cells[1] !== "—" ? cells[1]! : null;
    } else {
      // | Name | Careers Page |
      name = cells[0]!;
      careersCell = cells[1]!;
    }

    if (!name) continue;
    const url = extractUrl(careersCell);
    if (!url) {
      skipped.push({ name, segment, reason: "no careers URL in directory" });
      continue;
    }
    rows.push({ name, careersUrl: url, segment, note });
  }
  return { rows, skipped };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\((.*?)\)/g, " ")
    .replace(/[^a-z0-9&]+/g, " ")
    .replace(/\b(limited|ltd|llp|plc|group companies|company|companies|co|uk|international)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(rows: ParsedRow[]): Employer[] {
  const byKey = new Map<string, Employer>();
  for (const row of rows) {
    if (!row.careersUrl) continue;
    const key = normalizeName(row.name) || row.name.toLowerCase();
    const existing = byKey.get(key);
    const syndicate = row.note?.match(/^syndicate (\d+)$/)?.[1] ?? null;
    if (existing) {
      if (syndicate) existing.syndicates.push(syndicate);
      else if (row.note && !existing.notes.includes(row.note)) existing.notes.push(row.note);
      if (row.segment !== existing.segment) existing.alsoSegments.add(row.segment);
      continue;
    }
    byKey.set(key, {
      name: row.name,
      careersUrl: row.careersUrl,
      segment: row.segment,
      platformHint: detectPlatform(row.careersUrl),
      notes: syndicate ? [] : row.note ? [row.note] : [],
      syndicates: syndicate ? [syndicate] : [],
      alsoSegments: new Set(),
    });
  }
  return [...byKey.values()];
}

function buildNotes(e: Employer): string | null {
  const parts: string[] = [];
  if (e.syndicates.length > 0) {
    parts.push(`Lloyd's syndicate${e.syndicates.length > 1 ? "s" : ""} ${e.syndicates.join(", ")}`);
  }
  parts.push(...e.notes);
  if (e.alsoSegments.size > 0) parts.push(`also listed as: ${[...e.alsoSegments].join(", ")}`);
  return parts.length > 0 ? parts.join("; ") : null;
}

function main(): void {
  const md = readFileSync(INPUT, "utf8");
  const { rows, skipped } = parseRows(md);
  const employers = dedupe(rows).sort(
    (a, b) => a.segment.localeCompare(b.segment) || a.name.localeCompare(b.name),
  );

  const counts: Record<string, number> = {};
  for (const e of employers) counts[e.segment] = (counts[e.segment] ?? 0) + 1;

  const entries = employers
    .map((e) => {
      const notes = buildNotes(e);
      const fields = [
        `    name: ${JSON.stringify(e.name)},`,
        `    careersUrl: ${JSON.stringify(e.careersUrl)},`,
        `    segment: ${JSON.stringify(e.segment)},`,
        `    platformHint: ${JSON.stringify(e.platformHint)},`,
        `    sectorTag: "insurance",`,
        ...(notes ? [`    notes: ${JSON.stringify(notes)},`] : []),
      ];
      return `  {\n${fields.join("\n")}\n  },`;
    })
    .join("\n");

  const skippedEntries = skipped
    .map(
      (s) =>
        `  { name: ${JSON.stringify(s.name)}, segment: ${JSON.stringify(s.segment)}, reason: ${JSON.stringify(s.reason)} },`,
    )
    .join("\n");

  const out = `// AUTO-GENERATED from src/config/data/London-Insurance-Market-Directory.md
// by scripts/src/generateLondonInsuranceEmployers.ts — DO NOT hand-edit.
// To update: edit the directory md, then run
//   pnpm --filter @workspace/scripts run generate:london-directory
//
// Data-only config: no business logic. Routing (ATS vs generic careers-page
// scraping) lives in lib/vacancies/londonDirectory.ts.

/** London market participant segments (Section 4 coverholders fold into mga_coverholder). */
export type LondonMarketSegment =
  | "lloyds_syndicate"
  | "company_market"
  | "mga_coverholder"
  | "broker";

/** ATS platform detected from the careers URL; careers_page = generic HTML site. */
export type LondonPlatformHint =
  | "workday"
  | "teamtailor"
  | "recruitee"
  | "workable"
  | "careers_page";

export interface LondonInsuranceEmployer {
  name: string;
  careersUrl: string;
  segment: LondonMarketSegment;
  platformHint: LondonPlatformHint;
  sectorTag: "insurance";
  notes?: string;
}

export const LONDON_INSURANCE_EMPLOYERS: LondonInsuranceEmployer[] = [
${entries}
];

/** Directory rows that could not be included (e.g. no careers URL published). */
export const LONDON_DIRECTORY_UNRESOLVED: Array<{
  name: string;
  segment: LondonMarketSegment;
  reason: string;
}> = [
${skippedEntries}
];
`;

  writeFileSync(OUTPUT, out);
  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${employers.length} employers (${Object.entries(counts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}); skipped ${skipped.length}: ${skipped.map((s) => s.name).join(", ") || "none"}`,
  );
  const platforms: Record<string, number> = {};
  for (const e of employers) platforms[e.platformHint] = (platforms[e.platformHint] ?? 0) + 1;
  // eslint-disable-next-line no-console
  console.log(
    `Platforms: ${Object.entries(platforms)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}`,
  );
}

main();
