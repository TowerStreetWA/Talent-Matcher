import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_ORDER,
  ANNUAL_MONTHS_CHARGED,
  resolvePlanKey,
  getPlan,
  isCore,
  isProfessional,
  isBusiness,
  planRank,
  planAtLeast,
  computeBusinessSeatBreakdown,
  computePlanMonthlyTotalPence,
} from "./plans";

describe("pricing config", () => {
  it("defines the three paid tiers in order — no free tier", () => {
    expect(PLAN_ORDER).toEqual(["core", "professional", "business"]);
    for (const key of PLAN_ORDER) {
      expect(PLANS[key].monthlyBasePence).toBeGreaterThan(0);
    }
    // Core and Professional are self-serve; Business is team rollout
    // pricing sold via demo/contact (no public price or checkout).
    expect(PLANS.core.contactOnly).toBe(false);
    expect(PLANS.professional.contactOnly).toBe(false);
    expect(PLANS.business.contactOnly).toBe(true);
  });

  it("has the agreed GBP monthly prices (pence)", () => {
    expect(PLANS.core.monthlyBasePence).toBe(12000); // £120 / user
    expect(PLANS.professional.monthlyBasePence).toBe(22000); // £220 / user
    expect(PLANS.business.monthlyBasePence).toBe(45000); // £450 / 5-seat bundle
    expect(PLANS.business.bundleSeats).toBe(5);
    expect(PLANS.business.additionalSeatMonthlyPence).toBe(9500); // £95 / extra seat
  });

  it("annual price is 10x monthly (2 months free) for every price component", () => {
    for (const key of PLAN_ORDER) {
      const plan = PLANS[key];
      expect(plan.annualBasePence).toBe(
        plan.monthlyBasePence * ANNUAL_MONTHS_CHARGED,
      );
    }
    expect(PLANS.business.additionalSeatAnnualPence).toBe(
      9500 * ANNUAL_MONTHS_CHARGED,
    );
  });

  it("pricing models: Core/Professional per-user, Business seat-bundle", () => {
    expect(PLANS.core.pricingModel).toBe("per_user");
    expect(PLANS.professional.pricingModel).toBe("per_user");
    expect(PLANS.business.pricingModel).toBe("seat_bundle");
  });

  it("all tiers have 7-day trials", () => {
    for (const key of PLAN_ORDER) {
      expect(PLANS[key].trialDays).toBe(7);
    }
  });
});

describe("plan key resolution", () => {
  it("resolves current keys to themselves", () => {
    expect(resolvePlanKey("core")).toBe("core");
    expect(resolvePlanKey("professional")).toBe("professional");
    expect(resolvePlanKey("business")).toBe("business");
  });

  it("maps legacy keys onto current tiers", () => {
    expect(resolvePlanKey("starter")).toBe("core");
    expect(resolvePlanKey("solo")).toBe("core");
    expect(resolvePlanKey("team")).toBe("professional");
    expect(resolvePlanKey("pro_agency")).toBe("business");
    expect(resolvePlanKey("enterprise")).toBe("business");
    expect(getPlan("solo")?.key).toBe("core");
  });

  it("returns null/undefined for unknown keys", () => {
    expect(resolvePlanKey("gold")).toBeNull();
    expect(resolvePlanKey(null)).toBeNull();
    expect(getPlan("gold")).toBeUndefined();
  });
});

describe("plan helpers", () => {
  it("isCore/isProfessional/isBusiness", () => {
    expect(isCore("core")).toBe(true);
    expect(isCore("solo")).toBe(true); // legacy alias
    expect(isProfessional("team")).toBe(true); // legacy alias
    expect(isBusiness("business")).toBe(true);
    expect(isBusiness("pro_agency")).toBe(true); // legacy alias
    expect(isBusiness("core")).toBe(false);
    expect(isCore(null)).toBe(false);
  });

  it("planRank and planAtLeast order tiers correctly", () => {
    expect(planRank("core")).toBeLessThan(planRank("professional"));
    expect(planRank("professional")).toBeLessThan(planRank("business"));
    expect(planRank("unknown")).toBe(-1);
    expect(planAtLeast("business", "professional")).toBe(true);
    expect(planAtLeast("core", "professional")).toBe(false);
    expect(planAtLeast(null, "core")).toBe(false);
  });
});

describe("Business seat-bundle computation", () => {
  it("5 users → one bundle, £450", () => {
    const b = computeBusinessSeatBreakdown(5);
    expect(b).toMatchObject({
      bundles: 1,
      additionalSeats: 0,
      seatCapacity: 5,
      monthlyTotalPence: 45000,
    });
  });

  it("6 users → bundle + 1 extra, £545", () => {
    const b = computeBusinessSeatBreakdown(6);
    expect(b).toMatchObject({
      bundles: 1,
      additionalSeats: 1,
      seatCapacity: 6,
      monthlyTotalPence: 45000 + 9500,
    });
  });

  it("10 users → recommends 2 bundles (£900, best value)", () => {
    const b = computeBusinessSeatBreakdown(10);
    expect(b).toMatchObject({
      bundles: 2,
      additionalSeats: 0,
      seatCapacity: 10,
      monthlyTotalPence: 90000,
    });
  });

  it("10 users with explicit 1 bundle + 5 extras → £925", () => {
    const b = computeBusinessSeatBreakdown(10, {
      bundles: 1,
      additionalSeats: 5,
    });
    expect(b).toMatchObject({
      bundles: 1,
      additionalSeats: 5,
      seatCapacity: 10,
      monthlyTotalPence: 45000 + 5 * 9500,
    });
  });

  it("fewer than 5 users still requires the base bundle", () => {
    for (const seats of [1, 2, 3, 4]) {
      const b = computeBusinessSeatBreakdown(seats);
      expect(b.bundles).toBe(1);
      expect(b.additionalSeats).toBe(0);
      expect(b.monthlyTotalPence).toBe(45000);
    }
  });

  it("default split is never beaten by an alternative composition", () => {
    // Remainder extras (0-4) are always cheaper than another £450 bundle.
    for (let seats = 1; seats <= 25; seats++) {
      const def = computeBusinessSeatBreakdown(seats);
      const oneMoreBundle = computeBusinessSeatBreakdown(seats, {
        bundles: def.bundles + 1,
        additionalSeats: 0,
      });
      expect(def.monthlyTotalPence).toBeLessThanOrEqual(
        oneMoreBundle.monthlyTotalPence,
      );
    }
  });

  it("annual totals are 10x monthly", () => {
    const b = computeBusinessSeatBreakdown(7);
    expect(b.annualTotalPence).toBe(b.monthlyTotalPence * ANNUAL_MONTHS_CHARGED);
  });

  it("rejects invalid input", () => {
    expect(() => computeBusinessSeatBreakdown(0)).toThrow();
    expect(() => computeBusinessSeatBreakdown(2.5)).toThrow();
    expect(() =>
      computeBusinessSeatBreakdown(6, { bundles: 0, additionalSeats: 6 }),
    ).toThrow();
    expect(() =>
      computeBusinessSeatBreakdown(10, { bundles: 1, additionalSeats: 2 }),
    ).toThrow(); // covers only 7 of 10
  });
});

describe("per-tenant totals", () => {
  it("Core/Professional: per-user × seats", () => {
    expect(computePlanMonthlyTotalPence("core", 1)).toBe(12000);
    expect(computePlanMonthlyTotalPence("core", 3)).toBe(36000);
    expect(computePlanMonthlyTotalPence("professional", 4)).toBe(88000);
  });

  it("Business: bundle math", () => {
    expect(computePlanMonthlyTotalPence("business", 5)).toBe(45000);
    expect(computePlanMonthlyTotalPence("business", 6)).toBe(54500);
    expect(computePlanMonthlyTotalPence("business", 10)).toBe(90000);
  });

  it("legacy keys resolve before computing", () => {
    expect(computePlanMonthlyTotalPence("solo", 2)).toBe(24000);
  });

  it("rejects unknown plans and bad seat counts", () => {
    expect(() => computePlanMonthlyTotalPence("gold", 1)).toThrow();
    expect(() => computePlanMonthlyTotalPence("core", 0)).toThrow();
  });
});
