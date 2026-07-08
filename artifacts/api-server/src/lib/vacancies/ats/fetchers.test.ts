import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAtsProvider, atsProviderKey, ATS_PLATFORMS } from "./index";
import {
  matchesLocationFilter,
  parseDateLoose,
  parseWorkdayPostedOn,
  stripHtml,
} from "./support";

describe("ats support helpers", () => {
  it("parses assorted timestamp formats", () => {
    expect(parseDateLoose(1777550450684)?.getTime()).toBe(1777550450684);
    expect(parseDateLoose("2025-12-21 10:19:52 UTC")?.toISOString()).toBe(
      "2025-12-21T10:19:52.000Z",
    );
    expect(parseDateLoose("2025-10-31T10:09:47.898+00:00")).not.toBeNull();
    expect(parseDateLoose("not a date")).toBeNull();
    expect(parseDateLoose(null)).toBeNull();
  });

  it("parses Workday relative postedOn strings", () => {
    const now = new Date("2026-07-08T12:00:00Z");
    expect(parseWorkdayPostedOn("Posted Today", now)?.toISOString()).toBe(now.toISOString());
    expect(parseWorkdayPostedOn("Posted Yesterday", now)?.toISOString()).toBe(
      "2026-07-07T12:00:00.000Z",
    );
    expect(parseWorkdayPostedOn("Posted 3 Days Ago", now)?.toISOString()).toBe(
      "2026-07-05T12:00:00.000Z",
    );
    expect(parseWorkdayPostedOn("Posted 30+ Days Ago", now)).not.toBeNull();
    expect(parseWorkdayPostedOn(null)).toBeNull();
  });

  it("strips HTML and decodes entities", () => {
    expect(stripHtml("<p>Hello &amp; <strong>world</strong></p>")).toBe("Hello & world");
    expect(stripHtml("")).toBeNull();
    expect(stripHtml(null)).toBeNull();
  });

  it("matches location filters case-insensitively, requiring a location when set", () => {
    expect(matchesLocationFilter("London, UK", ["london"])).toBe(true);
    expect(matchesLocationFilter("New York", ["london", "uk"])).toBe(false);
    expect(matchesLocationFilter(null, ["london"])).toBe(false);
    expect(matchesLocationFilter(null, undefined)).toBe(true);
    expect(matchesLocationFilter("Anywhere", [])).toBe(true);
  });
});

describe("ats providers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(body: unknown) {
    return { ok: true, status: 200, json: async () => body };
  }

  it("exposes one provider per platform with ats_-prefixed provider keys", () => {
    expect(ATS_PLATFORMS.sort()).toEqual(
      ["ashby", "lever", "recruitee", "smartrecruiters", "teamtailor", "workable", "workday"].sort(),
    );
    for (const platform of ATS_PLATFORMS) {
      const provider = makeAtsProvider(platform);
      expect(provider.sourceType).toBe("direct_employer");
      expect(provider.sourceProvider).toBe(`ats_${platform}`);
      expect(atsProviderKey(platform)).toBe(`ats_${platform}`);
    }
  });

  it("normalizes Lever postings (title, location, url, epoch date)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          text: "Android Engineer",
          createdAt: 1777550450684,
          hostedUrl: "https://jobs.lever.co/zopa/abc",
          applyUrl: "https://jobs.lever.co/zopa/abc/apply",
          workplaceType: "hybrid",
          descriptionPlain: "Build apps",
          categories: { location: "London", commitment: "Employee - Permanent" },
        },
        { createdAt: 1777550450684 }, // no title → warning
      ]),
    );

    const result = await makeAtsProvider("lever").fetchVacancies({ companies: ["Zopa"] });

    expect(result.vacancies).toHaveLength(1);
    const v = result.vacancies[0]!;
    expect(v.title).toBe("Android Engineer");
    expect(v.companyName).toBe("Zopa");
    expect(v.locationText).toBe("London");
    expect(v.remoteType).toBe("hybrid");
    expect(v.employmentType).toBe("Employee - Permanent");
    expect(v.sourceType).toBe("direct_employer");
    expect(v.sourceProvider).toBe("ats_lever");
    expect(v.sourceUrl).toBe("https://jobs.lever.co/zopa/abc");
    expect(v.applyUrl).toBe("https://jobs.lever.co/zopa/abc/apply");
    expect(v.postedAt?.getTime()).toBe(1777550450684);
    expect(v.sectorTag).toBe("banking");
    expect(result.warnings.some((w) => w.includes("without a title"))).toBe(true);
  });

  it("normalizes Ashby jobs and applies the configured location filter", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        jobs: [
          {
            title: "Platform Engineer",
            location: "London",
            employmentType: "FullTime",
            publishedAt: "2026-06-01T00:00:00Z",
            isListed: true,
            isRemote: false,
            workplaceType: "Hybrid",
            jobUrl: "https://jobs.ashbyhq.com/multiverse/1",
            applyUrl: "https://jobs.ashbyhq.com/multiverse/1/application",
            descriptionPlain: "Do platform things",
          },
          {
            title: "US Sales Lead",
            location: "New York",
            isListed: true,
            jobUrl: "https://jobs.ashbyhq.com/multiverse/2",
          },
          { title: "Hidden role", location: "London", isListed: false },
        ],
      }),
    );

    const result = await makeAtsProvider("ashby").fetchVacancies({ companies: ["Multiverse"] });

    expect(result.vacancies.map((v) => v.title)).toEqual(["Platform Engineer"]);
    expect(result.vacancies[0]?.sourceProvider).toBe("ats_ashby");
    expect(result.vacancies[0]?.remoteType).toBe("hybrid");
  });

  it("normalizes Workable widget jobs (city+country location)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        jobs: [
          {
            title: "Claims Handler",
            url: "https://apply.workable.com/j/ABC",
            application_url: "https://apply.workable.com/j/ABC/apply",
            employment_type: "Full-time",
            telecommuting: true,
            published_on: "2026-06-20",
            country: "United Kingdom",
            city: "London",
          },
        ],
      }),
    );

    const result = await makeAtsProvider("workable").fetchVacancies({
      companies: ["Marshmallow"],
    });

    expect(result.vacancies).toHaveLength(1);
    const v = result.vacancies[0]!;
    expect(v.locationText).toBe("London, United Kingdom");
    expect(v.remoteType).toBe("remote");
    expect(v.sourceProvider).toBe("ats_workable");
    expect(v.sectorTag).toBe("insurance");
  });

  it("paginates SmartRecruiters postings and builds job URLs", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        totalFound: 2,
        content: [
          {
            id: "744000133907678",
            name: "Fraud Analyst",
            releasedDate: "2026-06-24T10:00:11.853Z",
            company: { name: "Visa" },
            location: { city: "London", country: "gb", fullLocation: "London, United Kingdom", remote: false },
            typeOfEmployment: { label: "Full-time" },
          },
          {
            id: "99",
            name: "Austin Role",
            location: { city: "Austin", country: "us", fullLocation: "Austin, TX, United States" },
          },
        ],
      }),
    );

    const result = await makeAtsProvider("smartrecruiters").fetchVacancies({
      companies: ["Visa"],
    });

    expect(result.vacancies.map((v) => v.title)).toEqual(["Fraud Analyst"]);
    expect(result.vacancies[0]?.sourceUrl).toBe(
      "https://jobs.smartrecruiters.com/Visa/744000133907678",
    );
    expect(result.vacancies[0]?.sourceProvider).toBe("ats_smartrecruiters");
    expect(fetchMock).toHaveBeenCalledTimes(1); // totalFound reached — no second page
  });

  it("normalizes Recruitee offers and skips unpublished ones", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        offers: [
          {
            title: "Senior Marketer",
            location: "Amsterdam, Noord-Holland, Netherlands",
            careers_url: "https://sendcloud.recruitee.com/o/senior-marketer",
            careers_apply_url: "https://sendcloud.recruitee.com/o/senior-marketer/c/new",
            created_at: "2025-12-21 10:19:52 UTC",
            employment_type_code: "fulltime_permanent",
            remote: false,
            description: "<p>Do <strong>marketing</strong></p>",
            status: "published",
            company_name: "Sendcloud",
          },
          { title: "Draft role", status: "draft" },
        ],
      }),
    );

    const result = await makeAtsProvider("recruitee").fetchVacancies({
      companies: ["Sendcloud"],
    });

    expect(result.vacancies.map((v) => v.title)).toEqual(["Senior Marketer"]);
    const v = result.vacancies[0]!;
    expect(v.descriptionText).toBe("Do marketing");
    expect(v.postedAt?.toISOString()).toBe("2025-12-21T10:19:52.000Z");
    expect(v.sourceProvider).toBe("ats_recruitee");
  });

  it("parses Teamtailor RSS items incl. tt:location names", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:tt="https://teamtailor.com/locations"><channel>
<item>
  <title>Backend Engineer</title>
  <description>&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;</description>
  <pubDate>Tue, 07 Jul 2026 10:29:07 +0200</pubDate>
  <link>https://jobs.lunar.app/jobs/1-backend-engineer</link>
  <remoteStatus>hybrid</remoteStatus>
  <tt:locations><tt:location><tt:name>Copenhagen, Denmark</tt:name></tt:location></tt:locations>
</item>
<item><description>no title</description></item>
</channel></rss>`;
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => xml });

    const result = await makeAtsProvider("teamtailor").fetchVacancies({ companies: ["Lunar"] });

    expect(result.vacancies).toHaveLength(1);
    const v = result.vacancies[0]!;
    expect(v.title).toBe("Backend Engineer");
    expect(v.locationText).toBe("Copenhagen, Denmark");
    expect(v.remoteType).toBe("hybrid");
    expect(v.descriptionText).toBe("Build & ship");
    expect(v.sourceUrl).toBe("https://jobs.lunar.app/jobs/1-backend-engineer");
    expect(v.sourceProvider).toBe("ats_teamtailor");
    expect(result.warnings.some((w) => w.includes("without a title"))).toBe(true);
  });

  it("paginates Workday postings and honors the location filter", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          total: 21,
          jobPostings: Array.from({ length: 20 }, (_, i) => ({
            title: `Role ${i}`,
            externalPath: `/job/London-UK/role-${i}`,
            locationsText: i % 2 === 0 ? "London (UK)" : "Mumbai, India",
            postedOn: "Posted Today",
          })),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total: 21,
          jobPostings: [
            {
              title: "Final Role",
              externalPath: "/job/London-UK/final",
              locationsText: "London (UK)",
              postedOn: "Posted 3 Days Ago",
            },
          ],
        }),
      );

    const result = await makeAtsProvider("workday").fetchVacancies({ companies: ["Aviva"] });

    // Only London rows survive the filter; both pages were fetched.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.vacancies.every((v) => v.locationText === "London (UK)")).toBe(true);
    expect(result.vacancies.at(-1)?.title).toBe("Final Role");
    expect(result.vacancies[0]?.sourceUrl).toMatch(
      /^https:\/\/aviva\.wd1\.myworkdayjobs\.com\/en-US\/External\/job\/London-UK\//,
    );
    expect(result.vacancies[0]?.sourceProvider).toBe("ats_workday");
  });

  it("continues past a failing employer board (warning, not fatal)", async () => {
    // Two lever employers configured (Zopa, Octopus Energy): first fails, second succeeds.
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce(
        jsonResponse([
          {
            text: "Support Agent",
            hostedUrl: "https://jobs.lever.co/octoenergy/1",
            categories: { location: "London" },
          },
        ]),
      );

    const result = await makeAtsProvider("lever").fetchVacancies({});

    expect(result.vacancies.map((v) => v.title)).toEqual(["Support Agent"]);
    expect(result.warnings.some((w) => w.startsWith("lever/Zopa"))).toBe(true);
  });

  it("throws a config error for unknown companies", async () => {
    await expect(
      makeAtsProvider("lever").fetchVacancies({ companies: ["Nonexistent Corp"] }),
    ).rejects.toMatchObject({ kind: "config" });
  });
});
