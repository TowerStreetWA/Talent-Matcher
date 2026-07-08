import { afterEach, describe, expect, it, vi } from "vitest";
import {
  crawlBasicHtmlCareersPage,
  detectJsHeavyHtml,
  extractJobsFromHtml,
} from "./basicHtmlCrawler";

const BASE = "https://example-employer.co.uk/careers";

describe("extractJobsFromHtml", () => {
  it("extracts jobs from a simple list of job links", () => {
    const html = `
      <html><body>
        <h1>Current vacancies</h1>
        <ul class="vacancy-list">
          <li><a href="/careers/jobs/senior-underwriter">Senior Underwriter</a><span class="location">London</span></li>
          <li><a href="/careers/jobs/claims-adjuster-marine">Claims Adjuster - Marine</a><span class="location">Leeds</span></li>
          <li><a href="/careers/jobs/pricing-actuary">Pricing Actuary</a></li>
        </ul>
      </body></html>`;
    const { jobs, evidence } = extractJobsFromHtml(html, BASE);
    expect(jobs.map((j) => j.title)).toEqual([
      "Senior Underwriter",
      "Claims Adjuster - Marine",
      "Pricing Actuary",
    ]);
    expect(jobs[0]?.applyUrl).toBe(
      "https://example-employer.co.uk/careers/jobs/senior-underwriter",
    );
    expect(jobs[0]?.locationText).toBe("London");
    expect(evidence).toContain("html_list_detected");
  });

  it("extracts jobs from card-style markup", () => {
    const html = `
      <html><body>
        <div class="job-card"><a href="/vacancies/101">Compliance Manager</a><div class="job-location">Bristol, UK</div></div>
        <div class="job-card"><a href="/vacancies/102">Finance Business Partner</a><div class="job-location">Remote</div></div>
      </body></html>`;
    const { jobs, evidence } = extractJobsFromHtml(html, BASE);
    expect(jobs.map((j) => j.title)).toEqual([
      "Compliance Manager",
      "Finance Business Partner",
    ]);
    expect(jobs[1]?.locationText).toBe("Remote");
    expect(evidence.length).toBeGreaterThan(0);
  });

  it("extracts jobs from a Title/Location table", () => {
    const html = `
      <html><body>
        <table>
          <tr><th>Job title</th><th>Location</th><th>Closing date</th></tr>
          <tr><td><a href="/roles/1">Head of Pensions Administration</a></td><td>Manchester</td><td>30 Jul</td></tr>
          <tr><td><a href="/roles/2">Investment Analyst</a></td><td>Edinburgh</td><td>02 Aug</td></tr>
        </table>
      </body></html>`;
    const { jobs, evidence } = extractJobsFromHtml(html, BASE);
    expect(evidence).toContain("html_table_detected");
    expect(jobs.map((j) => j.title)).toEqual([
      "Head of Pensions Administration",
      "Investment Analyst",
    ]);
    expect(jobs[0]?.locationText).toBe("Manchester");
    expect(jobs[1]?.locationText).toBe("Edinburgh");
  });

  it("ignores navigation, generic links and self links", () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="/careers">Careers</a></li>
          <li><a href="/careers/jobs">View all jobs</a></li>
          <li><a href="/careers/benefits">Benefits</a></li>
          <li><a href="/about">Learn more</a></li>
          <li><a href="/careers/early-careers">Early careers</a></li>
        </ul>
      </body></html>`;
    const { jobs } = extractJobsFromHtml(html, BASE);
    expect(jobs).toEqual([]);
  });

  it("rejects careers landing-page marketing links", () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="/careers/explore-ai">Explore AI &amp; Careers</a></li>
          <li><a href="/careers/training">Training and development</a></li>
          <li><a href="/careers/reward">Reward and benefits</a></li>
          <li><a href="/careers/stories">Our people. Their stories</a></li>
          <li><a href="/careers/entry">Entry level</a></li>
          <li><a href="/careers/experienced">Experienced careers</a></li>
          <li><a href="/careers/start">Start your career</a></li>
          <li><a href="/careers/wellbeing">Wellbeing at PwC</a></li>
          <li><a href="/careers/jobs/underwriting-manager">Underwriting Manager</a></li>
        </ul>
      </body></html>`;
    const { jobs } = extractJobsFromHtml(html, BASE);
    expect(jobs.map((j) => j.title)).toEqual(["Underwriting Manager"]);
  });

  it("strips posted-date suffixes and prefers title elements inside card anchors", () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="/careers/jobs/1">Tax Technician / Posted today</a></li>
          <li><a href="/careers/jobs/2"><span class="job-title">Audit Director</span><span class="meta">Milton Keynes / Posted 1 day ago</span></a></li>
        </ul>
      </body></html>`;
    const { jobs } = extractJobsFromHtml(html, BASE);
    expect(jobs.map((j) => j.title)).toEqual(["Tax Technician", "Audit Director"]);
  });

  it("rejects section/nav links lacking a role signal and cookie-policy links", () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="/careers/jobs/audit">Audit</a></li>
          <li><a href="/careers/jobs/consulting">Consulting</a></li>
          <li><a href="/careers/jobs/technology">Technology</a></li>
          <li><a href="/careers/jobs/deals">Deals</a></li>
          <li><a href="/careers/jobs/cookie-policy">Cookie Policy</a></li>
          <li><a href="/careers/jobs/graduates">Graduates</a></li>
          <li><a href="/careers/jobs/tax-manager">Tax Manager</a></li>
        </ul>
      </body></html>`;
    const { jobs } = extractJobsFromHtml(html, BASE);
    expect(jobs.map((j) => j.title)).toEqual(["Tax Manager"]);
  });

  it("does not glue title and location text from multi-element anchors", () => {
    const html = `
      <html><body>
        <div class="job-listing">
          <a href="/careers/jobs/101"><div>Data Analyst II</div><div>Riga, Latvia</div></a>
        </div>
        <div class="job-listing">
          <a href="/careers/jobs/102"><span>Senior Underwriter</span><span class="badge">New</span><span class="location">London, UK</span></a>
        </div>
      </body></html>`;
    const { jobs } = extractJobsFromHtml(html, BASE);
    expect(jobs.map((j) => j.title)).toEqual(["Data Analyst II", "Senior Underwriter"]);
    expect(jobs[1]?.locationText).toBe("London, UK");
  });

  it("does not glue title and location in Greenhouse-style table embeds", () => {
    const html = `
      <html><body>
        <table>
          <thead><tr><th scope="col"><p>Job</p></th></tr></thead>
          <tbody>
            <tr class="job-post"><td class="cell">
              <a href="https://job-boards.greenhouse.io/acme/jobs/1"><p class="body">Data Analyst II</p><p class="body--metadata">Riga, Latvia</p></a>
            </td></tr>
            <tr class="job-post"><td class="cell">
              <a href="https://job-boards.greenhouse.io/acme/jobs/2"><p class="body">Compliance Senior Manager</p><p class="body--metadata">London, UK</p></a>
            </td></tr>
          </tbody>
        </table>
      </body></html>`;
    const { jobs } = extractJobsFromHtml(html, BASE);
    expect(jobs.map((j) => j.title)).toEqual(["Data Analyst II", "Compliance Senior Manager"]);
    expect(jobs.map((j) => j.locationText)).toEqual(["Riga, Latvia", "London, UK"]);
  });

  it("dedupes repeated links and respects maxJobs", () => {
    const items = Array.from(
      { length: 60 },
      (_, i) => `<li><a href="/jobs/${i}">Analyst Role Number ${i}</a></li>`,
    ).join("");
    const html = `<ul>${items}${items}</ul>`;
    const { jobs } = extractJobsFromHtml(html, BASE, { maxJobs: 40 });
    expect(jobs.length).toBe(40);
    const urls = new Set(jobs.map((j) => j.applyUrl));
    expect(urls.size).toBe(40);
  });

  it("resolves relative and absolute hrefs, rejecting non-http schemes", () => {
    const html = `
      <ul>
        <li><a href="https://boards.example.com/jobs/999">Group Financial Controller</a></li>
        <li><a href="javascript:void(0)">Broker Support Technician</a></li>
        <li><a href="mailto:jobs@example.com">Underwriting Assistant (Lloyd's)</a></li>
      </ul>`;
    const { jobs } = extractJobsFromHtml(html, BASE);
    expect(jobs.map((j) => j.applyUrl)).toEqual(["https://boards.example.com/jobs/999"]);
  });
});

describe("detectJsHeavyHtml", () => {
  it("flags SPA shells with framework markers and no static content", () => {
    const html = `
      <html><body>
        <div id="root"></div>
        <script>window.__INITIAL_STATE__={}</script>
        <script src="/static/js/main.8f3a.js"></script>
      </body></html>`;
    expect(detectJsHeavyHtml(html)).toBe(true);
  });

  it("flags effectively empty documents", () => {
    expect(detectJsHeavyHtml("<html><body></body></html>")).toBe(true);
    expect(detectJsHeavyHtml("")).toBe(true);
  });

  it("does not flag content-rich static pages", () => {
    const paragraphs = Array.from(
      { length: 12 },
      (_, i) => `<p>We are a specialist insurer with offices across the UK ${i}.</p>`,
    ).join("");
    const links = Array.from({ length: 10 }, (_, i) => `<a href="/p${i}">Page ${i}</a>`).join("");
    const html = `<html><body><div id="root">${paragraphs}${links}</div></body></html>`;
    expect(detectJsHeavyHtml(html)).toBe(false);
  });
});

describe("crawlBasicHtmlCareersPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks internal/private URLs via the shared SSRF guard (no fetch made)", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    for (const url of [
      "http://localhost/careers",
      "http://127.0.0.1/careers",
      "http://169.254.169.254/latest/meta-data",
      "http://10.0.0.5/careers",
      "ftp://example.com/careers",
    ]) {
      const result = await crawlBasicHtmlCareersPage(url);
      expect(result.outcome).toBe("blocked_url");
      expect(result.jobs).toEqual([]);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns html_jobs_found for a static page with listings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `<html><body><ul>
            <li><a href="/careers/jobs/1">Senior Claims Handler</a></li>
            <li><a href="/careers/jobs/2">Reinsurance Analyst</a></li>
          </ul></body></html>`,
          { status: 200, headers: { "content-type": "text/html" } },
        ),
      ),
    );
    const result = await crawlBasicHtmlCareersPage("https://static-employer.example.com/careers");
    expect(result.outcome).toBe("html_jobs_found");
    expect(result.activePosting).toBe(true);
    expect(result.jobs.map((j) => j.title)).toEqual([
      "Senior Claims Handler",
      "Reinsurance Analyst",
    ]);
  });

  it("returns html_no_jobs with jsHeavy=true for an SPA shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `<html><body><div id="root"></div><script>window.__INITIAL_STATE__={}</script></body></html>`,
          { status: 200, headers: { "content-type": "text/html" } },
        ),
      ),
    );
    const result = await crawlBasicHtmlCareersPage("https://spa-employer.example.com/careers");
    expect(result.outcome).toBe("html_no_jobs");
    expect(result.jsHeavy).toBe(true);
    expect(result.jobs).toEqual([]);
  });

  it("returns fetch_failed on network errors and non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 404 })));
    const notFound = await crawlBasicHtmlCareersPage("https://gone.example.com/careers");
    expect(notFound.outcome).toBe("fetch_failed");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const refused = await crawlBasicHtmlCareersPage("https://down.example.com/careers");
    expect(refused.outcome).toBe("fetch_failed");
  });
});
