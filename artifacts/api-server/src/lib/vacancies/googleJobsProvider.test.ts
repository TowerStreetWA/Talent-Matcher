import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  googleJobsProvider,
  hasLinkedInApplyOption,
  LINKEDIN_VIA_GOOGLE_PROVIDER,
} from "./googleJobsProvider";
import {
  DEFAULT_PATTERN_MAX_RESULTS,
  PATTERN_MAX_RESULTS_CEILING,
  resolvePatternCap,
} from "../../config/ingestionPatterns";

describe("hasLinkedInApplyOption", () => {
  it("detects linkedin.com apply links (incl. subdomains)", () => {
    expect(hasLinkedInApplyOption([{ link: "https://www.linkedin.com/jobs/view/123" }])).toBe(true);
    expect(hasLinkedInApplyOption([{ link: "https://uk.linkedin.com/jobs/view/9" }])).toBe(true);
  });

  it("rejects non-LinkedIn hosts and lookalikes", () => {
    expect(hasLinkedInApplyOption([{ link: "https://indeed.com/x" }])).toBe(false);
    expect(hasLinkedInApplyOption([{ link: "https://notlinkedin.com/x" }])).toBe(false);
    expect(hasLinkedInApplyOption([{ link: "https://linkedin.com.evil.io/x" }])).toBe(false);
  });

  it("handles empty/malformed input", () => {
    expect(hasLinkedInApplyOption(undefined)).toBe(false);
    expect(hasLinkedInApplyOption([])).toBe(false);
    expect(hasLinkedInApplyOption([{ link: "not a url" }, { link: null }])).toBe(false);
  });
});

describe("resolvePatternCap", () => {
  const base = {
    name: "x",
    keywords: "y",
    location: "z",
    sectorTag: "insurance" as const,
  };

  it("defaults and clamps to the ceiling", () => {
    expect(resolvePatternCap(base)).toBe(DEFAULT_PATTERN_MAX_RESULTS);
    expect(resolvePatternCap({ ...base, maxResults: 10_000 })).toBe(PATTERN_MAX_RESULTS_CEILING);
    expect(resolvePatternCap({ ...base, maxResults: 0 })).toBe(1);
  });
});

describe("googleJobsProvider pagination + attribution", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function page(jobs: Array<Record<string, unknown>>, nextToken?: string) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        jobs_results: jobs,
        serpapi_pagination: nextToken ? { next_page_token: nextToken } : {},
      }),
    };
  }

  function job(title: string, applyLink?: string) {
    return {
      title,
      company_name: "Acme",
      location: "London, UK",
      apply_options: applyLink ? [{ title: "Apply", link: applyLink }] : [],
    };
  }

  it("follows next_page_token until maxResults is reached", async () => {
    fetchMock
      .mockResolvedValueOnce(page([job("A1"), job("A2")], "tok-2"))
      .mockResolvedValueOnce(page([job("B1"), job("B2")], "tok-3"))
      .mockResolvedValueOnce(page([job("C1"), job("C2")]));

    const result = await googleJobsProvider.fetchVacancies({
      query: "insurance jobs",
      location: "London, United Kingdom",
      maxResults: 3,
    });

    expect(result.vacancies.map((v) => v.title)).toEqual(["A1", "A2", "B1"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = String(fetchMock.mock.calls[1]?.[0]);
    expect(secondUrl).toContain("next_page_token=tok-2");
  });

  it("stops when no next_page_token remains", async () => {
    fetchMock.mockResolvedValueOnce(page([job("Only")]));
    const result = await googleJobsProvider.fetchVacancies({
      query: "pensions jobs",
      maxResults: 50,
    });
    expect(result.vacancies).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("attributes LinkedIn-hosted results to the LinkedIn provider and stamps sectorTag", async () => {
    fetchMock.mockResolvedValueOnce(
      page([
        job("Underwriter", "https://uk.linkedin.com/jobs/view/1"),
        job("Claims Handler", "https://careers.acme.com/jobs/2"),
      ]),
    );

    const result = await googleJobsProvider.fetchVacancies({
      query: "insurance jobs",
      sectorTag: "insurance",
      maxResults: 10,
    });

    expect(result.vacancies[0]?.sourceProvider).toBe(LINKEDIN_VIA_GOOGLE_PROVIDER);
    expect(result.vacancies[0]?.sourceType).toBe("google_jobs");
    expect(result.vacancies[1]?.sourceProvider).toBe("google_jobs_serpapi");
    expect(result.vacancies.every((v) => v.sectorTag === "insurance")).toBe(true);
  });
});
