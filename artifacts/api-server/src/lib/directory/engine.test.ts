import { describe, expect, it } from "vitest";
import {
  CAREERS_DIRECTORIES,
  directoryByKey,
  LONDON_INSURANCE_DIRECTORY,
} from "../../config/careersDirectories";
import {
  atsEntryFromUrl,
  directoryProviderKey,
  directoryProviderKeys,
  makeDirectoryEmployerProvider,
  selectDirectoryEmployers,
} from "./engine";

describe("atsEntryFromUrl", () => {
  const opts = { company: "Acme", sectorTag: "banking" };

  it("parses workday URLs, skipping locale path segments", () => {
    expect(
      atsEntryFromUrl("https://acme.wd3.myworkdayjobs.com/Acme_Careers", opts),
    ).toMatchObject({
      platform: "workday",
      token: "acme",
      workdayInstance: "wd3",
      workdaySite: "Acme_Careers",
      sectorTag: "banking",
    });
    expect(
      atsEntryFromUrl("https://acme.wd1.myworkdayjobs.com/en-US/External", opts),
    ).toMatchObject({ platform: "workday", workdaySite: "External" });
    expect(
      atsEntryFromUrl("https://acme.wd1.myworkdayjobs.com/en_GB/Careers", opts),
    ).toMatchObject({ platform: "workday", workdaySite: "Careers" });
    expect(atsEntryFromUrl("https://acme.wd1.myworkdayjobs.com", opts)).toBeNull();
  });

  it("parses lever URLs including the EU cluster", () => {
    expect(atsEntryFromUrl("https://jobs.lever.co/zopa", opts)).toMatchObject({
      platform: "lever",
      token: "zopa",
    });
    expect(atsEntryFromUrl("https://jobs.eu.lever.co/acme/123", opts)).toMatchObject({
      platform: "lever",
      token: "acme",
    });
  });

  it("parses ashby and smartrecruiters URLs", () => {
    expect(atsEntryFromUrl("https://jobs.ashbyhq.com/multiverse", opts)).toMatchObject({
      platform: "ashby",
      token: "multiverse",
    });
    expect(
      atsEntryFromUrl("https://careers.smartrecruiters.com/AcmeCorp", opts),
    ).toMatchObject({ platform: "smartrecruiters", token: "AcmeCorp" });
    expect(atsEntryFromUrl("https://jobs.smartrecruiters.com/AcmeCorp", opts)).toMatchObject(
      { platform: "smartrecruiters", token: "AcmeCorp" },
    );
  });

  it("parses teamtailor, recruitee and both workable shapes", () => {
    expect(atsEntryFromUrl("https://acme.teamtailor.com", opts)).toMatchObject({
      platform: "teamtailor",
      token: "acme",
    });
    expect(atsEntryFromUrl("https://acme.recruitee.com", opts)).toMatchObject({
      platform: "recruitee",
      token: "acme",
    });
    expect(atsEntryFromUrl("https://apply.workable.com/acme", opts)).toMatchObject({
      platform: "workable",
      token: "acme",
    });
    expect(atsEntryFromUrl("https://acme.workable.com/jobs", opts)).toMatchObject({
      platform: "workable",
      token: "acme",
    });
  });

  it("returns null for generic and malformed URLs", () => {
    expect(atsEntryFromUrl("https://example.com/careers", opts)).toBeNull();
    expect(atsEntryFromUrl("not a url", opts)).toBeNull();
    expect(atsEntryFromUrl("https://www.teamtailor.com", opts)).toBeNull();
    expect(atsEntryFromUrl("https://www.workable.com", opts)).toBeNull();
  });
});

describe("careers-directory registry", () => {
  it("has unique keys and provider prefixes", () => {
    const keys = new Set(CAREERS_DIRECTORIES.map((d) => d.key));
    const prefixes = new Set(CAREERS_DIRECTORIES.map((d) => d.providerPrefix));
    expect(keys.size).toBe(CAREERS_DIRECTORIES.length);
    expect(prefixes.size).toBe(CAREERS_DIRECTORIES.length);
  });

  it("keeps London insurance provider keys unchanged (backward compat)", () => {
    expect(LONDON_INSURANCE_DIRECTORY.providerPrefix).toBe("london_insurance");
    expect(directoryProviderKeys(LONDON_INSURANCE_DIRECTORY)).toEqual([
      "london_insurance_lloyds_syndicate",
      "london_insurance_company_market",
      "london_insurance_mga_coverholder",
      "london_insurance_broker",
    ]);
    expect(directoryByKey("london_insurance")).toBe(LONDON_INSURANCE_DIRECTORY);
  });

  it("seed directories use the directory_<industry> prefix", () => {
    for (const d of CAREERS_DIRECTORIES) {
      if (d.key === "london_insurance") continue;
      expect(d.providerPrefix).toBe(`directory_${d.industry}`);
      expect(d.key).toBe(d.industry);
    }
  });

  it("every employer has a valid URL, known segment, and matching sectorTag", () => {
    for (const d of CAREERS_DIRECTORIES) {
      expect(d.employers.length).toBeGreaterThan(0);
      const names = new Set<string>();
      for (const e of d.employers) {
        expect(() => new URL(e.careersUrl), `${d.key}/${e.name}: bad URL`).not.toThrow();
        expect(d.segments, `${d.key}/${e.name}: unknown segment`).toContain(e.segment);
        expect(e.sectorTag, `${d.key}/${e.name}: sectorTag mismatch`).toBe(d.industry);
        const key = e.name.toLowerCase();
        expect(names.has(key), `${d.key}: duplicate employer ${e.name}`).toBe(false);
        names.add(key);
      }
    }
  });

  it("ATS platformHints in every directory parse into usable board entries", () => {
    for (const d of CAREERS_DIRECTORIES) {
      for (const e of d.employers) {
        if (e.platformHint === "careers_page") continue;
        const entry = atsEntryFromUrl(e.careersUrl, { company: e.name });
        expect(entry, `${d.key}/${e.name}: ${e.careersUrl} did not parse`).not.toBeNull();
        expect(entry?.platform).toBe(e.platformHint);
      }
    }
  });
});

describe("directory providers and selection", () => {
  const banking = directoryByKey("banking")!;

  it("providers are direct_employer with <prefix>_<segment> keys", () => {
    const employer = banking.employers.find((e) => e.segment === "challenger_bank")!;
    const provider = makeDirectoryEmployerProvider(banking, employer);
    expect(provider.sourceType).toBe("direct_employer");
    expect(provider.sourceProvider).toBe("directory_banking_challenger_bank");
    expect(directoryProviderKey(banking, "retail_bank")).toBe("directory_banking_retail_bank");
  });

  it("selection filters by segment and pages deterministically", () => {
    const all = selectDirectoryEmployers(banking, {});
    expect(all.totalMatching).toBeGreaterThan(10);
    const challengers = selectDirectoryEmployers(banking, { segments: ["challenger_bank"] });
    expect(challengers.employers.every((e) => e.segment === "challenger_bank")).toBe(true);
    const page = selectDirectoryEmployers(banking, { offset: 3, limit: 2 });
    expect(page.employers.length).toBe(2);
    expect(page.employers[0]?.name).toBe(all.employers[3]?.name);
  });

  it("hour-slot partition covers every employer exactly once per cycle", () => {
    for (const d of CAREERS_DIRECTORIES) {
      const { employers } = selectDirectoryEmployers(d, {});
      const slots = d.sweep.slots;
      const seen = new Map<string, number>();
      for (let hour = 0; hour < slots; hour++) {
        for (const e of employers.filter((_, idx) => idx % slots === hour % slots)) {
          seen.set(e.name, (seen.get(e.name) ?? 0) + 1);
        }
      }
      expect(seen.size).toBe(employers.length);
      for (const [, times] of seen) expect(times).toBe(1);
    }
  });
});
