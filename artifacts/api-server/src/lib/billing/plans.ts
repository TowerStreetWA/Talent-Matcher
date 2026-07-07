/**
 * Central pricing configuration — the single source of truth for
 * VacancyMatch AI's subscription tiers.
 *
 * Prices are GBP, per user, per month, in pence. Annual billing gives
 * 2 months free (10 × monthly per year).
 *
 * Soft caps and feature flags are config-level definitions. Some flags
 * describe future-facing features that are not enforced in code yet —
 * they exist so tiers are clearly defined and enforcement can be added
 * incrementally without changing the pricing contract.
 *
 * Onboarding/setup fees are invoiced directly by Tower Street and are
 * deliberately NOT part of Stripe Checkout.
 */

export const PLAN_CURRENCY = "gbp";

/** Months paid per year on annual billing (2 months free). */
export const ANNUAL_MONTHS_CHARGED = 10;

export type PlanKey = "solo" | "team" | "pro_agency" | "enterprise";

export type BillingInterval = "month" | "year";

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
  /** Short positioning line, e.g. "For solo recruiters". */
  summary: string;
  description: string;
  /** GBP pence per user per month. Enterprise: indicative "from" price. */
  monthlyPencePerUser: number;
  /** GBP pence per user per year (10 × monthly — 2 months free). */
  annualPencePerUser: number;
  trialDays: number;
  /** Contact-only tiers have no Stripe checkout. */
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

export const PLANS: Record<PlanKey, PlanDef> = {
  solo: {
    key: "solo",
    label: "Solo",
    summary: "For solo recruiters",
    description: "For solo recruiters and 1-person desks.",
    monthlyPencePerUser: 7900,
    annualPencePerUser: 7900 * ANNUAL_MONTHS_CHARGED,
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
      "For solo recruiters and 1-person desks",
      "Upload CVs and find live employer roles faster",
      "Smart matching and search across indexed jobs",
      "Basic saved searches and alerts",
      "Email support",
    ],
  },
  team: {
    key: "team",
    label: "Team",
    summary: "For small teams",
    description: "For small to mid-sized agency teams.",
    monthlyPencePerUser: 14900,
    annualPencePerUser: 14900 * ANNUAL_MONTHS_CHARGED,
    trialDays: 7,
    contactOnly: false,
    softCaps: {
      seatMinimum: 3,
      matchRunsPerMonth: 1000,
      searchesPerMonth: 5000,
      savedSearches: 25,
      alertRules: 25,
    },
    featureFlags: {
      ...BASE_FLAGS,
      sharedWorkspace: true,
      collaboration: true,
      crmSync: true,
      finServicesRelevancePack: true,
    },
    features: [
      "For small to mid-sized agency teams",
      "Shared workspace, notes and collaboration",
      "Employer-first search across insurance, banking, pensions, asset management",
      "More saved searches and alerts, CRM sync",
      "Priority email support",
    ],
  },
  pro_agency: {
    key: "pro_agency",
    label: "Pro Agency",
    summary: "For specialist agencies",
    description: "For specialist and multi-user desks.",
    monthlyPencePerUser: 22900,
    annualPencePerUser: 22900 * ANNUAL_MONTHS_CHARGED,
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
      sharedWorkspace: true,
      collaboration: true,
      crmSync: true,
      finServicesRelevancePack: true,
      advancedDiscovery: true,
      reMatchAutomation: true,
      teamAnalytics: true,
      advancedAdminControls: true,
      prioritySupport: true,
    },
    features: [
      "For specialist and multi-user desks",
      "Advanced employer-first vacancy discovery",
      "Higher usage, re-match automation, team analytics",
      "Priority support and stronger admin controls",
    ],
  },
  enterprise: {
    key: "enterprise",
    label: "Enterprise",
    summary: "For larger firms",
    description: "For larger firms and in-house teams.",
    // Indicative "from" price — real pricing is quote-based.
    monthlyPencePerUser: 150000,
    annualPencePerUser: 150000 * ANNUAL_MONTHS_CHARGED,
    trialDays: 0,
    contactOnly: true,
    softCaps: {
      seatMinimum: 10,
      matchRunsPerMonth: null,
      searchesPerMonth: null,
      savedSearches: null,
      alertRules: null,
    },
    featureFlags: {
      ...BASE_FLAGS,
      sharedWorkspace: true,
      collaboration: true,
      crmSync: true,
      finServicesRelevancePack: true,
      advancedDiscovery: true,
      reMatchAutomation: true,
      teamAnalytics: true,
      advancedAdminControls: true,
      customIngestion: true,
      apiIntegrations: true,
      prioritySupport: true,
      accountManagement: true,
    },
    features: [
      "For larger firms and in-house teams",
      "Custom sources, integrations and rollout",
      "Tailored financial-services tuning and compliance support",
      "Talk to us for a quote",
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ["solo", "team", "pro_agency", "enterprise"];

/**
 * Legacy plan keys from the original two-tier model. Existing tenants are
 * never force-migrated — their Stripe subscription keeps its old price;
 * we only map the key so the app can resolve a current PlanDef for
 * display and feature checks.
 */
const LEGACY_PLAN_ALIASES: Record<string, PlanKey> = {
  // Original $49 Starter maps to Solo (closest current tier).
  starter: "solo",
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

export function isSolo(planKey: string | null | undefined): boolean {
  return resolvePlanKey(planKey) === "solo";
}
export function isTeam(planKey: string | null | undefined): boolean {
  return resolvePlanKey(planKey) === "team";
}
export function isProAgency(planKey: string | null | undefined): boolean {
  return resolvePlanKey(planKey) === "pro_agency";
}
export function isEnterprise(planKey: string | null | undefined): boolean {
  return resolvePlanKey(planKey) === "enterprise";
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
