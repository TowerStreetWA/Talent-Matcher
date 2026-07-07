import React from "react";
import { Link } from "wouter";
import { useListBillingPlans } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IntervalToggle,
  PlanCard,
  enterpriseMailtoHref,
  type BillingIntervalChoice,
} from "@/components/plan-cards";
import { Target, Mail } from "lucide-react";

export default function Pricing() {
  const { user } = useAuth();
  const [interval, setInterval] = React.useState<BillingIntervalChoice>("month");
  const { data: plans, isLoading } = useListBillingPlans();

  React.useEffect(() => {
    track("pricing_page_viewed", { loggedIn: !!user });
  }, [user]);

  const content = (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Simple, per-user pricing
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Every self-serve plan starts with a 7-day free trial — no card
          required. Prices are per user, per month, billed in GBP.
        </p>
        <div className="pt-2">
          <IntervalToggle value={interval} onChange={setInterval} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {(plans ?? []).map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              interval={interval}
              highlight={plan.key === "team"}
              cta={
                plan.contactOnly ? (
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href={enterpriseMailtoHref()}
                      onClick={() => track("enterprise_contact_clicked")}
                    >
                      <Mail className="w-4 h-4 mr-2" /> Talk to us
                    </a>
                  </Button>
                ) : user ? (
                  <Button asChild className="w-full">
                    <Link href="/billing">Choose {plan.label}</Link>
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link href="/signup">
                      Start {plan.trialDays}-day free trial
                    </Link>
                  </Button>
                )
              }
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">
        Annual billing gives you 2 months free (pay for 10 months per year).
        Enterprise pricing is quote-based and can include custom sources,
        integrations, onboarding and compliance support.
      </p>
    </div>
  );

  if (user) {
    // Rendered inside the app layout for logged-in users.
    return <div className="max-w-7xl">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Target className="w-5 h-5 text-primary" />
            VacancyMatch AI
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-10 md:py-14">{content}</main>
    </div>
  );
}
