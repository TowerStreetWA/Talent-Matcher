import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adzunaProvider, adzunaSalaryText, stripAdzunaMarkup } from "./adzunaProvider";
import {
  boardPatternsFor,
  resolveBoardPatternCap,
  DEFAULT_BOARD_PATTERN_MAX_RESULTS,
  BOARD_PATTERN_MAX_RESULTS_CEILING,
} from "../../config/jobBoardPatterns";

describe("stripAdzunaMarkup / adzunaSalaryText", () => {
  it("strips <strong> highlight markup", () => {
    expect(stripAdzunaMarkup("Senior <strong>Underwriter</strong>")).toBe("Senior Underwriter");
    expect(stripAdzunaMarkup(null)).toBeNull();
  });

  it("formats salary ranges", () => {
    expect(adzunaSalaryText(50000, 60000)).toBe("£50,000 - £60,000");
    expect(adzunaSalaryText(55000.4, 55000.4)).toBe("£55,000");
    expect(adzunaSalaryText(null, null)).toBeNull();
  });
});

describe("jobBoardPatterns config", () => {
  it("has unique names and valid caps per provider", () => {
    for (const provider of ["reed", "adzuna"] as const) {
      const patterns = boardPatternsFor(provider);
      expect(patterns.length).toBeGreaterThan(0);
      expect(new Set(patterns.map((p) => p.name)).size).toBe(patterns.length);
      for (const p of patterns) {
        expect(p.name.startsWith(`${provider}_`)).toBe(true);
        const cap = resolveBoardPatternCap(p);
        expect(cap).toBeGreaterThanOrEqual(1);
        expect(cap).toBeLessThanOrEqual(BOARD_PATTERN_MAX_RESULTS_CEILING);
      }
    }
  });

  it("defaults and clamps caps", () => {
    const base = { name: "x", keywords: "y", location: "z", sectorTag: "insurance" as const };
    expect(resolveBoardPatternCap(base)).toBe(DEFAULT_BOARD_PATTERN_MAX_RESULTS);
    expect(resolveBoardPatternCap({ ...base, maxResults: 10_000 })).toBe(
      BOARD_PATTERN_MAX_RESULTS_CEILING,
    );
  });
});

describe("adzunaProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("ADZUNA_APP_ID", "test-id");
    vi.stubEnv("ADZUNA_APP_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function page(results: Array<Record<string, unknown>>, count: number) {
    return { ok: true, status: 200, json: async () => ({ results, count }) };
  }

  function job(id: number, title: string) {
    return {
      id: String(id),
      title,
      company: { display_name: "Acme Bank" },
      location: { display_name: "London, UK" },
      description: "Do <strong>banking</strong> things",
      redirect_url: `https://www.adzuna.co.uk/jobs/details/${id}`,
      created: "2026-07-01T00:00:00Z",
      salary_min: 60000,
      salary_max: 70000,
      contract_time: "full_time",
    };
  }

  it("requires both Adzuna credentials", async () => {
    vi.stubEnv("ADZUNA_APP_KEY", "");
    await expect(
      adzunaProvider.fetchVacancies({ query: "banking" }),
    ).rejects.toMatchObject({ kind: "config" });
  });

  it("normalizes results with job_board attribution and cleans markup", async () => {
    fetchMock.mockResolvedValueOnce(page([job(1, "Risk <strong>Analyst</strong>")], 1));

    const result = await adzunaProvider.fetchVacancies({
      query: "banking",
      location: "London",
      sectorTag: "banking",
    });

    expect(result.vacancies).toHaveLength(1);
    const v = result.vacancies[0]!;
    expect(v.title).toBe("Risk Analyst");
    expect(v.sourceType).toBe("job_board");
    expect(v.sourceProvider).toBe("adzuna_api");
    expect(v.salaryText).toBe("£60,000 - £70,000");
    expect(v.employmentType).toBe("Full-time");
    expect(v.descriptionText).toBe("Do banking things");
    expect(v.sectorTag).toBe("banking");
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/jobs/gb/search/1?");
    expect(url).toContain("where=London");
  });

  it("paginates by page path segment and respects maxResults", async () => {
    fetchMock
      .mockResolvedValueOnce(page(Array.from({ length: 50 }, (_, i) => job(i, `A${i}`)), 120))
      .mockResolvedValueOnce(page(Array.from({ length: 50 }, (_, i) => job(50 + i, `B${i}`)), 120));

    const result = await adzunaProvider.fetchVacancies({ query: "fintech", maxResults: 60 });

    expect(result.vacancies).toHaveLength(60);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/jobs/gb/search/2?");
  });

  it("stops when count is exhausted and warns on titleless results", async () => {
    fetchMock.mockResolvedValueOnce(page([{ id: "9" }, job(2, "Real")], 2));
    const result = await adzunaProvider.fetchVacancies({ query: "pensions", maxResults: 50 });
    expect(result.vacancies.map((v) => v.title)).toEqual(["Real"]);
    expect(result.warnings).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
