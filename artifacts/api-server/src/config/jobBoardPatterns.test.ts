import { describe, expect, it } from "vitest";
import {
  ADZUNA_PATTERNS,
  BOARD_PATTERN_MAX_RESULTS_CEILING,
  REED_PATTERNS,
  resolveBoardPatternCap,
} from "./jobBoardPatterns";
import { ATS_EMPLOYERS, resolveAtsMaxJobs } from "./atsEmployers";

describe("jobBoardPatterns config", () => {
  it("has globally unique pattern names", () => {
    const names = [...REED_PATTERNS, ...ADZUNA_PATTERNS].map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every pattern resolves to a cap within the safety ceiling", () => {
    for (const p of [...REED_PATTERNS, ...ADZUNA_PATTERNS]) {
      const cap = resolveBoardPatternCap(p);
      expect(cap).toBeGreaterThanOrEqual(1);
      expect(cap).toBeLessThanOrEqual(BOARD_PATTERN_MAX_RESULTS_CEILING);
      expect(p.keywords.trim().length).toBeGreaterThan(0);
      expect(p.location.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes underwriting-focused insurance patterns on both boards", () => {
    for (const patterns of [REED_PATTERNS, ADZUNA_PATTERNS]) {
      const underwriting = patterns.filter(
        (p) => p.keywords.includes("underwriter") && p.sectorTag === "insurance",
      );
      expect(underwriting.length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("atsEmployers config", () => {
  it("has unique (platform, token) pairs", () => {
    const keys = ATS_EMPLOYERS.map((e) => `${e.platform}:${e.token}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("workday entries declare instance and site; caps stay within 100", () => {
    for (const e of ATS_EMPLOYERS) {
      if (e.platform === "workday") {
        expect(e.workdayInstance, `${e.company} missing workdayInstance`).toBeTruthy();
        expect(e.workdaySite, `${e.company} missing workdaySite`).toBeTruthy();
      }
      const cap = resolveAtsMaxJobs(e);
      expect(cap).toBeGreaterThanOrEqual(1);
      expect(cap).toBeLessThanOrEqual(100);
    }
  });
});
