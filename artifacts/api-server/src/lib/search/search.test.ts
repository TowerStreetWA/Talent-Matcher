import { describe, it, expect } from "vitest";
import { normalizeQuery } from "./normalize";
import { scoreJob, scoreCandidate, type JobLike, type CandidateLike } from "./rank";

const job = (overrides: Partial<JobLike>): JobLike => ({
  title: null,
  companyName: null,
  locationText: null,
  industry: null,
  skills: null,
  descriptionText: null,
  ...overrides,
});

const candidate = (overrides: Partial<CandidateLike>): CandidateLike => ({
  firstName: null,
  lastName: null,
  currentTitle: null,
  currentCompany: null,
  locationText: null,
  skills: null,
  titles: null,
  industries: null,
  ...overrides,
});

describe("normalizeQuery", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    const nq = normalizeQuery("  Senior   ENGINEER  ");
    expect(nq.cleaned).toBe("senior engineer");
    expect(nq.tokens).toEqual(["senior", "engineer"]);
  });

  it("strips noise punctuation", () => {
    const nq = normalizeQuery("engineer, (remote)!?");
    expect(nq.cleaned).toBe("engineer remote");
  });

  it("expands recruiter shorthand: swe", () => {
    const nq = normalizeQuery("swe");
    expect(nq.variants).toContain("software engineer");
  });

  it("expands recruiter shorthand: gl accountant", () => {
    const nq = normalizeQuery("gl accountant");
    expect(nq.variants).toContain("general ledger");
    expect(nq.variants).toContain("general ledger accountant");
  });

  it("expands synonyms: developer <-> engineer", () => {
    const nq = normalizeQuery("frontend developer");
    expect(nq.variants).toContain("frontend engineer");
  });

  it("handles plural/singular tolerance", () => {
    const nq = normalizeQuery("engineers");
    expect(nq.tokens).toContain("engineer");
  });

  it("preserves quoted phrases exactly without expansion", () => {
    const nq = normalizeQuery('"general ledger" accountant');
    expect(nq.phrases).toEqual(["general ledger"]);
    expect(nq.tokens).toEqual(["accountant"]);
  });

  it("removes stop words from tokens", () => {
    const nq = normalizeQuery("head of engineering");
    expect(nq.tokens).not.toContain("of");
  });

  it("normalizes hyphens: front-end matches front end", () => {
    const nq = normalizeQuery("front-end developer");
    expect(nq.cleaned).toContain("front end");
  });
});

describe("scoreJob ranking priorities", () => {
  const nq = normalizeQuery("frontend engineer");
  const exact = job({ title: "Frontend Engineer" });
  const phrase = job({ title: "Senior Frontend Engineer" });
  const synonym = job({ title: "Front End Developer" });
  const companyOnly = job({ title: "Sales Lead", companyName: "Frontend Labs" });
  const fuzzyOnly = job({
    title: "Office Manager",
    descriptionText: "supporting the frontend engineer team",
  });

  it("exact title beats phrase-in-title", () => {
    expect(scoreJob(nq, exact).total).toBeGreaterThan(scoreJob(nq, phrase).total);
  });

  it("phrase-in-title beats synonym title", () => {
    expect(scoreJob(nq, phrase).total).toBeGreaterThan(scoreJob(nq, synonym).total);
  });

  it("synonym title beats company-only match", () => {
    expect(scoreJob(nq, synonym).total).toBeGreaterThan(
      scoreJob(nq, companyOnly).total,
    );
  });

  it("company match beats fuzzy description-only match", () => {
    expect(scoreJob(nq, companyOnly).total).toBeGreaterThan(
      scoreJob(nq, fuzzyOnly).total,
    );
  });

  it("shorthand query ranks expanded title highly", () => {
    const swe = normalizeQuery("swe");
    const match = job({ title: "Software Engineer" });
    const miss = job({ title: "Account Executive" });
    expect(scoreJob(swe, match).total).toBeGreaterThanOrEqual(55);
    expect(scoreJob(swe, miss).total).toBe(0);
  });

  it("skills taxonomy contributes but stays below title intent", () => {
    const ts = normalizeQuery("typescript");
    const skillHit = job({ title: "Backend Engineer", skills: ["TypeScript", "Node"] });
    const titleHit = job({ title: "Senior TypeScript Engineer" });
    expect(scoreJob(ts, skillHit).total).toBeGreaterThan(0);
    expect(scoreJob(ts, titleHit).total).toBeGreaterThan(scoreJob(ts, skillHit).total);
  });

  it("zero score for unrelated rows", () => {
    expect(scoreJob(nq, job({ title: "Registered Nurse" })).total).toBe(0);
  });
});

describe("scoreCandidate", () => {
  it("exact name match ranks top", () => {
    const nq = normalizeQuery("Jane Doe");
    const named = candidate({ firstName: "Jane", lastName: "Doe" });
    const titled = candidate({ currentTitle: "Jane of All Trades" });
    expect(scoreCandidate(nq, named).total).toBeGreaterThan(
      scoreCandidate(nq, titled).total,
    );
  });

  it("shorthand matches candidate title via expansion", () => {
    const nq = normalizeQuery("qa");
    const tester = candidate({ currentTitle: "QA Automation Engineer" });
    expect(scoreCandidate(nq, tester).total).toBeGreaterThan(0);
  });

  it("skills and past titles count as taxonomy", () => {
    const nq = normalizeQuery("kubernetes");
    const skilled = candidate({ currentTitle: "Platform Lead", skills: ["Kubernetes"] });
    expect(scoreCandidate(nq, skilled).total).toBeGreaterThan(0);
  });

  it("quoted phrase must appear verbatim in title", () => {
    const nq = normalizeQuery('"general ledger"');
    const glc = candidate({ currentTitle: "General Ledger Accountant" });
    const other = candidate({ currentTitle: "Ledger Analyst, General Ops" });
    expect(scoreCandidate(nq, glc).total).toBeGreaterThan(
      scoreCandidate(nq, other).total,
    );
  });
});
