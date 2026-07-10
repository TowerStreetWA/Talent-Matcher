import { describe, it, expect } from "vitest";
import { redactContactOnlyPlan, type PlanWithPrice } from "./service";
import { PLANS } from "./plans";

function withPrices(plan: keyof typeof PLANS): PlanWithPrice {
  return {
    ...PLANS[plan],
    monthlyPriceId: "price_month",
    monthlyUnitAmount: 45000,
    annualPriceId: "price_year",
    annualUnitAmount: 450000,
    additionalSeatMonthlyPriceId: "price_seat_month",
    additionalSeatMonthlyUnitAmount: 9500,
    additionalSeatAnnualPriceId: "price_seat_year",
    additionalSeatAnnualUnitAmount: 95000,
    currency: "gbp",
  };
}

describe("redactContactOnlyPlan (public /billing/plans)", () => {
  it("strips all price IDs, amounts, and bundle structure from contact-only plans", () => {
    const business = withPrices("business");
    expect(business.contactOnly).toBe(true);
    const redacted = redactContactOnlyPlan(business);
    expect(redacted.monthlyPriceId).toBeNull();
    expect(redacted.monthlyUnitAmount).toBeNull();
    expect(redacted.annualPriceId).toBeNull();
    expect(redacted.annualUnitAmount).toBeNull();
    expect(redacted.additionalSeatMonthlyPriceId).toBeNull();
    expect(redacted.additionalSeatMonthlyUnitAmount).toBeNull();
    expect(redacted.additionalSeatAnnualPriceId).toBeNull();
    expect(redacted.additionalSeatAnnualUnitAmount).toBeNull();
    expect(redacted.bundleSeats).toBeNull();
    // Display metadata survives so the card still renders.
    expect(redacted.key).toBe("business");
    expect(redacted.contactOnly).toBe(true);
    expect(redacted.features.length).toBeGreaterThan(0);
  });

  it("passes self-serve plans through untouched", () => {
    for (const key of ["core", "professional"] as const) {
      const plan = withPrices(key);
      expect(plan.contactOnly).toBe(false);
      expect(redactContactOnlyPlan(plan)).toBe(plan);
    }
  });
});
