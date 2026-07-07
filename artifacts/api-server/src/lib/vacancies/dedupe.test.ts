import { describe, it, expect } from "vitest";
import {
  clusterKey,
  isAggregatorHost,
  locationsCompatible,
  normalizeCompany,
  normalizeLocation,
  normalizeTitle,
  parseSalaryText,
  sourcePreferenceRank,
} from "./dedupe";
import { parsePostedAt } from "./googleJobsProvider";

describe("normalizeTitle", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeTitle("Senior Frontend Engineer (React)")).toBe(
      "senior frontend engineer react",
    );
  });
  it("collapses whitespace and accents", () => {
    expect(normalizeTitle("  Développeur   Web ")).toBe("developpeur web");
  });
});

describe("normalizeCompany", () => {
  it("strips legal suffixes", () => {
    expect(normalizeCompany("Monzo Bank Limited")).toBe("monzo bank");
    expect(normalizeCompany("Acme Ltd")).toBe("acme");
    expect(normalizeCompany("Initech, Inc.")).toBe("initech");
  });
  it("strips leading 'the'", () => {
    expect(normalizeCompany("The Guardian")).toBe("guardian");
  });
  it("handles ampersands and null", () => {
    expect(normalizeCompany("Marks & Spencer")).toBe("marks and spencer");
    expect(normalizeCompany(null)).toBe("");
  });
  it("does not strip a suffix that is the whole name", () => {
    expect(normalizeCompany("Limited")).toBe("limited");
  });
});

describe("normalizeLocation", () => {
  it("reduces to the city bucket", () => {
    expect(normalizeLocation("London, UK")).toBe("london");
    expect(normalizeLocation("Greater London")).toBe("london");
    expect(normalizeLocation("Manchester, England, United Kingdom")).toBe("manchester");
  });
  it("drops postcodes/leading digits", () => {
    expect(normalizeLocation("London EC2A 4BX")).toBe("london ec2a");
  });
  it("handles null", () => {
    expect(normalizeLocation(null)).toBe("");
  });
});

describe("locationsCompatible", () => {
  it("treats unknown locations as compatible", () => {
    expect(locationsCompatible(null, "London")).toBe(true);
  });
  it("matches same normalized city", () => {
    expect(locationsCompatible("London, UK", "Greater London")).toBe(true);
  });
  it("rejects different cities", () => {
    expect(locationsCompatible("London", "Leeds")).toBe(false);
  });
});

describe("clusterKey", () => {
  it("is identical for duplicate postings from different sources", () => {
    const a = clusterKey({
      title: "Senior Data Engineer",
      companyName: "Octopus Energy Ltd",
      locationText: "London, UK",
    });
    const b = clusterKey({
      title: "Senior Data Engineer",
      companyName: "Octopus Energy",
      locationText: "Greater London",
    });
    expect(a).toBe(b);
  });
  it("differs for different companies", () => {
    const a = clusterKey({ title: "Engineer", companyName: "Acme", locationText: null });
    const b = clusterKey({ title: "Engineer", companyName: "Globex", locationText: null });
    expect(a).not.toBe(b);
  });
});

describe("isAggregatorHost", () => {
  it("flags known aggregators", () => {
    expect(isAggregatorHost("https://www.linkedin.com/jobs/view/123")).toBe(true);
    expect(isAggregatorHost("https://uk.indeed.com/viewjob?jk=1")).toBe(true);
  });
  it("treats employer domains as non-aggregator", () => {
    expect(isAggregatorHost("https://monzo.com/careers/role-1")).toBe(false);
  });
  it("treats missing/invalid URLs as aggregator (least preferred)", () => {
    expect(isAggregatorHost(null)).toBe(true);
    expect(isAggregatorHost("not a url")).toBe(true);
  });
});

describe("sourcePreferenceRank", () => {
  const direct = sourcePreferenceRank({
    sourceType: "direct_employer",
    sourceUrl: "https://monzo.com/careers/x",
  });
  const googleEmployer = sourcePreferenceRank({
    sourceType: "google_jobs",
    sourceUrl: "https://monzo.com/careers/x",
  });
  const googleAggregator = sourcePreferenceRank({
    sourceType: "google_jobs",
    sourceUrl: "https://www.linkedin.com/jobs/view/1",
  });
  const legacy = sourcePreferenceRank({ sourceType: null, sourceUrl: null });

  it("prefers direct employer above all", () => {
    expect(direct).toBeLessThan(googleEmployer);
    expect(direct).toBeLessThan(legacy);
  });
  it("prefers google_jobs on employer domain over aggregator copies", () => {
    expect(googleEmployer).toBeLessThan(googleAggregator);
  });
  it("ranks legacy/manual rows between direct and aggregator google results", () => {
    expect(legacy).toBeGreaterThan(direct);
    expect(legacy).toBeLessThan(googleEmployer);
  });
  it("ranks future job_board/agency below google_jobs", () => {
    expect(sourcePreferenceRank({ sourceType: "job_board", sourceUrl: null })).toBeGreaterThan(
      googleAggregator,
    );
    expect(sourcePreferenceRank({ sourceType: "agency", sourceUrl: null })).toBeGreaterThan(
      sourcePreferenceRank({ sourceType: "job_board", sourceUrl: null }),
    );
  });
});

describe("parseSalaryText", () => {
  it("parses a GBP range", () => {
    expect(parseSalaryText("£65,000 – £80,000 a year")).toEqual({
      salaryMin: 65000,
      salaryMax: 80000,
      salaryCurrency: "GBP",
    });
  });
  it("parses k-notation", () => {
    expect(parseSalaryText("$120k")).toEqual({
      salaryMin: 120000,
      salaryMax: 120000,
      salaryCurrency: "USD",
    });
  });
  it("parses currency codes", () => {
    expect(parseSalaryText("70000 GBP")).toEqual({
      salaryMin: 70000,
      salaryMax: 70000,
      salaryCurrency: "GBP",
    });
  });
  it("returns nulls for vague text", () => {
    expect(parseSalaryText("Competitive")).toEqual({
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
    });
  });
  it("handles null", () => {
    expect(parseSalaryText(null)).toEqual({
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
    });
  });
});

describe("parsePostedAt", () => {
  const now = new Date("2026-07-07T12:00:00Z");
  it("parses relative days", () => {
    expect(parsePostedAt("3 days ago", now)?.toISOString()).toBe("2026-07-04T12:00:00.000Z");
  });
  it("parses hours", () => {
    expect(parsePostedAt("5 hours ago", now)?.toISOString()).toBe("2026-07-07T07:00:00.000Z");
  });
  it("returns null for unparsable strings", () => {
    expect(parsePostedAt("recently", now)).toBeNull();
    expect(parsePostedAt(null, now)).toBeNull();
  });
});
