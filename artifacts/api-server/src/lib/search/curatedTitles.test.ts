import { describe, it, expect } from "vitest";
import { lookupCuratedTitle, curatedSynonymGroups } from "./curatedTitles";
import { classifyVacancy } from "./finClassify";
import { normalizeQuery } from "./normalize";

describe("lookupCuratedTitle", () => {
  it("matches a canonical title exactly (case/punctuation-insensitive)", () => {
    const match = lookupCuratedTitle("Claims Handler");
    expect(match).not.toBeNull();
    expect(match!.entry.canonicalTitle).toBe("Claims Handler");
    expect(match!.entry.industry).toBe("insurance");
    expect(match!.entry.family).toBe("claims");
  });

  it("matches a variant spelling", () => {
    const match = lookupCuratedTitle("claims adjuster");
    expect(match?.entry.canonicalTitle).toBe("Claims Handler");
  });

  it("matches a multi-word variant contained in a longer title", () => {
    const match = lookupCuratedTitle("Senior Loss Adjuster - Property (London)");
    expect(match?.entry.canonicalTitle).toBe("Loss Adjuster");
  });

  it("prefers the longest contained variant", () => {
    const match = lookupCuratedTitle("Experienced Senior Insurance Underwriter needed");
    expect(match?.entry.canonicalTitle).toBe("Senior Underwriter");
  });

  it("single-word abbreviations only match exactly", () => {
    expect(lookupCuratedTitle("uw")?.entry.canonicalTitle).toBe("Underwriter");
    // "uw" inside a longer, unrelated title must not fire the contains path
    expect(lookupCuratedTitle("software engineer uw team")).toBeNull();
  });

  it("returns null for unrelated titles", () => {
    expect(lookupCuratedTitle("Software Engineer")).toBeNull();
    expect(lookupCuratedTitle(null)).toBeNull();
    expect(lookupCuratedTitle("")).toBeNull();
  });
});

describe("classifyVacancy curated override", () => {
  it("tags a curated title even without body evidence", () => {
    const tags = classifyVacancy({ title: "Underwriting Assistant" });
    expect(tags.sector).toBe("insurance");
    expect(tags.fn).toBe("underwriting");
  });

  it("still classifies employer type alongside the override", () => {
    const tags = classifyVacancy({
      title: "Claims Handler",
      companyName: "Howden Broking Group",
    });
    expect(tags.sector).toBe("insurance");
    expect(tags.employerType).toBe("broker");
  });

  it("does not affect non-curated titles", () => {
    const tags = classifyVacancy({ title: "Barista" });
    expect(tags.sector).toBeNull();
    expect(tags.fn).toBeNull();
  });
});

describe("curatedSynonymGroups + search expansion", () => {
  it("produces a group per entry including canonical + variants", () => {
    const groups = curatedSynonymGroups();
    const claims = groups.find((g) => g.includes("claims handler"));
    expect(claims).toBeDefined();
    expect(claims).toContain("claims adjuster");
  });

  it("expands a curated variant into its siblings in query variants", () => {
    const nq = normalizeQuery("claims adjuster");
    expect(nq.variants).toContain("claims handler");
  });

  it("expands the canonical form into variants too", () => {
    const nq = normalizeQuery("loss adjuster");
    expect(nq.variants).toContain("loss adjustor");
  });
});
