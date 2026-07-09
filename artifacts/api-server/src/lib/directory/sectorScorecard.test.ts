import { describe, expect, it } from "vitest";
import type { CareersDirectoryConfig, CareersDirectoryEmployer } from "./engine";
import type { BoardResolution } from "./resolveCareersBoard";
import type { IngestionPathRecord } from "./ingestionPathRegistry";
import {
  bestNextGain,
  buildIndustryScorecard,
  collectEmployerSignals,
  countEmployerSignals,
  coverageStatus,
  type EmployerSignals,
} from "./sectorScorecard";

function employer(over: Partial<CareersDirectoryEmployer> = {}): CareersDirectoryEmployer {
  return {
    name: over.name ?? "Acme",
    careersUrl: over.careersUrl ?? "https://acme.com/careers",
    segment: over.segment ?? "seg_a",
    platformHint: over.platformHint ?? "careers_page",
    sectorTag: over.sectorTag ?? "banking",
  };
}

function resolution(over: Partial<BoardResolution> = {}): BoardResolution {
  return {
    outcome: over.outcome ?? "no_board_detected",
    entry: over.entry ?? null,
    boardUrl: over.boardUrl ?? null,
    finalUrl: over.finalUrl ?? null,
    unsupportedAts: over.unsupportedAts ?? null,
    checkedAt: over.checkedAt ?? new Date(),
  };
}

function ingestion(over: Partial<IngestionPathRecord> = {}): IngestionPathRecord {
  return {
    path: over.path !== undefined ? over.path : "basic_html",
    outcome: over.outcome ?? "jobs_found",
    jobs: over.jobs ?? 3,
    detail: over.detail ?? null,
    checkedAt: over.checkedAt ?? new Date(),
  };
}

function signal(over: Partial<EmployerSignals> = {}): EmployerSignals {
  return {
    employer: over.employer ?? employer(),
    resolution: over.resolution ?? null,
    ingestion: over.ingestion ?? null,
    hasActiveJobs: over.hasActiveJobs ?? false,
  };
}

describe("countEmployerSignals", () => {
  it("classifies employers by detection path with ATS taking precedence", () => {
    const counters = countEmployerSignals([
      // ATS via platform hint (no cache entries at all)
      signal({ employer: employer({ platformHint: "greenhouse" }), hasActiveJobs: true }),
      // ATS via resolved board entry
      signal({
        resolution: resolution({
          outcome: "board_link_in_html",
          entry: {
            company: "A",
            platform: "lever",
            token: "a",
            maxJobs: 40,
            sectorTag: null,
          },
        }),
        hasActiveJobs: true,
      }),
      // basic HTML path
      signal({ ingestion: ingestion({ path: "basic_html", outcome: "jobs_found" }) }),
      // firecrawl path
      signal({ ingestion: ingestion({ path: "firecrawl", outcome: "jobs_found" }) }),
      // JS-heavy, blocked on Firecrawl
      signal({ ingestion: ingestion({ path: null, outcome: "needs_firecrawl", jobs: 0 }) }),
      // unsupported ATS from resolution
      signal({
        resolution: resolution({ outcome: "unsupported_ats", unsupportedAts: "taleo" }),
      }),
      // completely cold (no signals)
      signal({}),
    ]);

    expect(counters.seeded_employers).toBe(7);
    expect(counters.ats_resolved_employers).toBe(2);
    expect(counters.basic_html_employers).toBe(1);
    expect(counters.firecrawl_employers).toBe(1);
    expect(counters.needs_firecrawl_employers).toBe(1);
    expect(counters.unsupported_ats_employers).toBe(1);
    expect(counters.actively_posting_employers).toBe(2);
    expect(counters.zero_job_employers).toBe(5);
    // reached: resolved board + basic_html + firecrawl + needs_firecrawl + unsupported = 5
    expect(counters.careers_page_detected).toBe(5);
  });

  it("does not count fetch failures or cold caches as detected careers pages", () => {
    const counters = countEmployerSignals([
      signal({ resolution: resolution({ outcome: "fetch_failed" }) }),
      signal({ resolution: resolution({ outcome: "blocked_url" }) }),
      signal({ ingestion: ingestion({ path: null, outcome: "fetch_failed", jobs: 0 }) }),
      signal({}),
    ]);
    expect(counters.careers_page_detected).toBe(0);
  });
});

describe("coverageStatus", () => {
  it("healthy needs both job volume and posting breadth", () => {
    expect(
      coverageStatus({ seeded_employers: 100, actively_posting_employers: 30 }, 150),
    ).toBe("healthy");
    // enough jobs, too few posters
    expect(
      coverageStatus({ seeded_employers: 100, actively_posting_employers: 10 }, 150),
    ).toBe("developing");
    // enough posters ratio, too few jobs
    expect(
      coverageStatus({ seeded_employers: 20, actively_posting_employers: 10 }, 60),
    ).toBe("developing");
  });

  it("thin when both jobs and posters are low", () => {
    expect(coverageStatus({ seeded_employers: 40, actively_posting_employers: 2 }, 10)).toBe(
      "thin",
    );
    expect(coverageStatus({ seeded_employers: 0, actively_posting_employers: 0 }, 0)).toBe(
      "thin",
    );
  });

  it("developing on either 25 jobs or 5 posting employers", () => {
    expect(coverageStatus({ seeded_employers: 40, actively_posting_employers: 0 }, 25)).toBe(
      "developing",
    );
    expect(coverageStatus({ seeded_employers: 40, actively_posting_employers: 5 }, 0)).toBe(
      "developing",
    );
  });
});

describe("bestNextGain", () => {
  it("prioritises unsupported ATS, then Firecrawl, then seed size", () => {
    expect(
      bestNextGain({
        seeded_employers: 10,
        unsupported_ats_employers: 3,
        needs_firecrawl_employers: 5,
      }),
    ).toBe("support remaining ATS providers");
    expect(
      bestNextGain({
        seeded_employers: 10,
        unsupported_ats_employers: 2,
        needs_firecrawl_employers: 3,
      }),
    ).toBe("top up Firecrawl for JS-heavy sites");
    expect(
      bestNextGain({
        seeded_employers: 24,
        unsupported_ats_employers: 0,
        needs_firecrawl_employers: 0,
      }),
    ).toBe("expand seed list");
    expect(
      bestNextGain({
        seeded_employers: 25,
        unsupported_ats_employers: 0,
        needs_firecrawl_employers: 0,
      }),
    ).toBe("add more ATS employers");
  });
});

describe("collectEmployerSignals + buildIndustryScorecard", () => {
  const config: CareersDirectoryConfig = {
    key: "test_dir",
    label: "Test Directory",
    industry: "insurance",
    providerPrefix: "test_dir",
    segments: ["seg_a", "seg_b"],
    employers: [
      employer({ name: "Alpha", segment: "seg_a", careersUrl: "https://alpha.com/careers" }),
      employer({
        name: "Beta",
        segment: "seg_b",
        careersUrl: "https://beta.com/careers",
        platformHint: "greenhouse",
      }),
    ],
    unresolved: [],
    sweep: { slots: 24, enabled: true },
  };

  it("uses injected lookups and emits segment detail with per-segment jobs", () => {
    const signals = collectEmployerSignals(config, (e) => e.name === "Beta", {
      resolution: (url) =>
        url.includes("alpha") ? resolution({ outcome: "no_board_detected" }) : null,
      ingestion: () => null,
    });
    const card = buildIndustryScorecard({
      industry: "insurance",
      directories: [{ config, signals }],
      activeCanonicalJobs: 30,
      directEmployerJobs: 12,
      segmentJobs: new Map([
        ["test_dir_seg_a", 4],
        ["test_dir_seg_b", 8],
      ]),
      includeSegments: true,
    });

    expect(card.industry).toBe("insurance");
    expect(card.directories).toEqual(["test_dir"]);
    expect(card.seeded_employers).toBe(2);
    expect(card.actively_posting_employers).toBe(1);
    expect(card.zero_job_employers).toBe(1);
    expect(card.ats_resolved_employers).toBe(1); // Beta via platform hint
    expect(card.careers_page_detected).toBe(1); // Alpha via cached resolution
    expect(card.active_canonical_jobs).toBe(30);
    expect(card.direct_employer_jobs).toBe(12);
    expect(card.coverage_status).toBe("developing");
    expect(card.best_next_gain).toBe("expand seed list");

    expect(card.segments).toHaveLength(2);
    const segA = card.segments!.find((s) => s.segment === "seg_a")!;
    expect(segA.seeded_employers).toBe(1);
    expect(segA.active_jobs).toBe(4);
    expect(segA.zero_job_employers).toBe(1);
    const segB = card.segments!.find((s) => s.segment === "seg_b")!;
    expect(segB.actively_posting_employers).toBe(1);
    expect(segB.active_jobs).toBe(8);
  });

  it("omits segments unless requested", () => {
    const signals = collectEmployerSignals(config, () => false, {
      resolution: () => null,
      ingestion: () => null,
    });
    const card = buildIndustryScorecard({
      industry: "insurance",
      directories: [{ config, signals }],
      activeCanonicalJobs: 0,
      directEmployerJobs: 0,
    });
    expect(card.segments).toBeNull();
    expect(card.coverage_status).toBe("thin");
  });
});
