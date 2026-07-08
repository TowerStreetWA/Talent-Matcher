import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseReedDate, reedProvider, reedSalaryText } from "./reedProvider";

describe("parseReedDate", () => {
  it("parses DD/MM/YYYY", () => {
    expect(parseReedDate("07/07/2026")?.toISOString()).toBe("2026-07-07T00:00:00.000Z");
  });
  it("returns null for junk", () => {
    expect(parseReedDate("not a date")).toBeNull();
    expect(parseReedDate(null)).toBeNull();
  });
});

describe("reedSalaryText", () => {
  it("formats ranges and single values", () => {
    expect(reedSalaryText(65000, 80000, "GBP")).toBe("£65,000 - £80,000");
    expect(reedSalaryText(70000, 70000, "GBP")).toBe("£70,000");
    expect(reedSalaryText(null, 55000, null)).toBe("£55,000");
    expect(reedSalaryText(null, null, "GBP")).toBeNull();
  });
});

describe("reedProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("REED_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function page(results: Array<Record<string, unknown>>, totalResults: number) {
    return { ok: true, status: 200, json: async () => ({ results, totalResults }) };
  }

  function job(id: number, title: string) {
    return {
      jobId: id,
      jobTitle: title,
      employerName: "Acme Insurance",
      locationName: "London",
      minimumSalary: 50000,
      maximumSalary: 60000,
      currency: "GBP",
      date: "01/07/2026",
      jobDescription: "Handle claims",
      jobUrl: `https://www.reed.co.uk/jobs/${id}`,
    };
  }

  it("requires REED_API_KEY", async () => {
    vi.stubEnv("REED_API_KEY", "");
    await expect(
      reedProvider.fetchVacancies({ query: "insurance" }),
    ).rejects.toMatchObject({ kind: "config" });
  });

  it("normalizes results with job_board attribution and sectorTag", async () => {
    fetchMock.mockResolvedValueOnce(page([job(1, "Underwriter")], 1));

    const result = await reedProvider.fetchVacancies({
      query: "insurance",
      location: "London",
      sectorTag: "insurance",
    });

    expect(result.vacancies).toHaveLength(1);
    const v = result.vacancies[0]!;
    expect(v.sourceType).toBe("job_board");
    expect(v.sourceProvider).toBe("reed_api");
    expect(v.sourceUrl).toBe("https://www.reed.co.uk/jobs/1");
    expect(v.salaryText).toBe("£50,000 - £60,000");
    expect(v.postedAt?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(v.sectorTag).toBe("insurance");
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("locationName=London");
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Basic /);
  });

  it("paginates with resultsToSkip and stops at maxResults", async () => {
    fetchMock
      .mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, i) => job(i, `R${i}`)), 150))
      .mockResolvedValueOnce(page(Array.from({ length: 50 }, (_, i) => job(100 + i, `R${100 + i}`)), 150));

    const result = await reedProvider.fetchVacancies({ query: "banking", maxResults: 120 });

    expect(result.vacancies).toHaveLength(120);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("resultsToSkip=100");
  });

  it("stops when totalResults is exhausted", async () => {
    fetchMock.mockResolvedValueOnce(page([job(1, "Only")], 1));
    const result = await reedProvider.fetchVacancies({ query: "pensions", maxResults: 50 });
    expect(result.vacancies).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("warns on titleless results and maps auth failures to config errors", async () => {
    fetchMock.mockResolvedValueOnce(page([{ jobId: 9 }, job(2, "Real")], 2));
    const result = await reedProvider.fetchVacancies({ query: "insurance" });
    expect(result.vacancies.map((v) => v.title)).toEqual(["Real"]);
    expect(result.warnings).toHaveLength(1);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    await expect(reedProvider.fetchVacancies({ query: "x y" })).rejects.toMatchObject({
      kind: "config",
    });
  });
});
