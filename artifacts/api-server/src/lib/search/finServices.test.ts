import { describe, it, expect } from "vitest";
import { normalizeQuery } from "./normalize";
import {
  classifyVacancy,
  classifyEmployerType,
  inferCandidateFinProfile,
  inferQueryFinIntent,
} from "./finClassify";
import { scoreJob, scoreCandidate, type JobLike, type CandidateLike } from "./rank";

const job = (overrides: Partial<JobLike>): JobLike => ({
  title: "",
  companyName: "",
  locationText: "",
  industry: null,
  skills: [],
  descriptionText: "",
  ...overrides,
});

const candidate = (overrides: Partial<CandidateLike>): CandidateLike => ({
  firstName: "A",
  lastName: "B",
  currentTitle: "",
  currentCompany: "",
  locationText: "",
  skills: [],
  titles: [],
  industries: [],
  ...overrides,
});

describe("classifyVacancy", () => {
  it("tags an insurance DA role", () => {
    const tags = classifyVacancy({
      title: "Delegated Authority Analyst",
      descriptionText: "Bordereaux processing for our Lloyd's syndicate binders",
      companyName: "Beazley",
    });
    expect(tags.sector).toBe("insurance");
    expect(tags.fn).toBe("underwriting");
    expect(tags.employerType).toBe("insurer");
    expect(tags.matchedTerms.length).toBeGreaterThan(0);
  });

  it("tags a banking compliance role", () => {
    const tags = classifyVacancy({
      title: "KYC Analyst",
      descriptionText: "AML and sanctions screening, client onboarding",
      companyName: "HSBC",
    });
    expect(tags.sector).toBe("banking");
    expect(tags.fn).toBe("compliance");
    expect(tags.employerType).toBe("bank");
  });

  it("tags a pensions administration role", () => {
    const tags = classifyVacancy({
      title: "Pensions Administrator",
      descriptionText: "DB and DC scheme events, SIPP administration",
      companyName: "XPS Pensions Group",
    });
    expect(tags.sector).toBe("pensions");
    expect(tags.fn).toBe("pensions_admin");
    expect(tags.employerType).toBe("pension_consultancy");
  });

  it("tags an asset management operations role", () => {
    const tags = classifyVacancy({
      title: "Investment Operations Analyst",
      descriptionText: "Transfer agency, settlements and client reporting",
      companyName: "Schroders",
    });
    expect(tags.sector).toBe("asset_management");
    expect(tags.fn).toBe("operations");
    expect(tags.employerType).toBe("asset_manager");
  });

  it("leaves non-FS roles untagged", () => {
    expect(classifyVacancy({ title: "Registered Nurse", companyName: "NHS" }).sector).toBeNull();
    expect(
      classifyVacancy({ title: "Warehouse Operative", companyName: "Logistics Co" }).sector,
    ).toBeNull();
    expect(
      classifyVacancy({ title: "Marketing Manager", companyName: "Acme Media" }).sector,
    ).toBeNull();
  });

  it("classifies IT/tech roles under the it_tech sector", () => {
    const tags = classifyVacancy({ title: "Frontend Engineer", companyName: "Monzo" });
    expect(tags.sector).toBe("it_tech");
    expect(tags.fn).toBe("software_engineering");
  });

  it("does not tag a generic analyst just because of the word analyst", () => {
    const tags = classifyVacancy({
      title: "Business Analyst",
      descriptionText: "Requirements gathering and stakeholder workshops",
      companyName: "Retail Group",
    });
    expect(tags.sector).toBeNull();
  });
});

describe("classifyEmployerType", () => {
  it("classifies by name keywords", () => {
    expect(classifyEmployerType("Hiscox Insurance")).toBe("insurer");
    expect(classifyEmployerType("Marsh")).toBe("broker");
    expect(classifyEmployerType("Swiss Re")).toBe("reinsurer");
    expect(classifyEmployerType("Barclays Bank UK")).toBe("bank");
    expect(classifyEmployerType("Barnett Waddingham")).toBe("pension_consultancy");
    expect(classifyEmployerType("BlackRock")).toBe("asset_manager");
    expect(classifyEmployerType("Evelyn Partners Wealth")).toBe("wealth_manager");
    expect(classifyEmployerType("Acme Underwriting Agency")).toBe("mga");
  });

  it("returns null for unknown employers", () => {
    expect(classifyEmployerType("Tesco")).toBeNull();
    expect(classifyEmployerType("")).toBeNull();
    expect(classifyEmployerType(null)).toBeNull();
  });
});

describe("inferQueryFinIntent", () => {
  it("detects insurance intent from DA terminology", () => {
    const intent = inferQueryFinIntent(normalizeQuery("delegated authority analyst"));
    expect(intent.hasFinIntent).toBe(true);
    expect(intent.sector).toBe("insurance");
  });

  it("detects asset management intent from fund operations", () => {
    const intent = inferQueryFinIntent(normalizeQuery("fund operations"));
    expect(intent.hasFinIntent).toBe(true);
    expect(intent.sector).toBe("asset_management");
    expect(intent.fn).toBe("operations");
  });

  it("detects pensions intent from pensions admin", () => {
    const intent = inferQueryFinIntent(normalizeQuery("pensions admin"));
    expect(intent.hasFinIntent).toBe(true);
    expect(intent.sector).toBe("pensions");
    expect(intent.fn).toBe("pensions_admin");
  });

  it("expands FS abbreviations (kyc, aml)", () => {
    const intent = inferQueryFinIntent(normalizeQuery("kyc aml onboarding"));
    expect(intent.hasFinIntent).toBe(true);
    expect(intent.sector).toBe("banking");
    expect(intent.fn).toBe("compliance");
  });

  it("has no FS intent for generic queries", () => {
    expect(inferQueryFinIntent(normalizeQuery("warehouse operative")).hasFinIntent).toBe(false);
    expect(inferQueryFinIntent(normalizeQuery("marketing manager")).hasFinIntent).toBe(false);
    expect(inferQueryFinIntent(normalizeQuery("registered nurse")).hasFinIntent).toBe(false);
    expect(inferQueryFinIntent(normalizeQuery("analyst")).hasFinIntent).toBe(false);
  });

  it("detects it_tech intent for tech queries", () => {
    const intent = inferQueryFinIntent(normalizeQuery("frontend engineer"));
    expect(intent.hasFinIntent).toBe(true);
    expect(intent.sector).toBe("it_tech");
  });
});

describe("inferCandidateFinProfile", () => {
  it("infers insurance/operations from Lloyd's market CV signals", () => {
    const profile = inferCandidateFinProfile({
      currentTitle: "Bordereaux Technician",
      currentCompany: "Acme MGA",
      titles: ["Delegated Authority Analyst"],
      skills: ["bordereaux", "binder management", "Lloyd's reporting"],
      industries: ["Insurance"],
    });
    expect(profile.sector).toBe("insurance");
    expect(profile.employerType).toBe("mga");
  });

  it("infers banking/compliance from KYC-heavy CV signals", () => {
    const profile = inferCandidateFinProfile({
      currentTitle: "KYC Onboarding Analyst",
      currentCompany: "NatWest",
      skills: ["KYC", "AML", "sanctions", "client onboarding"],
      industries: ["Banking"],
    });
    expect(profile.sector).toBe("banking");
    expect(profile.fn).toBe("compliance");
    expect(profile.employerType).toBe("bank");
  });

  it("returns null tags for non-FS candidates", () => {
    const profile = inferCandidateFinProfile({
      currentTitle: "Senior React Developer",
      currentCompany: "Tech Startup Ltd",
      skills: ["react", "typescript"],
      industries: ["Software"],
    });
    expect(profile.sector).toBeNull();
  });
});

describe("FS ranking boosts", () => {
  it("ranks insurance DA jobs above generic analyst roles for 'delegated authority analyst'", () => {
    const nq = normalizeQuery("delegated authority analyst");
    const intent = inferQueryFinIntent(nq);
    const daJob = job({
      title: "Bordereaux Analyst",
      companyName: "Canopius",
      descriptionText: "Delegated authority and binder management for our syndicate",
    });
    const genericAnalyst = job({
      title: "Data Analyst",
      companyName: "Retail Group",
      descriptionText: "SQL dashboards and reporting",
    });
    expect(scoreJob(nq, daJob, intent).total).toBeGreaterThan(
      scoreJob(nq, genericAnalyst, intent).total,
    );
  });

  it("ranks AM operations above generic finance ops for 'fund operations'", () => {
    const nq = normalizeQuery("fund operations");
    const intent = inferQueryFinIntent(nq);
    const amOps = job({
      title: "Investment Operations Analyst",
      companyName: "Baillie Gifford",
      descriptionText: "Fund accounting, transfer agency oversight and settlements",
    });
    const genericOps = job({
      title: "Operations Manager",
      companyName: "Logistics Co",
      descriptionText: "Warehouse operations and staffing",
    });
    expect(scoreJob(nq, amOps, intent).total).toBeGreaterThan(
      scoreJob(nq, genericOps, intent).total,
    );
  });

  it("ranks pensions administration above generic admin for 'pensions admin'", () => {
    const nq = normalizeQuery("pensions admin");
    const intent = inferQueryFinIntent(nq);
    const pensionsAdmin = job({
      title: "Pensions Administrator",
      companyName: "Hymans Robertson",
      descriptionText: "DB and DC scheme administration, scheme events",
    });
    const genericAdmin = job({
      title: "Office Administrator",
      companyName: "Retail Group",
      descriptionText: "General admin duties and diary management",
    });
    expect(scoreJob(nq, pensionsAdmin, intent).total).toBeGreaterThan(
      scoreJob(nq, genericAdmin, intent).total,
    );
  });

  it("boosts direct-employer FS roles over identical board-sourced roles", () => {
    const nq = normalizeQuery("underwriter");
    const intent = inferQueryFinIntent(nq);
    const base = {
      title: "Assistant Underwriter",
      companyName: "Hiscox",
      descriptionText: "Property underwriting",
    };
    const direct = job({ ...base, sourceType: "direct_employer" });
    const board = job({ ...base, sourceType: "job_board" });
    expect(scoreJob(nq, direct, intent).total).toBeGreaterThan(
      scoreJob(nq, board, intent).total,
    );
  });

  it("does not give the direct-employer boost to non-FS jobs on FS queries", () => {
    const nq = normalizeQuery("delegated authority analyst");
    const intent = inferQueryFinIntent(nq);
    const nonFsDirect = job({
      title: "Senior Credit Analyst",
      companyName: "Monzo",
      descriptionText: "Consumer lending analytics",
      sourceType: "direct_employer",
    });
    expect(scoreJob(nq, nonFsDirect, intent).finDirectEmployer).toBe(0);
  });

  it("does not change scores for non-FS queries", () => {
    const nq = normalizeQuery("marketing manager");
    const intent = inferQueryFinIntent(nq);
    const mmJob = job({
      title: "Marketing Manager",
      companyName: "Acme Media",
      sourceType: "direct_employer",
    });
    const withIntent = scoreJob(nq, mmJob, intent);
    const without = scoreJob(nq, mmJob, null);
    expect(withIntent.total).toBe(without.total);
    expect(withIntent.finSector).toBe(0);
    expect(withIntent.finDirectEmployer).toBe(0);
  });

  it("boosts FS candidates for FS queries", () => {
    const nq = normalizeQuery("kyc analyst");
    const intent = inferQueryFinIntent(nq);
    const kycCandidate = candidate({
      currentTitle: "KYC Analyst",
      currentCompany: "Barclays Bank",
      skills: ["KYC", "AML", "sanctions"],
      industries: ["Banking"],
    });
    const genericCandidate = candidate({
      currentTitle: "Financial Analyst",
      currentCompany: "Retail Group",
      skills: ["excel", "reporting"],
    });
    const kycScore = scoreCandidate(nq, kycCandidate, intent);
    expect(kycScore.total).toBeGreaterThan(
      scoreCandidate(nq, genericCandidate, intent).total,
    );
    expect(kycScore.finSector).toBeGreaterThan(0);
  });

  it("exposes explainability metadata on the breakdown", () => {
    const nq = normalizeQuery("reserving actuary");
    const intent = inferQueryFinIntent(nq);
    const b = scoreJob(
      nq,
      job({
        title: "Reserving Actuary",
        companyName: "Aviva",
        descriptionText: "Reserving across personal lines",
      }),
      intent,
    );
    expect(b.finTags?.sector).toBe("insurance");
    expect(b.finTags?.fn).toBe("actuarial");
    expect(b.finTags?.employerType).toBe("insurer");
    expect(b.finTags?.matchedTerms.length).toBeGreaterThan(0);
    expect(b.finSector).toBeGreaterThan(0);
    expect(b.finFunction).toBeGreaterThan(0);
    expect(b.finEmployerType).toBeGreaterThan(0);
  });
});
