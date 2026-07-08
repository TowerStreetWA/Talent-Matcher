import { describe, it, expect } from "vitest";
import { resolveSectorInput, expandLocationInput } from "./jobSearchFilters";
import {
  scoreJobSearch,
  locationMatches,
  JOB_SEARCH_BOOSTS,
} from "./jobSearchRank";
import { normalizeQuery } from "./normalize";

describe("resolveSectorInput", () => {
  it("accepts canonical sector tags", () => {
    expect(resolveSectorInput("insurance")).toBe("insurance");
    expect(resolveSectorInput("asset_management")).toBe("asset_management");
  });

  it("maps aliases to internal tags", () => {
    expect(resolveSectorInput("asset management")).toBe("asset_management");
    expect(resolveSectorInput("Asset Mgmt")).toBe("asset_management");
    expect(resolveSectorInput("Bank")).toBe("banking");
    expect(resolveSectorInput("pension")).toBe("pensions");
    expect(resolveSectorInput("London Market")).toBe("insurance");
    expect(resolveSectorInput("wealth management")).toBe("asset_management");
    expect(resolveSectorInput("technology")).toBe("it_tech");
    expect(resolveSectorInput("IT")).toBe("it_tech");
  });

  it("returns null for unknown or empty input", () => {
    expect(resolveSectorInput("hospitality")).toBeNull();
    expect(resolveSectorInput("")).toBeNull();
    expect(resolveSectorInput(null)).toBeNull();
  });
});

describe("expandLocationInput", () => {
  it("expands grouped locations both ways", () => {
    expect(expandLocationInput("Greater London")).toEqual(
      expect.arrayContaining(["london", "greater london", "city of london"]),
    );
    expect(expandLocationInput("london")).toEqual(
      expect.arrayContaining(["greater london"]),
    );
  });

  it("passes through unknown locations cleaned", () => {
    expect(expandLocationInput("  Norwich ")).toEqual(["norwich"]);
  });

  it("handles remote synonyms", () => {
    expect(expandLocationInput("WFH")).toEqual(
      expect.arrayContaining(["remote", "work from home"]),
    );
  });

  it("returns empty for blank input", () => {
    expect(expandLocationInput("   ")).toEqual([]);
  });
});

describe("locationMatches", () => {
  it("matches substrings of the job location", () => {
    expect(locationMatches("London, UK", ["london"])).toBe(true);
    expect(locationMatches("Greater Manchester", ["manchester", "greater manchester"])).toBe(true);
  });
  it("does not match unrelated locations", () => {
    expect(locationMatches("Leeds", ["london"])).toBe(false);
    expect(locationMatches(null, ["london"])).toBe(false);
    expect(locationMatches("London", [])).toBe(false);
  });
});

describe("scoreJobSearch", () => {
  const now = new Date("2026-07-07T00:00:00Z");
  const baseJob = {
    title: "Senior Underwriter",
    companyName: "Acme Insurance",
    locationText: "London",
    industry: "Insurance",
    skills: ["underwriting"],
    descriptionText: "Commercial lines underwriting role",
    sourceType: "direct_employer",
    postedAt: new Date("2026-07-01T00:00:00Z"),
  };

  it("flags title, sector, location, direct employer, and recency", () => {
    const nq = normalizeQuery("underwriter");
    const s = scoreJobSearch(nq, baseJob, {
      sectorFilter: "insurance",
      locationVariants: ["london", "greater london"],
      now,
    });
    expect(s.explanation).toEqual({
      titleMatch: true,
      sectorMatch: true,
      locationMatch: true,
      directEmployer: true,
      recentPosting: true,
    });
    expect(s.sector).toBe("insurance");
    expect(s.score).toBeGreaterThan(
      JOB_SEARCH_BOOSTS.sectorMatch +
        JOB_SEARCH_BOOSTS.locationMatch +
        JOB_SEARCH_BOOSTS.directEmployer +
        JOB_SEARCH_BOOSTS.recentPosting,
    );
  });

  it("scores boosts-only when no query is provided", () => {
    const s = scoreJobSearch(null, baseJob, {
      sectorFilter: "insurance",
      locationVariants: [],
      now,
    });
    expect(s.explanation.titleMatch).toBe(false);
    expect(s.score).toBe(
      JOB_SEARCH_BOOSTS.sectorMatch +
        JOB_SEARCH_BOOSTS.directEmployer +
        JOB_SEARCH_BOOSTS.recentPosting,
    );
  });

  it("ranks a direct-employer job above an identical aggregator job", () => {
    const nq = normalizeQuery("underwriter");
    const direct = scoreJobSearch(nq, baseJob, {
      sectorFilter: null,
      locationVariants: [],
      now,
    });
    const aggregator = scoreJobSearch(
      nq,
      { ...baseJob, sourceType: "google_jobs" },
      { sectorFilter: null, locationVariants: [], now },
    );
    expect(direct.score).toBeGreaterThan(aggregator.score);
  });

  it("gives a smaller boost to 15-30 day old postings and none to older", () => {
    const nq = normalizeQuery("underwriter");
    const recent = scoreJobSearch(nq, baseJob, {
      sectorFilter: null,
      locationVariants: [],
      now,
    });
    const older = scoreJobSearch(
      nq,
      { ...baseJob, postedAt: new Date("2026-06-15T00:00:00Z") },
      { sectorFilter: null, locationVariants: [], now },
    );
    const stale = scoreJobSearch(
      nq,
      { ...baseJob, postedAt: new Date("2026-01-01T00:00:00Z") },
      { sectorFilter: null, locationVariants: [], now },
    );
    expect(recent.score).toBeGreaterThan(older.score);
    expect(older.score).toBeGreaterThan(stale.score);
    expect(older.score - stale.score).toBe(
      JOB_SEARCH_BOOSTS.somewhatRecentPosting,
    );
  });

  it("expands broker query variants to account handler titles", () => {
    const nq = normalizeQuery("broker");
    const s = scoreJobSearch(
      nq,
      { ...baseJob, title: "Account Handler", skills: [] },
      { sectorFilter: null, locationVariants: [], now },
    );
    expect(s.explanation.titleMatch).toBe(true);
  });

  it("does not sector-match a banking job against an insurance filter", () => {
    const nq = normalizeQuery("analyst");
    const s = scoreJobSearch(
      nq,
      {
        ...baseJob,
        title: "KYC Analyst",
        companyName: "BigBank plc",
        industry: "Banking",
        skills: ["kyc"],
        descriptionText: "Retail banking client onboarding and KYC checks",
      },
      { sectorFilter: "insurance", locationVariants: [], now },
    );
    expect(s.sector).toBe("banking");
    expect(s.explanation.sectorMatch).toBe(false);
  });
});
