import { describe, it, expect } from "vitest";
import { describeActivity } from "./activityDescription";

describe("describeActivity", () => {
  it("maps known static actions", () => {
    expect(describeActivity("auth.login", null)).toBe("Signed in");
    expect(describeActivity("match.pushed_to_crm", null)).toBe("Match pushed to CRM");
  });

  it("summarizes ingestion runs without leaking raw JSON", () => {
    const metadata = JSON.stringify({
      directory: "london_insurance",
      employers: ["DUAL Group", "Focus Underwriting"],
      totalMatching: 32,
      sharedBoardSkips: 2,
      totals: {
        fetched: 80,
        insertedCanonical: 1,
        insertedDuplicates: 0,
        refreshedExisting: 79,
      },
      errorCount: 0,
    });
    const out = describeActivity("ingestion.careers_directory", metadata);
    expect(out).toBe("Job ingestion — London insurance: 80 fetched, 1 new, 79 refreshed");
    expect(out).not.toContain("{");
  });

  it("handles ingestion actions without totals", () => {
    expect(describeActivity("ingestion.london_insurance_mga", null)).toBe(
      "Job ingestion — London insurance mga",
    );
  });

  it("names saved searches when metadata has one", () => {
    expect(
      describeActivity("job_search.saved", JSON.stringify({ name: "Underwriters" })),
    ).toBe('Search "Underwriters" saved');
    expect(describeActivity("job_search.deleted", null)).toBe("Saved search deleted");
  });

  it("prettifies unknown actions and tolerates malformed metadata", () => {
    expect(describeActivity("crm.sync_failed", "not-json{")).toBe("Crm sync failed");
  });

  it("caps very long descriptions", () => {
    const out = describeActivity("x".repeat(500), null);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
  });
});
