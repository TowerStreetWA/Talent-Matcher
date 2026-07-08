import { describe, it, expect } from "vitest";
import type { Candidate, Job } from "@workspace/db";
import { computeMatch } from "./matching";

const baseCandidate = (overrides: Partial<Candidate>): Candidate =>
  ({
    id: "c1",
    tenantId: "demo",
    firstName: "A",
    lastName: "B",
    email: null,
    phone: null,
    currentTitle: null,
    currentCompany: null,
    locationText: "London",
    summary: null,
    seniority: null,
    skills: [],
    titles: [],
    industries: [],
    remotePreference: null,
    desiredSalaryMin: null,
    desiredSalaryMax: null,
    salaryCurrency: null,
    cvFileName: null,
    cvFileKey: null,
    cvText: null,
    status: "active",
    lastMatchedAt: null,
    bestMatchScore: null,
    matchCount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Candidate;

const baseJob = (overrides: Partial<Job>): Job =>
  ({
    id: "j1",
    tenantId: "demo",
    sourceId: null,
    title: "Role",
    companyName: null,
    locationText: "London",
    remoteType: null,
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    descriptionText: null,
    applyUrl: null,
    industry: null,
    skills: [],
    postedAt: new Date(),
    expiresAt: null,
    status: "active",
    salaryText: null,
    sourceType: null,
    sourceProvider: null,
    sourceUrl: null,
    discoveredAt: null,
    canonicalGroupId: null,
    isCanonical: true,
    backingSources: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Job;

describe("computeMatch FS sector alignment (industry factor)", () => {
  it("scores industry 1.0 when candidate and job share an FS sector", () => {
    const candidate = baseCandidate({
      currentTitle: "Assistant Underwriter",
      titles: ["Underwriting Assistant"],
      skills: ["delegated authority", "bordereaux"],
      industries: ["Insurance"],
    });
    const job = baseJob({
      title: "Commercial Underwriter",
      companyName: "Hiscox",
      descriptionText: "Underwriting mid-market commercial risks",
      industry: "Insurance",
    });
    const result = computeMatch(candidate, job);
    expect(result.scoreBreakdown.industry).toBe(1);
    expect(result.explanation.some((l) => l.startsWith("Sector match"))).toBe(true);
  });

  it("flags a sector gap when both classify into different FS sectors", () => {
    const candidate = baseCandidate({
      currentTitle: "KYC Analyst",
      skills: ["kyc", "aml", "sanctions"],
      industries: ["Banking"],
    });
    const job = baseJob({
      title: "Pensions Administrator",
      companyName: "XPS Pensions",
      descriptionText: "DB and DC scheme events administration",
    });
    const result = computeMatch(candidate, job);
    expect(result.scoreBreakdown.industry).toBe(0.2);
    expect(result.explanation.some((l) => l.startsWith("Sector gap"))).toBe(true);
  });

  it("falls back to legacy industry logic for non-FS jobs", () => {
    const candidate = baseCandidate({
      currentTitle: "Marketing Manager",
      skills: ["seo", "campaign management"],
      industries: ["Media"],
    });
    const job = baseJob({
      title: "Marketing Manager",
      companyName: "Acme Media",
      descriptionText: "Brand campaigns and content marketing",
      industry: "Media",
    });
    const result = computeMatch(candidate, job);
    expect(result.scoreBreakdown.industry).toBe(1);
    expect(
      result.explanation.some((l) => l.startsWith("Industry match")),
    ).toBe(true);
  });

  it("does not penalize a non-FS candidate against an FS job beyond the legacy gap score", () => {
    const candidate = baseCandidate({
      currentTitle: "Marketing Manager",
      skills: ["seo", "content"],
      industries: ["Media"],
    });
    const job = baseJob({
      title: "Claims Handler",
      companyName: "Aviva",
      descriptionText: "Motor claims handling",
      industry: "Insurance",
    });
    const result = computeMatch(candidate, job);
    // Candidate has no FS classification → legacy industry-text path applies
    expect(result.scoreBreakdown.industry).toBe(0.2);
    expect(result.explanation.some((l) => l.startsWith("Industry gap"))).toBe(true);
  });
});
