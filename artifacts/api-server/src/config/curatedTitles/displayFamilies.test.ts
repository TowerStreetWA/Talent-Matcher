import { describe, it, expect } from "vitest";
import {
  DISPLAY_FAMILIES,
  displayFamiliesForSector,
  resolveDisplayFamily,
  resolveDisplayFamilies,
  matchesDisplayFamily,
} from "./displayFamilies";
import { CURATED_TITLES } from "./index";
import { FIN_SECTORS } from "../../lib/search/finTaxonomy";

describe("display families config integrity", () => {
  it("defines display families for every sector", () => {
    for (const sector of FIN_SECTORS) {
      expect(
        DISPLAY_FAMILIES[sector].length,
        `sector ${sector} has no display families`,
      ).toBeGreaterThan(0);
    }
  });

  it("has unique keys within each sector", () => {
    for (const sector of FIN_SECTORS) {
      const keys = DISPLAY_FAMILIES[sector].map((df) => df.key);
      expect(new Set(keys).size, `duplicate keys in ${sector}`).toBe(keys.length);
    }
  });

  it("every display family references at least one mapping", () => {
    for (const sector of FIN_SECTORS) {
      for (const df of DISPLAY_FAMILIES[sector]) {
        expect(
          df.families.length + df.tags.length,
          `${sector}/${df.key} maps to nothing`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("only references families that exist in the curated taxonomy for that sector", () => {
    for (const sector of FIN_SECTORS) {
      const realFamilies = new Set(
        CURATED_TITLES.filter((e) => e.industry === sector).map((e) => e.family),
      );
      for (const df of DISPLAY_FAMILIES[sector]) {
        for (const fam of df.families) {
          expect(
            realFamilies.has(fam),
            `${sector}/${df.key} references family "${fam}" with no curated titles in ${sector}`,
          ).toBe(true);
        }
      }
    }
  });

  it("only references tags that exist in the curated taxonomy for that sector", () => {
    for (const sector of FIN_SECTORS) {
      const realTags = new Set(
        CURATED_TITLES.filter((e) => e.industry === sector).flatMap(
          (e) => e.tags ?? [],
        ),
      );
      for (const df of DISPLAY_FAMILIES[sector]) {
        for (const tag of df.tags) {
          expect(
            realTags.has(tag),
            `${sector}/${df.key} references tag "${tag}" with no curated titles in ${sector}`,
          ).toBe(true);
        }
      }
    }
  });

  it("every curated title is reachable through at least one display family of its sector", () => {
    const unreachable: string[] = [];
    for (const entry of CURATED_TITLES) {
      const pool = DISPLAY_FAMILIES[entry.industry];
      const hit = pool.some((df) =>
        matchesDisplayFamily(df, entry.family, entry.tags ?? []),
      );
      if (!hit) unreachable.push(`${entry.industry}: ${entry.canonicalTitle}`);
    }
    expect(unreachable, `unreachable curated titles:\n${unreachable.join("\n")}`).toEqual(
      [],
    );
  });
});

describe("display family helpers", () => {
  it("displayFamiliesForSector returns the sector's list", () => {
    expect(displayFamiliesForSector("it_tech").map((d) => d.key)).toContain(
      "software_engineering",
    );
  });

  it("resolveDisplayFamily scopes to the sector when given", () => {
    expect(resolveDisplayFamily("underwriting", "insurance")?.label).toBe(
      "Underwriting",
    );
    expect(resolveDisplayFamily("underwriting", "it_tech")).toBeNull();
  });

  it("resolveDisplayFamily searches all sectors when sector is null", () => {
    expect(resolveDisplayFamily("cyber_security", null)?.label).toBe(
      "Cyber Security",
    );
    expect(resolveDisplayFamily("no_such_family", null)).toBeNull();
  });

  it("resolveDisplayFamilies returns every sector's definition of a duplicated key", () => {
    const sectorsWithLeadership = Object.entries(DISPLAY_FAMILIES)
      .filter(([, pool]) => pool.some((df) => df.key === "leadership"))
      .map(([sector]) => sector);
    expect(sectorsWithLeadership.length).toBeGreaterThan(1);
    const unscoped = resolveDisplayFamilies("leadership", null);
    expect(unscoped.length).toBe(sectorsWithLeadership.length);
    const scoped = resolveDisplayFamilies("leadership", "banking");
    expect(scoped.length).toBe(1);
    expect(resolveDisplayFamilies("no_such_family", null)).toEqual([]);
  });

  it("matchesDisplayFamily matches by fn OR tags", () => {
    const df = resolveDisplayFamily("risk", "banking");
    expect(df).not.toBeNull();
    if (!df) return;
    expect(matchesDisplayFamily(df, "risk", [])).toBe(true);
    expect(matchesDisplayFamily(df, "finance", ["credit_risk"])).toBe(true);
    expect(matchesDisplayFamily(df, "finance", ["treasury_balance_sheet"])).toBe(
      false,
    );
    expect(matchesDisplayFamily(df, null, [])).toBe(false);
  });
});
