import React from "react";
import type { BillingPlan } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type BillingIntervalChoice = "month" | "year";

/** Enterprise is contact-only — no Stripe checkout. */
export const ENTERPRISE_CONTACT_EMAIL = "sales@vacancymatch.ai";

export function enterpriseMailtoHref(): string {
  const subject = encodeURIComponent("VacancyMatch AI — Enterprise enquiry");
  const body = encodeURIComponent(
    "Hi,\n\nWe're interested in the Enterprise plan. Our team size is roughly ___ and we'd like to discuss requirements and pricing.\n\nThanks,",
  );
  return `mailto:${ENTERPRISE_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export function formatPlanPrice(
  pence: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (pence == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (currency ?? "gbp").toUpperCase(),
    minimumFractionDigits: 0,
  }).format(pence / 100);
}

export function planAmountFor(
  plan: BillingPlan,
  interval: BillingIntervalChoice,
): number | null {
  return (
    (interval === "year" ? plan.annualUnitAmount : plan.monthlyUnitAmount) ??
    null
  );
}

export function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingIntervalChoice;
  onChange: (v: BillingIntervalChoice) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-1 text-sm">
      <button
        type="button"
        onClick={() => onChange("month")}
        className={cn(
          "px-3 py-1.5 rounded-md transition-colors",
          value === "month"
            ? "bg-background shadow font-medium"
            : "text-muted-foreground",
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("year")}
        className={cn(
          "px-3 py-1.5 rounded-md transition-colors flex items-center gap-2",
          value === "year"
            ? "bg-background shadow font-medium"
            : "text-muted-foreground",
        )}
      >
        Annual
        <Badge variant="secondary" className="text-xs px-1.5">
          2 months free
        </Badge>
      </button>
    </div>
  );
}

export function PlanCard({
  plan,
  interval,
  isCurrent,
  highlight,
  cta,
}: {
  plan: BillingPlan;
  interval: BillingIntervalChoice;
  isCurrent?: boolean;
  highlight?: boolean;
  cta: React.ReactNode;
}) {
  const amount = planAmountFor(plan, interval);
  const priceText = formatPlanPrice(amount, plan.currency);
  const isEnterprise = plan.contactOnly;

  return (
    <Card
      className={cn(
        "flex flex-col",
        isCurrent && "border-primary",
        highlight && !isCurrent && "border-primary/60 shadow-md",
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            {plan.key === "solo" && <Sparkles className="w-4 h-4 text-primary" />}
            {isEnterprise && <Building2 className="w-4 h-4 text-primary" />}
            {plan.label}
          </span>
          <span className="flex items-center gap-1.5">
            {highlight && !isCurrent && <Badge>Most popular</Badge>}
            {isCurrent && <Badge>Current plan</Badge>}
          </span>
        </CardTitle>
        <CardDescription>{plan.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 space-y-4">
        <div>
          <div className="flex items-baseline gap-1 flex-wrap">
            {isEnterprise && (
              <span className="text-sm text-muted-foreground">from</span>
            )}
            <span className="text-3xl font-bold">{priceText}</span>
            <span className="text-muted-foreground text-sm">
              {isEnterprise
                ? ` / ${interval === "year" ? "year" : "month"}`
                : ` / user / ${interval === "year" ? "year" : "month"}`}
            </span>
          </div>
          {!isEnterprise && interval === "year" && (
            <p className="text-sm text-muted-foreground mt-1">
              Billed annually — 2 months free vs monthly
            </p>
          )}
          {isEnterprise ? (
            <p className="text-sm text-muted-foreground mt-1">
              Quote-based — talk to us
            </p>
          ) : (
            plan.trialDays > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {plan.trialDays}-day free trial — no card required
              </p>
            )
          )}
        </div>
        <ul className="text-sm space-y-1.5 flex-1">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {cta}
      </CardContent>
    </Card>
  );
}
