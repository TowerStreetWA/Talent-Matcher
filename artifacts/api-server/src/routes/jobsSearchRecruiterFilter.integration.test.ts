import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { runJobSearchPipeline } from "./jobs";

/**
 * Integration tests for the recruiter filter on the job-search pipeline:
 * jobs whose company_kind = 'recruitment_firm' are excluded by default and
 * only returned when includeRecruiters is passed. NULL/unclassified rows are
 * never filtered (IS DISTINCT FROM keeps them), so legacy data stays visible.
 *
 * Uses a throwaway tenant slug so demo data is untouched; rows are deleted
 * in afterAll.
 */
const TENANT = `vitest-recruiter-${Date.now()}`;

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const seedRows: (typeof jobsTable.$inferInsert)[] = [
  {
    tenantId: TENANT,
    title: "Underwriting Assistant (via Hays)",
    companyName: "Hays",
    companyKind: "recruitment_firm",
    sectorTag: "insurance",
    status: "active",
    isCanonical: true,
    postedAt: daysAgo(1),
  },
  {
    tenantId: TENANT,
    title: "Compliance Officer (via IPS Group)",
    companyName: "IPS Group",
    companyKind: "recruitment_firm",
    sectorTag: "insurance",
    status: "active",
    isCanonical: true,
    postedAt: daysAgo(2),
  },
  {
    tenantId: TENANT,
    title: "Senior Underwriter - Marine",
    companyName: "Hiscox",
    companyKind: "direct_employer",
    sectorTag: "insurance",
    status: "active",
    isCanonical: true,
    postedAt: daysAgo(1),
  },
  {
    tenantId: TENANT,
    title: "Claims Handler - Legacy Row",
    companyName: "Unknown Shop",
    companyKind: null,
    sectorTag: "insurance",
    status: "active",
    isCanonical: true,
    postedAt: daysAgo(3),
  },
  {
    tenantId: TENANT,
    title: "Data Engineer - Job Board Post",
    companyName: "Reed.co.uk",
    companyKind: "job_board",
    sectorTag: "it_tech",
    status: "active",
    isCanonical: true,
    postedAt: daysAgo(1),
  },
];

beforeAll(async () => {
  await db.insert(jobsTable).values(seedRows);
});

afterAll(async () => {
  await db.delete(jobsTable).where(eq(jobsTable.tenantId, TENANT));
});

const runSearch = async (includeRecruiters: boolean): Promise<string[]> => {
  const scored = await runJobSearchPipeline({
    tenantId: TENANT,
    nq: null,
    locationVariants: [],
    sectorFilter: null,
    familyFilters: [],
    sourceFilter: null,
    includeRecruiters,
  });
  return scored.map(({ r }) => r.job.title);
};

describe("job search recruiter filter (integration)", () => {
  it("excludes recruitment_firm jobs by default", async () => {
    const titles = await runSearch(false);
    expect(titles).not.toContain("Underwriting Assistant (via Hays)");
    expect(titles).not.toContain("Compliance Officer (via IPS Group)");
  });

  it("keeps direct employers, job boards, and NULL/unclassified rows by default", async () => {
    const titles = await runSearch(false);
    expect(titles).toContain("Senior Underwriter - Marine");
    expect(titles).toContain("Claims Handler - Legacy Row");
    expect(titles).toContain("Data Engineer - Job Board Post");
  });

  it("returns recruiter jobs when includeRecruiters is true, without dropping others", async () => {
    const titles = await runSearch(true);
    expect(titles).toContain("Underwriting Assistant (via Hays)");
    expect(titles).toContain("Compliance Officer (via IPS Group)");
    expect(titles).toContain("Senior Underwriter - Marine");
    expect(titles).toContain("Claims Handler - Legacy Row");
    expect(titles).toContain("Data Engineer - Job Board Post");
    expect(titles.length).toBe(seedRows.length);
  });

  it("never deletes or mutates recruiter rows — they stay in the DB when filtered", async () => {
    await runSearch(false);
    const rows = await db
      .select({ title: jobsTable.title, companyKind: jobsTable.companyKind })
      .from(jobsTable)
      .where(eq(jobsTable.tenantId, TENANT));
    expect(rows.length).toBe(seedRows.length);
    expect(
      rows.filter((r) => r.companyKind === "recruitment_firm").length,
    ).toBe(2);
  });
});
