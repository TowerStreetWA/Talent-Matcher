import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFirecrawlNoCreditsFlag, firecrawlUnavailability } from "../firecrawl";
import { clearIngestionPathRegistry, ingestionPathRecord } from "./ingestionPathRegistry";
import { makeDirectoryEmployerProvider, type CareersDirectoryConfig } from "./engine";

/**
 * Routing tests for the directory engine: ATS → basic HTML crawler →
 * Firecrawl. Global fetch is stubbed so no real network calls are made.
 * Note: resolveCareersBoard has a per-URL 24h in-process cache — every test
 * uses a distinct careers URL to avoid cross-test cache hits.
 */

const directory: CareersDirectoryConfig = {
  key: "test_dir",
  label: "Test Directory",
  industry: "insurance",
  providerPrefix: "test_dir",
  segments: ["seg"],
  sweep: { slots: 4, enabled: false },
  employers: [],
  unresolved: [],
};

function employerFor(url: string) {
  return {
    name: "Test Employer",
    segment: "seg",
    careersUrl: url,
    platformHint: "careers_page" as const,
    sectorTag: "insurance",
  };
}

const STATIC_JOBS_HTML = `<html><body><ul>
  <li><a href="/careers/jobs/1">Senior Underwriter</a></li>
  <li><a href="/careers/jobs/2">Claims Handler</a></li>
</ul></body></html>`;

const STATIC_EMPTY_HTML = `<html><body>
  ${Array.from({ length: 10 }, (_, i) => `<p>We hire great people all year round ${i}.</p>`).join("")}
  ${Array.from({ length: 8 }, (_, i) => `<a href="/page${i}">About section ${i}</a>`).join("")}
  <p>There are currently no open positions.</p>
</body></html>`;

const SPA_SHELL_HTML = `<html><body><div id="root"></div>
  <script>window.__INITIAL_STATE__={}</script></body></html>`;

function stubHtml(html: string): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("directory engine routing", () => {
  beforeEach(() => {
    clearIngestionPathRegistry();
    clearFirecrawlNoCreditsFlag();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["FIRECRAWL_DISABLED"];
  });

  it("uses the basic HTML crawler for a static page with listings (no Firecrawl)", async () => {
    const url = "https://routing-static.example.com/careers";
    const fetchSpy = stubHtml(STATIC_JOBS_HTML);
    const provider = makeDirectoryEmployerProvider(directory, employerFor(url));
    const result = await provider.fetchVacancies({});

    expect(result.vacancies.map((v) => v.title)).toEqual([
      "Senior Underwriter",
      "Claims Handler",
    ]);
    expect(result.vacancies[0]?.sourceProvider).toBe("test_dir_seg");
    expect(result.vacancies[0]?.sourceType).toBe("direct_employer");
    expect(result.vacancies[0]?.sectorTag).toBe("insurance");
    // Only the careers page was fetched — never api.firecrawl.dev.
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).not.toContain("firecrawl");
    }
    expect(ingestionPathRecord(url)).toMatchObject({
      path: "basic_html",
      outcome: "jobs_found",
      jobs: 2,
    });
  });

  it("skips Firecrawl for a static page that genuinely lists no vacancies", async () => {
    const url = "https://routing-empty.example.com/careers";
    const fetchSpy = stubHtml(STATIC_EMPTY_HTML);
    const provider = makeDirectoryEmployerProvider(directory, employerFor(url));
    const result = await provider.fetchVacancies({});

    expect(result.vacancies).toEqual([]);
    expect(result.warnings.some((w) => w.includes("no vacancies"))).toBe(true);
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).not.toContain("firecrawl");
    }
    expect(ingestionPathRecord(url)).toMatchObject({
      path: "basic_html",
      outcome: "html_no_jobs",
    });
  });

  it("marks needs_firecrawl for a JS-heavy page when Firecrawl is unavailable", async () => {
    process.env["FIRECRAWL_DISABLED"] = "true";
    const url = "https://routing-spa.example.com/careers";
    const fetchSpy = stubHtml(SPA_SHELL_HTML);
    const provider = makeDirectoryEmployerProvider(directory, employerFor(url));
    const result = await provider.fetchVacancies({});

    expect(result.vacancies).toEqual([]);
    expect(result.warnings.some((w) => w.includes("needs Firecrawl"))).toBe(true);
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).not.toContain("firecrawl");
    }
    expect(ingestionPathRecord(url)).toMatchObject({
      path: null,
      outcome: "needs_firecrawl",
      detail: "disabled",
    });
  });

  it("trips the no-credits breaker on the first Firecrawl credit failure and skips Firecrawl afterwards", async () => {
    const prevKey = process.env["FIRECRAWL_API_KEY"];
    process.env["FIRECRAWL_API_KEY"] = "test-key";
    try {
      const firstUrl = "https://routing-credits-a.example.com/careers";
      const secondUrl = "https://routing-credits-b.example.com/careers";
      const fetchSpy = vi.fn(async (input: string | URL | Request) => {
        const target = String(input);
        if (target.includes("firecrawl")) {
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "Insufficient credits to perform this request. For more credits, upgrade your plan.",
            }),
            { status: 402, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(SPA_SHELL_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      });
      vi.stubGlobal("fetch", fetchSpy);

      // First employer: Firecrawl is attempted, fails on credits, breaker trips.
      const first = makeDirectoryEmployerProvider(directory, employerFor(firstUrl));
      await expect(first.fetchVacancies({})).rejects.toThrow(/insufficient credits/i);
      expect(firecrawlUnavailability()).toMatchObject({ reason: "no_credits" });
      expect(ingestionPathRecord(firstUrl)).toMatchObject({
        path: "firecrawl",
        outcome: "needs_firecrawl",
      });
      const firecrawlCallsAfterFirst = fetchSpy.mock.calls.filter((c) =>
        String(c[0]).includes("firecrawl"),
      ).length;
      expect(firecrawlCallsAfterFirst).toBeGreaterThan(0);

      // Second employer: breaker is open — needs_firecrawl without any Firecrawl call.
      const second = makeDirectoryEmployerProvider(directory, employerFor(secondUrl));
      const result = await second.fetchVacancies({});
      expect(result.vacancies).toEqual([]);
      expect(result.warnings.some((w) => w.includes("needs Firecrawl"))).toBe(true);
      expect(ingestionPathRecord(secondUrl)).toMatchObject({
        path: null,
        outcome: "needs_firecrawl",
        detail: "no_credits",
      });
      const firecrawlCallsAfterSecond = fetchSpy.mock.calls.filter((c) =>
        String(c[0]).includes("firecrawl"),
      ).length;
      expect(firecrawlCallsAfterSecond).toBe(firecrawlCallsAfterFirst);
    } finally {
      if (prevKey === undefined) delete process.env["FIRECRAWL_API_KEY"];
      else process.env["FIRECRAWL_API_KEY"] = prevKey;
      clearFirecrawlNoCreditsFlag();
    }
  });

  it("records blocked_url for SSRF-blocked careers URLs", async () => {
    const url = "http://169.254.169.254/careers";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const provider = makeDirectoryEmployerProvider(directory, employerFor(url));
    const result = await provider.fetchVacancies({});

    expect(result.vacancies).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ingestionPathRecord(url)).toMatchObject({ outcome: "blocked_url" });
  });
});

describe("firecrawl availability circuit breaker", () => {
  afterEach(() => {
    clearFirecrawlNoCreditsFlag();
    delete process.env["FIRECRAWL_DISABLED"];
  });

  it("reports disabled when FIRECRAWL_DISABLED=true", () => {
    process.env["FIRECRAWL_DISABLED"] = "true";
    expect(firecrawlUnavailability()).toMatchObject({ reason: "disabled" });
  });

  it("is available by default when a key is configured", () => {
    if (!process.env["FIRECRAWL_API_KEY"]) {
      expect(firecrawlUnavailability()).toMatchObject({ reason: "not_configured" });
    } else {
      expect(firecrawlUnavailability()).toBeNull();
    }
  });
});
