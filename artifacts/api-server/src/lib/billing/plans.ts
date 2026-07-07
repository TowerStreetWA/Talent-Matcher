export interface PlanDef {
  key: string;
  label: string;
  description: string;
  trialDays: number;
  features: string[];
}

export const PLANS: Record<string, PlanDef> = {
  starter: {
    key: "starter",
    label: "Starter",
    description: "For solo recruiters getting started",
    trialDays: 7,
    features: [
      "Core vacancy matching",
      "AI CV parsing",
      "Explainable match scoring",
      "Core recruiter workflow",
    ],
  },
  team: {
    key: "team",
    label: "Team",
    description: "For growing recruitment teams",
    trialDays: 0,
    features: [
      "Everything in Starter",
      "More users",
      "Alert rules",
      "CRM sync",
      "Compliance & audit logs",
    ],
  },
};

export function getPlan(key: string): PlanDef | undefined {
  return PLANS[key];
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
