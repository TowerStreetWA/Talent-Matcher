import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { runJobSearchPipeline } from "./jobs";

/**
 * Regression tests for the TOTAL_CAP (200) fetch-window recall bug:
 * sector-filtered searches must not lose older sector rows just because
 * a flood of newer other-sector rows fills the newest-200 window.
 *
 * Uses a throwaway tenant slug so demo data is untouched; rows are
 * deleted in afterAll.
 */
const TENANT = `vitest-cap-${Date.now()}`;

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  const rows: (typeof jobsTable.$inferInsert)[] = [];

  // 210 recent banking-tagged jobs — more than TOTAL_CAP on their own.
  for (let i = 0; i < 210; i++) {
    rows.push({
      tenantId: TENANT,
      title: `Relationship Manager ${i}`,
      companyName: "Big Bank",
      sectorTag: "banking",
      status: "active",
      isCanonical: true,
      postedAt: daysAgo(1),
    });
  }
  // 5 older insurance-tagged jobs that would fall outside the newest-200 window.
  for (let i = 0; i < 5; i++) {
    rows.push({
      tenantId: TENANT,
      title: `Claims Handler ${i}`,
      companyName: "Insurer Ltd",
      sectorTag: "insurance",
      status: "active",
      isCanonical: true,
      postedAt: daysAgo(20 + i),
    });
  }
  // 3 insurance-tagged jobs whose titles classify to another (or no) sector —
  // the ingestion tag is authoritative for the market sector, so these must
  // still appear under sector=insurance (e.g. finance/tech roles at insurers).
  for (const title of [
    "Finance Manager (Group Reporting)",
    "Software Engineer - Platform",
    "Office Coordinator",
  ]) {
    rows.push({
      tenantId: TENANT,
      title,
      companyName: "Insurer Ltd",
      sectorTag: "insurance",
      status: "active",
      isCanonical: true,
      postedAt: daysAgo(25),
    });
  }
  // 2 old NULL-tagged (manual/legacy) rows whose titles classify as insurance —
  // must still be reachable via query-time classification.
  for (let i = 0; i < 2; i++) {
    rows.push({
      tenantId: TENANT,
      title: `Senior Claims Adjuster ${i}`,
      companyName: "Legacy Insurer",
      sectorTag: null,
      status: "active",
      isCanonical: true,
      postedAt: daysAgo(30 + i),
    });
  }

  // Insert in chunks to keep statements reasonable.
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(jobsTable).values(rows.slice(i, i + 100));
  }
});

afterAll(async () => {
  await db.delete(jobsTable).where(eq(jobsTable.tenantId, TENANT));
});

describe("runJobSearchPipeline sector pre-filter (TOTAL_CAP regression)", () => {
  it("returns sector rows older than the newest-200 global window", async () => {
    const scored = await runJobSearchPipeline({
      tenantId: TENANT,
      nq: null,
      locationVariants: [],
      sectorFilter: "insurance",
      familyFilters: [],
      sourceFilter: null,
    });
    const titles = scored.map(({ r }) => r.job.title);
    for (let i = 0; i < 5; i++) {
      expect(titles).toContain(`Claims Handler ${i}`);
    }
    // No banking rows leak through the in-memory classification filter.
    expect(titles.some((t) => t.startsWith("Relationship Manager"))).toBe(false);
  });

  it("treats the ingestion sector_tag as authoritative over title classification", async () => {
    const scored = await runJobSearchPipeline({
      tenantId: TENANT,
      nq: null,
      locationVariants: [],
      sectorFilter: "insurance",
      familyFilters: [],
      sourceFilter: null,
    });
    const titles = scored.map(({ r }) => r.job.title);
    expect(titles).toContain("Finance Manager (Group Reporting)");
    expect(titles).toContain("Software Engineer - Platform");
    expect(titles).toContain("Office Coordinator");
  });

  it("still includes NULL sector_tag rows that classify to the wanted sector", async () => {
    const scored = await runJobSearchPipeline({
      tenantId: TENANT,
      nq: null,
      locationVariants: [],
      sectorFilter: "insurance",
      familyFilters: [],
      sourceFilter: null,
    });
    const titles = scored.map(({ r }) => r.job.title);
    expect(titles).toContain("Senior Claims Adjuster 0");
    expect(titles).toContain("Senior Claims Adjuster 1");
  });

  it("without a sector filter, all matching rows are returned (no cap)", async () => {
    // The TOTAL_CAP of 200 has been removed so recruiters can see all results.
    // This tenant has 220 banking + 5 insurance + 3 insurance + 2 null = 220 rows.
    const scored = await runJobSearchPipeline({
      tenantId: TENANT,
      nq: null,
      locationVariants: [],
      sectorFilter: null,
      familyFilters: [],
      sourceFilter: null,
    });
    expect(scored.length).toBeGreaterThan(200);
  });
});
