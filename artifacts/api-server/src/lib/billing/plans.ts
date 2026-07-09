/**
 * Central pricing configuration — the single source of truth for
 * Talent Matcher's subscription tiers.
 *
 * Paid-only model, three tiers, GBP, in pence:
 *  - Core:         £120 / user / month (per-user pricing)
 *  - Professional: £220 / user / month (per-user pricing)
 *  - Business:     £450 / month for a 5-seat bundle,
 *                  £95 / month per additional seat beyond bundled seats
 *
 * Annual billing gives 2 months free (10 × monthly per year) and applies
 * to every price component (per-user, bundle, additional seat).
 *
 * Soft caps and feature flags are config-level definitions. Some flags
 * describe future-facing features that are not enforced in code yet —
 * they exist so tiers are clearly defined and enforcement can be added
 * incrementally without changing the pricing contract.
 */

export const PLAN_CURRENCY = "gbp";

/** Months paid per year on annual billing (2 months free). */
export const ANNUAL_MONTHS_CHARGED = 10;

export type PlanKey = "core" | "professional" | "business";

export type BillingInterval = "month" | "year";

/**
 * per_user: price × seats.
 * seat_bundle: base bundle (bundleSeats seats at the base price) plus a
 * per-seat price for additional seats; multiple bundles allowed.
 */
export type PricingModel = "per_user" | "seat_bundle";

export interface PlanSoftCaps {
  /** Included user seats (minimum purchase for the tier). */
  seatMinimum: number;
  /** Fair-use monthly match-run cap. null = effectively uncapped. */
  matchRunsPerMonth: number | null;
  /** Fair-use monthly search cap. null = effectively uncapped. */
  searchesPerMonth: number | null;
  /** Max saved searches / alert rules. null = uncapped. */
  savedSearches: number | null;
  alertRules: number | null;
}

export interface PlanFeatureFlags {
  cvParsing: boolean;
  matching: boolean;
  vacancySearch: boolean;
  savedSearchesAndAlerts: boolean;
  sourceBadgesAndExplanations: boolean;
  sectorScorecards: boolean;
  recruiterFilterToggle: boolean;
  sharedWorkspace: boolean;
  collaboration: boolean;
  crmSync: boolean;
  finServicesRelevancePack: boolean;
  advancedDiscovery: boolean;
  /** Future-facing: automatic candidate re-match against new vacancies. */
  reMatchAutomation: boolean;
  /** Future-facing: team analytics and usage reporting. */
  teamAnalytics: boolean;
  advancedAdminControls: boolean;
  customIngestion: boolean;
  apiIntegrations: boolean;
  prioritySupport: boolean;
  accountManagement: boolean;
}

export interface PlanDef {
  key: PlanKey;
  label: string;
  /** Short positioning line, e.g. "For individual recruiters". */
  summary: string;
  description: string;
  pricingModel: PricingModel;
  /**
   * per_user plans: GBP pence per user per month.
   * seat_bundle plans: GBP pence per bundle per month.
   */
  monthlyBasePence: number;
  /** Annual counterpart (10 × monthly — 2 months free). */
  annualBasePence: number;
  /** seat_bundle only: seats included per bundle. */
  bundleSeats: number | null;
  /** seat_bundle only: pence per additional seat per month. */
  additionalSeatMonthlyPence: number | null;
  /** seat_bundle only: pence per additional seat per year. */
  additionalSeatAnnualPence: number | null;
  trialDays: number;
  /** Contact-only tiers have no Stripe checkout. (None currently.) */
  contactOnly: boolean;
  softCaps: PlanSoftCaps;
  featureFlags: PlanFeatureFlags;
  /** Display bullets for pricing UI. */
  features: string[];
}

const BASE_FLAGS: PlanFeatureFlags = {
  cvParsing: true,
  matching: true,
  vacancySearch: true,
  savedSearchesAndAlerts: true,
  sourceBadgesAndExplanations: true,
  sectorScorecards: false,
  recruiterFilterToggle: false,
  sharedWorkspace: false,
  collaboration: false,
  crmSync: false,
  finServicesRelevancePack: false,
  advancedDiscovery: false,
  reMatchAutomation: false,
  teamAnalytics: false,
  advancedAdminControls: false,
  customIngestion: false,
  apiIntegrations: false,
  prioritySupport: false,
  accountManagement: false,
};

export const CORE_MONTHLY_PENCE = 12000;
export const PROFESSIONAL_MONTHLY_PENCE = 22000;
export const BUSINESS_BUNDLE_MONTHLY_PENCE = 45000;
export const BUSINESS_BUNDLE_SEATS = 5;
export const BUSINESS_ADDITIONAL_SEAT_MONTHLY_PENCE = 9500;

export const PLANS: Record<PlanKey, PlanDef> = {
  core: {
    key: "core",
    label: "Core",
    summary: "For individual recruiters and small boutiques",
    description: "For individual recruiters and small boutiques.",
    pricingModel: "per_user",
    monthlyBasePence: CORE_MONTHLY_PENCE,
    annualBasePence: CORE_MONTHLY_PENCE * ANNUAL_MONTHS_CHARGED,
    bundleSeats: null,
    additionalSeatMonthlyPence: null,
    additionalSeatAnnualPence: null,
    trialDays: 7,
    contactOnly: false,
    softCaps: {
      seatMinimum: 1,
      matchRunsPerMonth: 200,
      searchesPerMonth: 1000,
      savedSearches: 5,
      alertRules: 5,
    },
    featureFlags: { ...BASE_FLAGS },
    features: [
      "Full job search across Insurance, Banking, Asset Management, Pensions, Accountancy & Finance, and IT & Technology",
      "Direct-employer-first results (recruitment firm jobs filtered by default)",
      "Saved searches and email alerts",
      "Single user seat",
    ],
  },
  professional: {
    key: "professional",
    label: "Professional",
    summary: "For agency desk leads and active recruiters working multiple markets",
    description:
      "For agency desk leads and active recruiters working multiple markets.",
    pricingModel: "per_user",
    monthlyBasePence: PROFESSIONAL_MONTHLY_PENCE,
    annualBasePence: PROFESSIONAL_MONTHLY_PENCE * ANNUAL_MONTHS_CHARGED,
    bundleSeats: null,
    additionalSeatMonthlyPence: null,
    additionalSeatAnnualPence: null,
    trialDays: 7,
    contactOnly: false,
    softCaps: {
      seatMinimum: 1,
      matchRunsPerMonth: 1000,
      searchesPerMonth: 5000,
      savedSearches: 25,
      alertRules: 25,
    },
    featureFlags: {
      ...BASE_FLAGS,
      sectorScorecards: true,
      recruiterFilterToggle: true,
      finServicesRelevancePack: true,
      advancedDiscovery: true,
    },
    features: [
      "Everything in Core",
      "Sector scorecards for Insurance, Banking, IT & Tech and other covered sectors",
      "Recruiter filtering toggle (include/exclude agency-posted roles)",
      "More saved searches and alerts",
      "Better multi-sector workflow support",
    ],
  },
  business: {
    key: "business",
    label: "Business",
    summary: "For agencies rolling Talent Matcher out across multiple desks",
    description:
      "For agencies rolling Talent Matcher out across multiple desks.",
    pricingModel: "seat_bundle",
    monthlyBasePence: BUSINESS_BUNDLE_MONTHLY_PENCE,
    annualBasePence: BUSINESS_BUNDLE_MONTHLY_PENCE * ANNUAL_MONTHS_CHARGED,
    bundleSeats: BUSINESS_BUNDLE_SEATS,
    additionalSeatMonthlyPence: BUSINESS_ADDITIONAL_SEAT_MONTHLY_PENCE,
    additionalSeatAnnualPence:
      BUSINESS_ADDITIONAL_SEAT_MONTHLY_PENCE * ANNUAL_MONTHS_CHARGED,
    trialDays: 7,
    contactOnly: false,
    softCaps: {
      seatMinimum: 5,
      matchRunsPerMonth: null,
      searchesPerMonth: null,
      savedSearches: null,
      alertRules: null,
    },
    featureFlags: {
      ...BASE_FLAGS,
      sectorScorecards: true,
      recruiterFilterToggle: true,
      finServicesRelevancePack: true,
      advancedDiscovery: true,
      sharedWorkspace: true,
      collaboration: true,
      crmSync: true,
      reMatchAutomation: true,
      teamAnalytics: true,
      advancedAdminControls: true,
      customIngestion: true,
      prioritySupport: true,
      accountManagement: true,
    },
    features: [
      "Everything in Professional for bundled team seats",
      "Shared saved searches, alerts, and employer watchlists across the team",
      "Custom target-employer lists and tenant-specific directory priorities",
      "Advanced coverage diagnostics and source metrics",
      "Priority support and configuration",
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ["core", "professional", "business"];

/**
 * Legacy plan keys from earlier pricing models. Existing tenants are
 * never force-migrated — their Stripe subscription keeps its old price;
 * we only map the key so the app can resolve a current PlanDef for
 * display and feature checks.
 */
const LEGACY_PLAN_ALIASES: Record<string, PlanKey> = {
  // Original $49 Starter and £79 Solo map to Core.
  starter: "core",
  solo: "core",
  // £149 Team maps to Professional.
  team: "professional",
  // £229 Pro Agency and quote-based Enterprise map to Business.
  pro_agency: "business",
  enterprise: "business",
};

export function resolvePlanKey(key: string | null | undefined): PlanKey | null {
  if (!key) return null;
  if (key in PLANS) return key as PlanKey;
  return LEGACY_PLAN_ALIASES[key] ?? null;
}

export function getPlan(key: string): PlanDef | undefined {
  const resolved = resolvePlanKey(key);
  return resolved ? PLANS[resolved] : undefined;
}

export function isCore(planKey: string | null | undefined): boolean {
  return resolvePlanKey(planKey) === "core";
}
export function isProfessional(planKey: string | null | undefined): boolean {
  return resolvePlanKey(planKey) === "professional";
}
export function isBusiness(planKey: string | null | undefined): boolean {
  return resolvePlanKey(planKey) === "business";
}

/** Rank for "at least this tier" checks. Unknown/none = -1. */
export function planRank(planKey: string | null | undefined): number {
  const resolved = resolvePlanKey(planKey);
  return resolved ? PLAN_ORDER.indexOf(resolved) : -1;
}

export function planAtLeast(
  planKey: string | null | undefined,
  minimum: PlanKey,
): boolean {
  return planRank(planKey) >= PLAN_ORDER.indexOf(minimum);
}

// ---------------------------------------------------------------------------
// Pricing computation
// ---------------------------------------------------------------------------

export interface BusinessSeatBreakdown {
  /** Seats actually covered (bundles × bundleSeats + additionalSeats). */
  seatCapacity: number;
  bundles: number;
  additionalSeats: number;
  monthlyTotalPence: number;
  annualTotalPence: number;
}

/**
 * Compute the Business seat breakdown for a requested seat count.
 *
 * Default split is the recommended best-value composition: as many full
 * bundles as fit, plus additional seats for the remainder (a 5th
 * additional seat would cost more than another bundle, so the remainder
 * is always 0–4 and this split is cost-optimal). At least one bundle is
 * always required.
 *
 * An explicit `{ bundles, additionalSeats }` composition may be supplied
 * (e.g. 1 bundle + 5 extras for 10 users = £925) as long as it covers
 * the requested seats and includes at least one bundle.
 */
export function computeBusinessSeatBreakdown(
  seats: number,
  explicit?: { bundles: number; additionalSeats: number },
): BusinessSeatBreakdown {
  if (!Number.isInteger(seats) || seats < 1) {
    throw new Error("seats must be a positive integer");
  }
  let bundles: number;
  let additionalSeats: number;
  if (explicit) {
    if (
      !Number.isInteger(explicit.bundles) ||
      !Number.isInteger(explicit.additionalSeats) ||
      explicit.bundles < 1 ||
      explicit.additionalSeats < 0
    ) {
      throw new Error(
        "explicit composition needs bundles >= 1 and additionalSeats >= 0",
      );
    }
    const capacity =
      explicit.bundles * BUSINESS_BUNDLE_SEATS + explicit.additionalSeats;
    if (capacity < seats) {
      throw new Error(
        `explicit composition covers ${capacity} seats but ${seats} requested`,
      );
    }
    bundles = explicit.bundles;
    additionalSeats = explicit.additionalSeats;
  } else {
    bundles = Math.max(1, Math.floor(seats / BUSINESS_BUNDLE_SEATS));
    additionalSeats = Math.max(0, seats - bundles * BUSINESS_BUNDLE_SEATS);
  }
  const monthlyTotalPence =
    bundles * BUSINESS_BUNDLE_MONTHLY_PENCE +
    additionalSeats * BUSINESS_ADDITIONAL_SEAT_MONTHLY_PENCE;
  return {
    seatCapacity: bundles * BUSINESS_BUNDLE_SEATS + additionalSeats,
    bundles,
    additionalSeats,
    monthlyTotalPence,
    annualTotalPence: monthlyTotalPence * ANNUAL_MONTHS_CHARGED,
  };
}

/**
 * Per-tenant monthly total in pence for any plan.
 * per_user plans: base price × seats. Business: bundle math above.
 */
export function computePlanMonthlyTotalPence(
  planKey: string,
  seats: number,
): number {
  const plan = getPlan(planKey);
  if (!plan) throw new Error(`Unknown plan: ${planKey}`);
  if (!Number.isInteger(seats) || seats < 1) {
    throw new Error("seats must be a positive integer");
  }
  if (plan.pricingModel === "seat_bundle") {
    return computeBusinessSeatBreakdown(seats).monthlyTotalPence;
  }
  return plan.monthlyBasePence * seats;
}

export type BillingStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export function canUseCoreProduct(status: string): boolean {
  return status === "trialing" || status === "active" || status === "past_due";
}

export function isBillingRestricted(status: string): boolean {
  return !canUseCoreProduct(status);
}
