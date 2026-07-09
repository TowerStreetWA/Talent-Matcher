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
  demoMailtoHref,
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
        <h1 className="font-serif text-3xl md:text-4xl font-medium tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Three paid tiers, billed in GBP. Core and Professional are priced
          per user; Business is priced per 5-seat bundle with additional
          seats as you grow. Every plan starts with a 7-day free trial — no
          card required.
        </p>
        <div className="pt-2">
          <IntervalToggle value={interval} onChange={setInterval} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {(plans ?? []).map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              interval={interval}
              highlight={plan.key === "professional"}
              cta={
                user ? (
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

      <div className="text-xs text-muted-foreground text-center max-w-2xl mx-auto space-y-1">
        <p>
          Annual billing gives you 2 months free (pay for 10 months per year).
        </p>
        <p>
          Business example: 10 users = 2 × 5-seat bundles = £900/month — or 1
          bundle + 5 additional seats (£925/month) if you prefer to grow seat
          by seat.
        </p>
        <p>
          Questions about rollout, custom sources or larger teams?{" "}
          <a
            href={demoMailtoHref("Talent Matcher — pricing enquiry")}
            className="underline hover:text-foreground"
            onClick={() => track("pricing_contact_clicked")}
          >
            Get in touch
          </a>
          .
        </p>
      </div>
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
            Talent Matcher
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <a href={demoMailtoHref()}>
                <Mail className="w-4 h-4 mr-2" /> Book a demo
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-10 md:py-14">{content}</main>
    </div>
  );
}
