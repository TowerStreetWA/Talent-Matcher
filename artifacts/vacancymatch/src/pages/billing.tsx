import React from "react";
import {
  useListBillingPlans,
  useGetBillingSubscription,
  useCreateBillingCheckout,
  useCreateBillingPortal,
  getGetBillingSubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, CheckCircle2, AlertTriangle, Sparkles, ExternalLink } from "lucide-react";
import { format } from "date-fns";

function formatPrice(unitAmount: number | null | undefined, currency: string | null | undefined): string {
  if (unitAmount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency ?? "usd").toUpperCase(),
    minimumFractionDigits: 0,
  }).format(unitAmount / 100);
}

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
  const canManage = user?.role === "owner" || user?.role === "admin";

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

  const status = subscription?.status ?? "none";
  const badge = statusBadge(status);
  const restricted = subscription ? !subscription.canUseCoreProduct : false;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and plan for {user?.tenantName ?? "your workspace"}.
        </p>
      </div>

      {checkoutResult === "success" && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <span>
              Checkout complete. Your subscription will activate within a few moments once Stripe
              confirms it.
            </span>
          </CardContent>
        </Card>
      )}
      {checkoutResult === "canceled" && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
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
        <h2 className="text-xl font-semibold mb-3">Plans</h2>
        {loadingPlans ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {(plans ?? []).map((plan) => {
              const isCurrent = subscription?.planKey === plan.key && !restricted;
              return (
                <Card key={plan.key} className={isCurrent ? "border-primary" : undefined}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        {plan.key === "starter" && <Sparkles className="w-4 h-4 text-primary" />}
                        {plan.label}
                      </span>
                      {isCurrent && <Badge>Current plan</Badge>}
                    </CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-3xl font-bold">
                        {formatPrice(plan.unitAmount, plan.currency)}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {" "}
                        / {plan.interval ?? "month"}
                      </span>
                      {plan.trialDays > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {plan.trialDays}-day free trial — no card required
                        </p>
                      )}
                    </div>
                    <ul className="text-sm space-y-1.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    {canManage ? (
                      <Button
                        className="w-full"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={checkout.isPending || isCurrent || !plan.priceId}
                        onClick={() => checkout.mutate({ data: { planKey: plan.key } })}
                      >
                        {isCurrent
                          ? "Current plan"
                          : checkout.isPending
                            ? "Redirecting…"
                            : plan.trialDays > 0 && status === "none"
                              ? `Start ${plan.trialDays}-day free trial`
                              : `Choose ${plan.label}`}
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Ask a workspace admin or owner to manage the subscription.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
