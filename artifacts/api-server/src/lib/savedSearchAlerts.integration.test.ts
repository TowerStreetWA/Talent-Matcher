import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  jobsTable,
  savedJobSearchesTable,
  savedSearchAlertEventsTable,
  tenantUsersTable,
} from "@workspace/db";
import { sweepSavedSearchAlerts } from "./savedSearchAlerts";

const TEST_NAME = "__sweep_window_test__";
const TEST_TITLE = "Sweep Window Test Underwriter";

let savedSearchId: string;
let jobId: string;

beforeAll(async () => {
  const [owner] = await db
    .select({ id: tenantUsersTable.id })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.email, "owner@demo.test"))
    .limit(1);
  if (!owner) {
    throw new Error("Seeded demo owner not found — run the dev server once");
  }

  const [saved] = await db
    .insert(savedJobSearchesTable)
    .values({
      tenantId: "demo",
      userId: owner.id,
      name: TEST_NAME,
      query: "sweep window test underwriter",
      location: "",
      sector: null,
      sourceType: null,
      alertEnabled: true,
      // Baseline in the past so the job below counts as "new".
      lastRunAt: new Date(Date.now() - 60 * 60 * 1000),
    })
    .returning({ id: savedJobSearchesTable.id });
  if (!saved) throw new Error("Failed to insert test saved search");
  savedSearchId = saved.id;

  const [job] = await db
    .insert(jobsTable)
    .values({
      tenantId: "demo",
      title: TEST_TITLE,
      companyName: "Sweep Test Co",
      locationText: "London",
      status: "active",
      isCanonical: true,
      postedAt: new Date(),
    })
    .returning({ id: jobsTable.id });
  if (!job) throw new Error("Failed to insert test job");
  jobId = job.id;
});

afterAll(async () => {
  if (savedSearchId) {
    await db
      .delete(savedSearchAlertEventsTable)
      .where(eq(savedSearchAlertEventsTable.savedSearchId, savedSearchId));
    await db
      .delete(savedJobSearchesTable)
      .where(eq(savedJobSearchesTable.id, savedSearchId));
  }
  if (jobId) {
    await db.delete(jobsTable).where(eq(jobsTable.id, jobId));
  }
});

describe("sweepSavedSearchAlerts window behavior (integration)", () => {
  it("emits an alert once and never duplicates it on the next sweep", async () => {
    await sweepSavedSearchAlerts();

    const eventsAfterFirst = await db
      .select()
      .from(savedSearchAlertEventsTable)
      .where(eq(savedSearchAlertEventsTable.savedSearchId, savedSearchId));
    expect(eventsAfterFirst).toHaveLength(1);
    expect(eventsAfterFirst[0]?.jobIds).toContain(jobId);

    const [afterFirst] = await db
      .select({ lastRunAt: savedJobSearchesTable.lastRunAt })
      .from(savedJobSearchesTable)
      .where(eq(savedJobSearchesTable.id, savedSearchId));
    expect(afterFirst?.lastRunAt).not.toBeNull();

    // Second sweep over the next window: same job must NOT be re-alerted.
    await sweepSavedSearchAlerts();

    const eventsAfterSecond = await db
      .select()
      .from(savedSearchAlertEventsTable)
      .where(eq(savedSearchAlertEventsTable.savedSearchId, savedSearchId));
    expect(eventsAfterSecond).toHaveLength(1);

    const [afterSecond] = await db
      .select({ lastRunAt: savedJobSearchesTable.lastRunAt })
      .from(savedJobSearchesTable)
      .where(eq(savedJobSearchesTable.id, savedSearchId));
    expect(afterSecond?.lastRunAt?.getTime()).toBeGreaterThan(
      afterFirst?.lastRunAt?.getTime() ?? Infinity,
    );
  });
});
