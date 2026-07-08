import { describe, it, expect } from "vitest";
import { lookupCuratedTitle, curatedSynonymGroups } from "./curatedTitles";
import { classifyVacancy } from "./finClassify";
import { normalizeQuery } from "./normalize";
import { CURATED_TITLES } from "../../config/curatedTitles";

describe("lookupCuratedTitle", () => {
  it("matches a canonical title exactly (case/punctuation-insensitive)", () => {
    const match = lookupCuratedTitle("Claims Handler");
    expect(match).not.toBeNull();
    expect(match!.entry.canonicalTitle).toBe("Claims Handler");
    expect(match!.entry.industry).toBe("insurance");
    expect(match!.entry.family).toBe("claims");
  });

  it("matches a variant spelling", () => {
    const match = lookupCuratedTitle("claims negotiator");
    expect(match?.entry.canonicalTitle).toBe("Claims Handler");
    expect(lookupCuratedTitle("field adjuster")?.entry.canonicalTitle).toBe("Claims Adjuster");
    expect(lookupCuratedTitle("treaty underwriter")?.entry.tags).toContain("reinsurance");
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

  it("does not force-tag cross-sector titles lacking an insurance qualifier", () => {
    // These titles exist widely outside insurance; curated entries only carry
    // insurance-qualified variants, so bare forms must not match.
    expect(lookupCuratedTitle("Data Protection Officer")).toBeNull();
    expect(lookupCuratedTitle("Account Handler")).toBeNull();
    expect(lookupCuratedTitle("Head of Placement")).toBeNull();
    expect(lookupCuratedTitle("Conduct Risk Manager")).toBeNull();
    expect(lookupCuratedTitle("Chief Risk Officer")).toBeNull();
    expect(lookupCuratedTitle("Operational Risk Manager")).toBeNull();
    expect(lookupCuratedTitle("Distribution Manager")).toBeNull();
    expect(lookupCuratedTitle("Head of Pricing")).toBeNull();
    expect(lookupCuratedTitle("Sales Agent")).toBeNull();
    // ...while their insurance-qualified forms do match
    expect(lookupCuratedTitle("Conduct Risk Manager (Insurance)")?.entry.family).toBe("compliance");
    expect(lookupCuratedTitle("Insurance Account Handler")?.entry.family).toBe("client_service");
  });
});

describe("curated taxonomy integrity (all industries)", () => {
  it("has no duplicate normalized term across entries", () => {
    const norm = (v: string) =>
      v
        .toLowerCase()
        .replace(/[^a-z0-9&' ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const entry of CURATED_TITLES) {
      for (const term of [entry.canonicalTitle, ...entry.variants]) {
        const key = norm(term);
        const owner = seen.get(key);
        if (owner && owner !== entry.canonicalTitle) {
          dups.push(`"${key}" in both "${owner}" and "${entry.canonicalTitle}"`);
        } else {
          seen.set(key, entry.canonicalTitle);
        }
      }
    }
    expect(dups).toEqual([]);
  });

  it("covers every expected industry", () => {
    const industries = new Set(CURATED_TITLES.map((e) => e.industry));
    expect(industries).toEqual(
      new Set(["insurance", "banking", "pensions", "asset_management", "accountancy_finance"]),
    );
  });
});

describe("banking curated lookups", () => {
  it("matches banking titles and variants", () => {
    expect(lookupCuratedTitle("KYC Analyst")?.entry.industry).toBe("banking");
    expect(lookupCuratedTitle("know your customer analyst")?.entry.canonicalTitle).toBe("KYC Analyst");
    expect(lookupCuratedTitle("Mortgage Underwriter")?.entry.family).toBe("underwriting");
    expect(lookupCuratedTitle("VP Investment Banking")?.entry.canonicalTitle).toBe(
      "Vice President (Investment Banking)",
    );
    expect(lookupCuratedTitle("mergers and acquisitions analyst")?.entry.canonicalTitle).toBe("M&A Analyst");
  });

  it("does not force-tag cross-sector titles lacking a banking qualifier", () => {
    expect(lookupCuratedTitle("Branch Manager")).toBeNull();
    expect(lookupCuratedTitle("Collections Manager")).toBeNull();
    expect(lookupCuratedTitle("Contact Centre Agent")).toBeNull();
    expect(lookupCuratedTitle("Customer Service Representative")).toBeNull();
    // ...while qualified forms match
    expect(lookupCuratedTitle("Bank Branch Manager")?.entry.industry).toBe("banking");
    expect(lookupCuratedTitle("Business Analyst (Banking)")?.entry.industry).toBe("banking");
  });
});

describe("pensions curated lookups", () => {
  it("matches pensions titles and variants", () => {
    expect(lookupCuratedTitle("Pensions Administrator")?.entry.family).toBe("pensions_admin");
    expect(lookupCuratedTitle("pension actuary")?.entry.canonicalTitle).toBe("Pensions Actuary");
    expect(lookupCuratedTitle("liability driven investment analyst")?.entry.canonicalTitle).toBe("LDI Analyst");
    expect(lookupCuratedTitle("auto enrollment specialist")?.entry.industry).toBe("pensions");
    expect(lookupCuratedTitle("buyout actuary")?.entry.tags).toContain("de_risking");
  });

  it("Pensions Actuary lives in the pensions file (single definition)", () => {
    const entries = CURATED_TITLES.filter((e) => e.canonicalTitle === "Pensions Actuary");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.industry).toBe("pensions");
    expect(entries[0]!.tags).toContain("actuarial_risk");
  });
});

describe("fund managers / asset management curated lookups", () => {
  it("matches core buy-side titles", () => {
    expect(lookupCuratedTitle("Fixed Income Portfolio Manager")?.entry.industry).toBe("asset_management");
    expect(lookupCuratedTitle("bond fund manager")?.entry.canonicalTitle).toBe("Fixed Income Portfolio Manager");
    expect(lookupCuratedTitle("buy side equity trader")?.entry.family).toBe("investments");
    expect(lookupCuratedTitle("nav analyst")?.entry.canonicalTitle).toBe("NAV Specialist");
  });

  it("matches real-assets titles", () => {
    expect(lookupCuratedTitle("Infrastructure Portfolio Manager")?.entry.tags).toContain("real_assets_investment");
    expect(lookupCuratedTitle("property asset manager")?.entry.canonicalTitle).toBe("Asset Manager (Real Estate)");
    expect(lookupCuratedTitle("Proxy Voting Analyst")?.entry.tags).toContain("esg");
  });

  it("overlapping FM/AM titles are defined once with merged variants", () => {
    const headOfDist = lookupCuratedTitle("head of distribution asset management");
    expect(headOfDist?.entry.canonicalTitle).toBe("Head of Distribution (Asset Management)");
    expect(lookupCuratedTitle("rfp writer institutional")?.entry.canonicalTitle).toBe("RFP Writer (Asset Management)");
    expect(lookupCuratedTitle("deputy cio asset management")?.entry.canonicalTitle).toBe(
      "Deputy Chief Investment Officer",
    );
  });

  it("does not force-tag ambiguous titles lacking a qualifier", () => {
    expect(lookupCuratedTitle("Performance Analyst")).toBeNull(); // sports/marketing collision
    expect(lookupCuratedTitle("Valuations Analyst")).toBeNull(); // property collision
    expect(lookupCuratedTitle("Head of Research")).toBeNull();
    expect(lookupCuratedTitle("Investment Performance Analyst")?.entry.industry).toBe("asset_management");
  });
});

describe("accountancy/finance curated lookups", () => {
  it("matches practice and in-house finance titles", () => {
    expect(lookupCuratedTitle("Financial Controller")?.entry.industry).toBe("accountancy_finance");
    expect(lookupCuratedTitle("Audit Senior")?.entry.family).toBe("compliance");
    expect(lookupCuratedTitle("purchase ledger clerk")?.entry.canonicalTitle).toBe("Accounts Payable Clerk");
    expect(lookupCuratedTitle("financial planning and analysis analyst")?.entry.canonicalTitle).toBe("FP&A Analyst");
    expect(lookupCuratedTitle("VAT Consultant")?.entry.tags).toContain("tax");
  });

  it("bare finance titles resolve to accountancy_finance; qualified forms beat them", () => {
    expect(lookupCuratedTitle("Chief Financial Officer")?.entry.industry).toBe("accountancy_finance");
    expect(lookupCuratedTitle("Chief Financial Officer (Banking)")?.entry.industry).toBe("banking");
    expect(lookupCuratedTitle("Management Accountant")?.entry.industry).toBe("accountancy_finance");
    expect(lookupCuratedTitle("Management Accountant (Asset Management)")?.entry.industry).toBe("asset_management");
    expect(lookupCuratedTitle("Internal Auditor")?.entry.industry).toBe("accountancy_finance");
    expect(lookupCuratedTitle("Internal Auditor (Banking)")?.entry.industry).toBe("banking");
    expect(lookupCuratedTitle("Head of Treasury")?.entry.industry).toBe("accountancy_finance");
    expect(lookupCuratedTitle("Head of Treasury (Banking)")?.entry.industry).toBe("banking");
  });

  it("bare 'Business Partner' is not curated (HR/IT collision)", () => {
    expect(lookupCuratedTitle("Business Partner")).toBeNull();
    expect(lookupCuratedTitle("HR Business Partner")).toBeNull();
    expect(lookupCuratedTitle("Finance Business Partner")?.entry.industry).toBe("accountancy_finance");
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
    expect(claims).toContain("claims negotiator");
  });

  it("expands a curated variant into its siblings in query variants", () => {
    const nq = normalizeQuery("claims negotiator");
    expect(nq.variants).toContain("claims handler");
  });

  it("expands the canonical form into variants too", () => {
    const nq = normalizeQuery("loss adjuster");
    expect(nq.variants).toContain("loss adjustor");
  });
});
