import { describe, expect, it } from "vitest";
import {
  LONDON_INSURANCE_EMPLOYERS,
  LONDON_DIRECTORY_UNRESOLVED,
} from "../../config/londonInsuranceEmployers";
import {
  atsEntryFromCareersUrl,
  londonProviderKey,
  LONDON_PROVIDER_KEYS,
  LONDON_SEGMENTS,
  makeLondonEmployerProvider,
  selectLondonEmployers,
} from "./londonDirectory";

describe("generated London directory config", () => {
  it("covers all four market segments with a substantial employer count", () => {
    const bySegment = new Map<string, number>();
    for (const e of LONDON_INSURANCE_EMPLOYERS) {
      bySegment.set(e.segment, (bySegment.get(e.segment) ?? 0) + 1);
    }
    for (const segment of LONDON_SEGMENTS) {
      expect(bySegment.get(segment) ?? 0).toBeGreaterThan(0);
    }
    // Directory has ~190 resolvable employers; a big drop means the
    // generator or the canonical md regressed.
    expect(LONDON_INSURANCE_EMPLOYERS.length).toBeGreaterThanOrEqual(180);
  });

  it("has no duplicate employer names and only valid careers URLs", () => {
    const names = new Set<string>();
    for (const e of LONDON_INSURANCE_EMPLOYERS) {
      const key = e.name.toLowerCase();
      expect(names.has(key), `duplicate employer name: ${e.name}`).toBe(false);
      names.add(key);
      expect(() => new URL(e.careersUrl), `invalid URL for ${e.name}`).not.toThrow();
      expect(e.sectorTag).toBe("insurance");
    }
  });

  it("only skips directory rows with a recorded reason", () => {
    for (const u of LONDON_DIRECTORY_UNRESOLVED) {
      expect(u.reason.length).toBeGreaterThan(0);
      expect(
        LONDON_INSURANCE_EMPLOYERS.some((e) => e.name === u.name),
        `${u.name} is both unresolved and configured`,
      ).toBe(false);
    }
  });

  it("every ATS platformHint parses into a usable board entry", () => {
    for (const e of LONDON_INSURANCE_EMPLOYERS) {
      if (e.platformHint === "careers_page") continue;
      const entry = atsEntryFromCareersUrl(e);
      expect(entry, `${e.name}: ${e.careersUrl} did not parse for ${e.platformHint}`).not.toBeNull();
      expect(entry?.platform).toBe(e.platformHint);
    }
  });
});

describe("atsEntryFromCareersUrl", () => {
  it("parses workday token/instance/site", () => {
    const entry = atsEntryFromCareersUrl({
      name: "Hiscox",
      careersUrl: "https://hiscox.wd3.myworkdayjobs.com/Hiscox_External_Site",
      platformHint: "workday",
    });
    expect(entry).toMatchObject({
      platform: "workday",
      token: "hiscox",
      workdayInstance: "wd3",
      workdaySite: "Hiscox_External_Site",
      sectorTag: "insurance",
    });
  });

  it("rejects workday URLs missing a site path", () => {
    expect(
      atsEntryFromCareersUrl({
        name: "X",
        careersUrl: "https://acme.wd1.myworkdayjobs.com",
        platformHint: "workday",
      }),
    ).toBeNull();
  });

  it("parses teamtailor and recruitee subdomain tokens", () => {
    expect(
      atsEntryFromCareersUrl({
        name: "Ardonagh",
        careersUrl: "https://ardonaghspeciality.teamtailor.com",
        platformHint: "teamtailor",
      }),
    ).toMatchObject({ platform: "teamtailor", token: "ardonaghspeciality" });
    expect(
      atsEntryFromCareersUrl({
        name: "Tysers",
        careersUrl: "https://tysers.recruitee.com",
        platformHint: "recruitee",
      }),
    ).toMatchObject({ platform: "recruitee", token: "tysers" });
  });

  it("parses both workable URL shapes", () => {
    expect(
      atsEntryFromCareersUrl({
        name: "A",
        careersUrl: "https://apply.workable.com/acme",
        platformHint: "workable",
      }),
    ).toMatchObject({ platform: "workable", token: "acme" });
    expect(
      atsEntryFromCareersUrl({
        name: "B",
        careersUrl: "https://acme.workable.com/jobs",
        platformHint: "workable",
      }),
    ).toMatchObject({ platform: "workable", token: "acme" });
  });

  it("returns null for careers_page and malformed URLs", () => {
    expect(
      atsEntryFromCareersUrl({
        name: "C",
        careersUrl: "https://example.com/careers",
        platformHint: "careers_page",
      }),
    ).toBeNull();
    expect(
      atsEntryFromCareersUrl({ name: "D", careersUrl: "not a url", platformHint: "teamtailor" }),
    ).toBeNull();
  });
});

describe("londonProviderKey / provider wrapper", () => {
  it("derives per-segment provider keys", () => {
    expect(londonProviderKey("broker")).toBe("london_insurance_broker");
    expect(LONDON_PROVIDER_KEYS).toEqual([
      "london_insurance_lloyds_syndicate",
      "london_insurance_company_market",
      "london_insurance_mga_coverholder",
      "london_insurance_broker",
    ]);
  });

  it("providers are direct_employer with the segment provider key", () => {
    const employer = LONDON_INSURANCE_EMPLOYERS.find((e) => e.segment === "lloyds_syndicate")!;
    const provider = makeLondonEmployerProvider(employer);
    expect(provider.sourceType).toBe("direct_employer");
    expect(provider.sourceProvider).toBe("london_insurance_lloyds_syndicate");
  });
});

describe("selectLondonEmployers", () => {
  it("filters by segment and pages with offset/limit", () => {
    const brokers = selectLondonEmployers({ segments: ["broker"] });
    expect(brokers.employers.length).toBeGreaterThan(0);
    expect(brokers.employers.every((e) => e.segment === "broker")).toBe(true);

    const page = selectLondonEmployers({ segments: ["broker"], offset: 2, limit: 3 });
    expect(page.employers.length).toBe(3);
    expect(page.employers[0]?.name).toBe(brokers.employers[2]?.name);
    expect(page.totalMatching).toBe(brokers.totalMatching);
  });

  it("filters by employer name case-insensitively", () => {
    const one = selectLondonEmployers({ employers: ["hiscox syndicates limited"] });
    expect(one.employers.length + one.sharedBoardSkips.length).toBeGreaterThanOrEqual(1);
  });

  it("dedupes employers sharing one careers board within a selection", () => {
    const all = selectLondonEmployers({});
    const urls = new Set(all.employers.map((e) => e.careersUrl.toLowerCase().replace(/\/+$/, "")));
    expect(urls.size).toBe(all.employers.length);
    // The Ardonagh group board is listed under several trading names — the
    // duplicates must show up as sharedBoardSkips, not extra fetches.
    expect(all.sharedBoardSkips.length).toBeGreaterThan(0);
    for (const skip of all.sharedBoardSkips) {
      expect(skip.sharesWith).not.toBe(skip.name);
    }
  });
});
