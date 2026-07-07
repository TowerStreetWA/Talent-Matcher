import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_ORDER,
  ANNUAL_MONTHS_CHARGED,
  resolvePlanKey,
  getPlan,
  isSolo,
  isTeam,
  isProAgency,
  isEnterprise,
  planRank,
  planAtLeast,
} from "./plans";

describe("pricing config", () => {
  it("defines the four tiers in order", () => {
    expect(PLAN_ORDER).toEqual(["solo", "team", "pro_agency", "enterprise"]);
  });

  it("has the agreed GBP monthly prices (pence per user)", () => {
    expect(PLANS.solo.monthlyPencePerUser).toBe(7900);
    expect(PLANS.team.monthlyPencePerUser).toBe(14900);
    expect(PLANS.pro_agency.monthlyPencePerUser).toBe(22900);
    expect(PLANS.enterprise.monthlyPencePerUser).toBe(150000);
  });

  it("annual price is 10x monthly (2 months free) for every tier", () => {
    for (const key of PLAN_ORDER) {
      const plan = PLANS[key];
      expect(plan.annualPencePerUser).toBe(
        plan.monthlyPencePerUser * ANNUAL_MONTHS_CHARGED,
      );
    }
  });

  it("self-serve tiers have 7-day trials; enterprise has none and is contact-only", () => {
    expect(PLANS.solo.trialDays).toBe(7);
    expect(PLANS.team.trialDays).toBe(7);
    expect(PLANS.pro_agency.trialDays).toBe(7);
    expect(PLANS.enterprise.trialDays).toBe(0);
    expect(PLANS.enterprise.contactOnly).toBe(true);
    expect(PLANS.solo.contactOnly).toBe(false);
    expect(PLANS.team.contactOnly).toBe(false);
    expect(PLANS.pro_agency.contactOnly).toBe(false);
  });
});

describe("plan key resolution", () => {
  it("resolves current keys to themselves", () => {
    expect(resolvePlanKey("solo")).toBe("solo");
    expect(resolvePlanKey("pro_agency")).toBe("pro_agency");
  });

  it("maps the legacy starter key to solo", () => {
    expect(resolvePlanKey("starter")).toBe("solo");
    expect(getPlan("starter")?.key).toBe("solo");
  });

  it("returns null/undefined for unknown keys", () => {
    expect(resolvePlanKey("gold")).toBeNull();
    expect(resolvePlanKey(null)).toBeNull();
    expect(getPlan("gold")).toBeUndefined();
  });
});

describe("plan helpers", () => {
  it("isSolo/isTeam/isProAgency/isEnterprise", () => {
    expect(isSolo("solo")).toBe(true);
    expect(isSolo("starter")).toBe(true); // legacy alias
    expect(isTeam("team")).toBe(true);
    expect(isProAgency("pro_agency")).toBe(true);
    expect(isEnterprise("enterprise")).toBe(true);
    expect(isEnterprise("solo")).toBe(false);
    expect(isSolo(null)).toBe(false);
  });

  it("planRank and planAtLeast order tiers correctly", () => {
    expect(planRank("solo")).toBeLessThan(planRank("team"));
    expect(planRank("team")).toBeLessThan(planRank("pro_agency"));
    expect(planRank("pro_agency")).toBeLessThan(planRank("enterprise"));
    expect(planRank("unknown")).toBe(-1);
    expect(planAtLeast("pro_agency", "team")).toBe(true);
    expect(planAtLeast("solo", "team")).toBe(false);
    expect(planAtLeast(null, "solo")).toBe(false);
  });
});
