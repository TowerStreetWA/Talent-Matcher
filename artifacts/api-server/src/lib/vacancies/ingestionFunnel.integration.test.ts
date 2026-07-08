import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, jobsTable, jobSourcesTable } from "@workspace/db";
import { runVacancyIngestion } from "./ingestionRunner";
import type { NormalizedVacancy, VacancyProvider } from "./types";

/**
 * Funnel-counter semantics (job_sources.last_new_count / last_refreshed_count):
 * - sourceUrl re-discovery → refreshed (freshness bump only, no new row)
 * - cluster duplicate (different URL, same title+company) → counted as NEW
 *   (a real row is stored and attributed to this source)
 * - first discovery → new
 */

const TENANT = "__funnel_test_tenant__";
const PROVIDER = "__funnel_test_provider__";

function vacancy(overrides: Partial<NormalizedVacancy>): NormalizedVacancy {
  return {
    title: "Funnel Test Underwriter",
    companyName: "Funnel Test Co",
    locationText: "London",
    remoteType: null,
    employmentType: null,
    salaryText: null,
    descriptionText: null,
    skills: [],
    postedAt: null,
    applyUrl: null,
    sourceType: "direct_employer",
    sourceProvider: PROVIDER,
    sourceUrl: null,
    ...overrides,
  };
}

function providerFor(vacancies: NormalizedVacancy[]): VacancyProvider {
  return {
    sourceType: "direct_employer",
    sourceProvider: PROVIDER,
    async fetchVacancies() {
      return { vacancies, warnings: [] };
    },
  };
}

async function sourceRow() {
  const [row] = await db
    .select()
    .from(jobSourcesTable)
    .where(eq(jobSourcesTable.provider, PROVIDER))
    .limit(1);
  if (!row) throw new Error("funnel test source row not found");
  return row;
}

afterAll(async () => {
  await db.delete(jobsTable).where(eq(jobsTable.tenantId, TENANT));
  await db.delete(jobSourcesTable).where(eq(jobSourcesTable.tenantId, TENANT));
});

describe("ingestion funnel counters", () => {
  it("first run counts inserts as new", async () => {
    const summary = await runVacancyIngestion({
      tenantId: TENANT,
      provider: providerFor([
        vacancy({ sourceUrl: "https://funnel.test/jobs/1" }),
        vacancy({
          title: "Funnel Test Actuary",
          sourceUrl: "https://funnel.test/jobs/2",
        }),
      ]),
      input: {},
    });
    expect(summary.fetched).toBe(2);
    expect(summary.insertedByProvider[PROVIDER]).toBe(2);
    expect(summary.refreshedByProvider[PROVIDER]).toBeUndefined();

    const src = await sourceRow();
    expect(src.lastFetchCount).toBe(2);
    expect(src.lastNewCount).toBe(2);
    expect(src.lastRefreshedCount).toBe(0);
  });

  it("re-discovery by sourceUrl counts as refreshed, not new", async () => {
    const summary = await runVacancyIngestion({
      tenantId: TENANT,
      provider: providerFor([vacancy({ sourceUrl: "https://funnel.test/jobs/1" })]),
      input: {},
    });
    expect(summary.refreshedExisting).toBe(1);
    expect(summary.refreshedByProvider[PROVIDER]).toBe(1);
    expect(summary.insertedByProvider[PROVIDER]).toBeUndefined();

    const src = await sourceRow();
    expect(src.lastFetchCount).toBe(1);
    expect(src.lastNewCount).toBe(0);
    expect(src.lastRefreshedCount).toBe(1);
  });

  it("cluster duplicate with a different URL is stored and counted as new", async () => {
    const summary = await runVacancyIngestion({
      tenantId: TENANT,
      provider: providerFor([
        vacancy({ sourceUrl: "https://funnel.test/jobs/1-mirror" }),
      ]),
      input: {},
    });
    expect(summary.insertedDuplicates + summary.insertedCanonical).toBe(1);
    expect(summary.insertedByProvider[PROVIDER]).toBe(1);

    const src = await sourceRow();
    expect(src.lastNewCount).toBe(1);
    expect(src.lastRefreshedCount).toBe(0);
  });
});
