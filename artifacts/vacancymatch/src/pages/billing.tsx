import React from "react";
import {
  useListBillingPlans,
  useGetBillingSubscription,
  useCreateBillingCheckout,
  useCreateBillingPortal,
  getGetBillingSubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { CHECKOUT_RETURN_KEY } from "@/lib/billing-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, CheckCircle2, AlertTriangle, ExternalLink, Mail } from "lucide-react";
import { format } from "date-fns";
import {
  IntervalToggle,
  PlanCard,
  businessBreakdown,
  additionalSeatAmountFor,
  planAmountFor,
  formatPlanPrice,
  type BillingIntervalChoice,
} from "@/components/plan-cards";
import { Input } from "@/components/ui/input";

function statusBadge(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (status) {
    case "active":
      return { label: "Active", variant: "default" };
    case "trialing":
      return { label: "Free trial", variant: "default" };
    case "past_due":
      return { label: "Past due", variant: "destructive" };
    case "canceled":
      return { label: "Canceled", variant: "destructive" };
    case "unpaid":
      return { label: "Unpaid", variant: "destructive" };
    case "none":
      return { label: "No subscription", variant: "secondary" };
    default:
      return { label: status, variant: "outline" };
  }
}

export default function Billing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const canManage = user?.role === "owner" || user?.role === "admin";
  const [billingInterval, setBillingInterval] = React.useState<BillingIntervalChoice>("month");
  const [businessSeats, setBusinessSeats] = React.useState(5);

  React.useEffect(() => {
    track("billing_page_viewed");
  }, []);

  const { data: subscription, isLoading: loadingSub } = useGetBillingSubscription();
  const { data: plans, isLoading: loadingPlans } = useListBillingPlans();

  const checkout = useCreateBillingCheckout({
    mutation: {
      onSuccess: (data) => {
        track("checkout_started");
        window.location.href = data.url;
      },
    },
  });
  const portal = useCreateBillingPortal({
    mutation: {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    },
  });

  const params = new URLSearchParams(window.location.search);
  const checkoutResult = params.get("checkout");

  React.useEffect(() => {
    if (checkoutResult === "success") {
      const timer = setInterval(() => {
        void queryClient.invalidateQueries({
          queryKey: getGetBillingSubscriptionQueryKey(),
        });
      }, 3000);
      const stop = setTimeout(() => clearInterval(timer), 30000);
      return () => {
        clearInterval(timer);
        clearTimeout(stop);
      };
    }
    return undefined;
  }, [checkoutResult, queryClient]);

  // If the user was interrupted mid-action by the billing gate, send them
  // back to what they were doing once the trial/subscription is confirmed.
  const canUseCore = subscription?.canUseCoreProduct === true;
  React.useEffect(() => {
    if (checkoutResult === "canceled") {
      sessionStorage.removeItem(CHECKOUT_RETURN_KEY);
      return;
    }
    if (checkoutResult === "success" && canUseCore) {
      const returnTo = sessionStorage.getItem(CHECKOUT_RETURN_KEY);
      if (returnTo && returnTo.startsWith("/") && returnTo !== "/billing") {
        sessionStorage.removeItem(CHECKOUT_RETURN_KEY);
        setLocation(returnTo);
      }
    }
  }, [checkoutResult, canUseCore, setLocation]);

  const status = subscription?.status ?? "none";
  const badge = statusBadge(status);
  const restricted = subscription ? !subscription.canUseCoreProduct : false;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and plan for {user?.tenantName ?? "your workspace"}.
        </p>
      </div>

      {checkoutResult === "success" && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <span>
              Checkout complete. Your subscription will activate within a few moments once Stripe
              confirms it.
            </span>
          </CardContent>
        </Card>
      )}
      {checkoutResult === "canceled" && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <span>Checkout was canceled. You have not been charged.</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5 text-primary" /> Current subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSub ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {subscription?.planLabel && (
                  <span className="font-medium">{subscription.planLabel} plan</span>
                )}
                {subscription?.cancelAtPeriodEnd && (
                  <Badge variant="outline">Cancels at period end</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                {status === "trialing" && subscription?.trialEndsAt && (
                  <p>
                    Free trial ends{" "}
                    <span className="font-medium text-foreground">
                      {format(new Date(subscription.trialEndsAt), "PPP")}
                    </span>
                    . Add a payment method before then to keep full access.
                  </p>
                )}
                {subscription?.currentPeriodEnd && status !== "trialing" && (
                  <p>
                    Current period ends {format(new Date(subscription.currentPeriodEnd), "PPP")}.
                  </p>
                )}
                {status === "none" && (
                  <p>
                    You don't have a subscription yet. Start a free trial below to unlock CV
                    uploads, matching, and recruiter actions.
                  </p>
                )}
                {restricted && status !== "none" && (
                  <p className="text-destructive">
                    Your subscription is inactive. Core actions are disabled until you reactivate
                    your plan.
                  </p>
                )}
              </div>
              {canManage && subscription && status !== "none" && (
                <Button
                  variant="outline"
                  onClick={() => portal.mutate()}
                  disabled={portal.isPending}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {portal.isPending ? "Opening portal…" : "Manage billing in Stripe"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">Plans</h2>
          <IntervalToggle value={billingInterval} onChange={setBillingInterval} />
        </div>
        {loadingPlans ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {(plans ?? []).map((plan) => {
              const isCurrent = subscription?.planKey === plan.key && !restricted;
              const priceIdForInterval =
                billingInterval === "year" ? plan.annualPriceId : plan.monthlyPriceId;
              const isBundle = plan.pricingModel === "seat_bundle";
              const bundleSeatSize = plan.bundleSeats ?? 5;
              const breakdown = isBundle
                ? businessBreakdown(businessSeats, bundleSeatSize)
                : null;
              const baseAmount = planAmountFor(plan, billingInterval);
              const seatAmount = additionalSeatAmountFor(plan, billingInterval);
              const bundleTotal =
                breakdown && baseAmount != null
                  ? breakdown.bundles * baseAmount +
                    breakdown.additionalSeats * (seatAmount ?? 0)
                  : null;
              return (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  interval={billingInterval}
                  isCurrent={isCurrent}
                  highlight={plan.key === "professional"}
                  cta={
                    canManage ? (
                      <div className="space-y-3">
                        {isBundle && (
                          <div className="space-y-1.5">
                            <label
                              htmlFor="business-seats"
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Team size (seats)
                            </label>
                            <Input
                              id="business-seats"
                              type="number"
                              min={bundleSeatSize}
                              max={500}
                              value={businessSeats}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v)) {
                                  setBusinessSeats(Math.floor(v));
                                }
                              }}
                              onBlur={() =>
                                setBusinessSeats((s) =>
                                  Math.min(500, Math.max(bundleSeatSize, s)),
                                )
                              }
                            />
                            {breakdown && bundleTotal != null && (
                              <p className="text-xs text-muted-foreground">
                                {breakdown.bundles} × {bundleSeatSize}-seat bundle
                                {breakdown.bundles > 1 ? "s" : ""}
                                {breakdown.additionalSeats > 0
                                  ? ` + ${breakdown.additionalSeats} additional seat${breakdown.additionalSeats > 1 ? "s" : ""}`
                                  : ""}{" "}
                                ={" "}
                                <span className="font-medium text-foreground">
                                  {formatPlanPrice(bundleTotal, plan.currency)} /{" "}
                                  {billingInterval === "year" ? "year" : "month"}
                                </span>
                              </p>
                            )}
                          </div>
                        )}
                        <Button
                          className="w-full"
                          variant={isCurrent ? "outline" : "default"}
                          disabled={
                            checkout.isPending ||
                            isCurrent ||
                            !priceIdForInterval ||
                            (isBundle && businessSeats < bundleSeatSize)
                          }
                          onClick={() =>
                            checkout.mutate({
                              data: {
                                planKey: plan.key,
                                billingInterval: billingInterval,
                                ...(isBundle ? { seats: businessSeats } : {}),
                              },
                            })
                          }
                        >
                          {isCurrent
                            ? "Current plan"
                            : checkout.isPending
                              ? "Redirecting…"
                              : plan.trialDays > 0 && status === "none"
                                ? `Start ${plan.trialDays}-day free trial`
                                : `Choose ${plan.label}`}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Ask a workspace admin or owner to manage the subscription.
                      </p>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
