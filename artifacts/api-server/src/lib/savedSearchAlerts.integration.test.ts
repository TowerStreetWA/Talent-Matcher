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

  it("keeps the most relevant job when a window has more than 25 matches", async () => {
    const CAP_QUERY = "__capsort probe engineer__";
    const CAP_TITLE = "__Capsort Probe Engineer__ Exact";
    const fillerIds: string[] = [];
    let capSearchId = "";
    let exactJobId = "";

    const [owner] = await db
      .select({ id: tenantUsersTable.id })
      .from(tenantUsersTable)
      .where(eq(tenantUsersTable.email, "owner@demo.test"))
      .limit(1);
    if (!owner) throw new Error("Seeded demo owner not found");

    try {
      // 30 weak matches (query token only in description) posted NEWER than
      // the exact match, so a postedAt-ordered cap would crowd it out.
      const now = Date.now();
      for (let i = 0; i < 30; i += 1) {
        const [row] = await db
          .insert(jobsTable)
          .values({
            tenantId: "demo",
            title: `Generic Role ${i}`,
            companyName: "Capsort Filler Co",
            descriptionText: `filler ${CAP_QUERY} mention`,
            locationText: "London",
            status: "active",
            isCanonical: true,
            postedAt: new Date(now - i * 1000),
          })
          .returning({ id: jobsTable.id });
        if (row) fillerIds.push(row.id);
      }
      const [exact] = await db
        .insert(jobsTable)
        .values({
          tenantId: "demo",
          title: CAP_TITLE,
          companyName: "Capsort Exact Co",
          locationText: "London",
          status: "active",
          isCanonical: true,
          postedAt: new Date(now - 60 * 1000),
        })
        .returning({ id: jobsTable.id });
      if (!exact) throw new Error("Failed to insert exact-match job");
      exactJobId = exact.id;

      const [saved] = await db
        .insert(savedJobSearchesTable)
        .values({
          tenantId: "demo",
          userId: owner.id,
          name: "__capsort_test__",
          query: CAP_QUERY,
          location: "",
          alertEnabled: true,
          lastRunAt: new Date(now - 60 * 60 * 1000),
        })
        .returning({ id: savedJobSearchesTable.id });
      if (!saved) throw new Error("Failed to insert capsort saved search");
      capSearchId = saved.id;

      await sweepSavedSearchAlerts();

      const events = await db
        .select()
        .from(savedSearchAlertEventsTable)
        .where(eq(savedSearchAlertEventsTable.savedSearchId, capSearchId));
      expect(events).toHaveLength(1);
      expect(events[0]?.jobIds.length).toBeLessThanOrEqual(25);
      // Relevance-before-cap: exact title match must survive the cap even
      // though 30 newer (weaker) matches exist in the same window.
      expect(events[0]?.jobIds).toContain(exactJobId);
    } finally {
      if (capSearchId) {
        await db
          .delete(savedSearchAlertEventsTable)
          .where(eq(savedSearchAlertEventsTable.savedSearchId, capSearchId));
        await db
          .delete(savedJobSearchesTable)
          .where(eq(savedJobSearchesTable.id, capSearchId));
      }
      for (const id of [...fillerIds, exactJobId].filter(Boolean)) {
        await db.delete(jobsTable).where(eq(jobsTable.id, id));
      }
    }
  });
});
