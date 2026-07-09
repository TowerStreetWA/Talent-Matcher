import { describe, expect, it } from "vitest";
import {
  classifyCompanyKind,
  hasRecruiterTextSignals,
  normalizeCompanyName,
} from "./companyKind";

describe("normalizeCompanyName", () => {
  it("strips legal suffixes and noise tokens repeatedly", () => {
    expect(normalizeCompanyName("Hays Specialist Recruitment Limited")).toBe(
      "hays specialist recruitment",
    );
    expect(normalizeCompanyName("IPS Group UK")).toBe("ips");
    expect(normalizeCompanyName("IPS Group")).toBe("ips");
    expect(normalizeCompanyName("Selby Jennings London")).toBe("selby jennings");
  });

  it("folds ampersands and punctuation", () => {
    expect(normalizeCompanyName("BWD Search & Selection")).toBe(
      "bwd search and selection",
    );
    expect(normalizeCompanyName("Harnham - Data & Analytics Recruitment")).toBe(
      "harnham data and analytics recruitment",
    );
  });

  it("never strips a name to nothing", () => {
    expect(normalizeCompanyName("Group")).toBe("group");
    expect(normalizeCompanyName("Ltd")).toBe("ltd");
  });
});

describe("classifyCompanyKind — registry names", () => {
  const recruiters = [
    "Eames Consulting",
    "IPS Group",
    "IPS Group UK",
    "Hays",
    "Hays Technology",
    "Hays Specialist Recruitment Limited",
    "Robert Walters",
    "Robert Half",
    "Morgan McKinley",
    "Michael Page Finance",
    "Michael Page Banking",
    "Page Personnel",
    "Reed",
    "Reed Accountancy",
    "Selby Jennings London",
    "Goodman Masson",
    "Oliver James Associates",
    "Lorien",
    "Experis",
    "La Fosse Associates",
    "Randstad Technologies",
    "Harvey Nash",
    "Marks Sattin",
    "Investigo",
    "Bruin Financial",
    "Alexander Lloyd",
    "BranWell Ford",
  ];
  for (const name of recruiters) {
    it(`classifies "${name}" as recruitment_firm`, () => {
      expect(classifyCompanyKind({ companyName: name })).toBe("recruitment_firm");
    });
  }
});

describe("classifyCompanyKind — registry domains", () => {
  it("matches recruiter apply domains", () => {
    expect(
      classifyCompanyKind({
        companyName: "Some Obscure Trading Name",
        urls: ["https://www.hays.co.uk/job/apply/123"],
      }),
    ).toBe("recruitment_firm");
    expect(
      classifyCompanyKind({
        companyName: null,
        urls: [null, "https://jobs.robertwalters.co.uk/x/y"],
      }),
    ).toBe("recruitment_firm");
  });

  it("does not treat reed.co.uk job-board apply URLs as recruiter", () => {
    expect(
      classifyCompanyKind({
        companyName: "Hiscox",
        urls: ["https://www.reed.co.uk/jobs/underwriter/12345"],
      }),
    ).toBe("direct_employer");
  });
});

describe("classifyCompanyKind — name patterns", () => {
  const patternRecruiters = [
    "Massenhove Recruitment Limited",
    "ITOL Recruit",
    "VIQU IT Recruitment",
    "Insight Recruitment Solutions Limited",
    "Carolyn Bowers Insurance Recruitment",
    "Premier Staffing Solutions",
    "Acme Executive Search",
    "Northgate Search & Selection",
  ];
  for (const name of patternRecruiters) {
    it(`classifies "${name}" as recruitment_firm via name pattern`, () => {
      expect(classifyCompanyKind({ companyName: name })).toBe("recruitment_firm");
    });
  }

  it("does not fire inside unrelated words", () => {
    expect(classifyCompanyKind({ companyName: "Recruitex Software" })).toBe(
      "direct_employer",
    );
  });
});

describe("classifyCompanyKind — text signals", () => {
  it("one strong signal classifies as recruiter", () => {
    expect(
      classifyCompanyKind({
        companyName: "Bright Futures Ltd",
        descriptionText:
          "We are working on behalf of our client, a leading Lloyd's syndicate.",
      }),
    ).toBe("recruitment_firm");
  });

  it("two distinct weak signals classify as recruiter", () => {
    expect(
      classifyCompanyKind({
        companyName: "Bright Futures Ltd",
        descriptionText:
          "Our client is a leading insurer. We are recruiting for a Senior Underwriter to join their London team.",
      }),
    ).toBe("recruitment_firm");
  });

  it("a single weak signal is not enough", () => {
    expect(
      classifyCompanyKind({
        companyName: "Hiscox",
        descriptionText:
          "Our client focus means the successful candidate will manage key client relationships.",
      }),
    ).toBe("direct_employer");
  });

  it("hasRecruiterTextSignals matches case-insensitively", () => {
    expect(hasRecruiterTextSignals("ACTING AS AN EMPLOYMENT AGENCY for this role")).toBe(
      true,
    );
    expect(hasRecruiterTextSignals("A great place to work")).toBe(false);
  });
});

describe("classifyCompanyKind — overrides", () => {
  it("force_direct beats the name pattern", () => {
    expect(classifyCompanyKind({ companyName: "Government Recruitment Service" })).toBe(
      "direct_employer",
    );
  });

  it("Reed Smith (law firm) is not the Reed recruitment group", () => {
    expect(classifyCompanyKind({ companyName: "Reed Smith" })).toBe("direct_employer");
    expect(classifyCompanyKind({ companyName: "Reed Smith LLP" })).toBe(
      "direct_employer",
    );
  });

  it("force_recruiter pins edge cases", () => {
    expect(classifyCompanyKind({ companyName: "ITOL Recruit" })).toBe(
      "recruitment_firm",
    );
  });
});

describe("classifyCompanyKind — job boards and fallbacks", () => {
  it("classifies job boards posting as themselves", () => {
    expect(classifyCompanyKind({ companyName: "Reed.co.uk" })).toBe("job_board");
    expect(classifyCompanyKind({ companyName: "eFinancialCareers" })).toBe("job_board");
  });

  it("known direct employers stay direct", () => {
    for (const name of [
      "Hiscox",
      "QBE",
      "Barclays",
      "BlackRock",
      "Microsoft",
      "Wise",
      "OakNorth",
      "Aviva",
    ]) {
      expect(classifyCompanyKind({ companyName: name })).toBe("direct_employer");
    }
  });

  it("missing company name is unknown", () => {
    expect(classifyCompanyKind({ companyName: null })).toBe("unknown");
    expect(classifyCompanyKind({ companyName: "  " })).toBe("unknown");
  });
});
