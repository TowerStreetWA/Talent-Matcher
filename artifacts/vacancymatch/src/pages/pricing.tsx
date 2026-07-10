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
          Talent Matcher is a paid platform built for specialist recruiters
          who need cleaner live vacancy coverage, stronger direct-employer
          visibility, and ongoing market refresh across key sectors. Pricing
          reflects the depth of the source engine, employer-directory
          coverage, and the operational work involved in keeping results
          current.
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
                plan.contactOnly ? (
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href={demoMailtoHref(
                        "Talent Matcher — Business team rollout enquiry",
                      )}
                      onClick={() => track("pricing_contact_clicked")}
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

      <div className="rounded-lg border bg-muted/40 p-6 max-w-2xl mx-auto text-center space-y-2">
        <p className="text-sm font-semibold">
          Example pilot offer — 5-seat Professional pilot: £1,100 / month
        </p>
        <p className="text-sm text-muted-foreground">
          A practical starting point for a specialist agency is a 5-seat
          Professional pilot for Banking and Insurance teams. That gives
          recruiters sector scorecards, recruiter filtering, alerts, and
          multi-desk visibility from day one, while keeping rollout
          manageable — a structured pilot for teams that want to test Talent
          Matcher in live desk conditions before wider rollout.
        </p>
        <Button asChild size="sm" variant="outline">
          <a
            href={demoMailtoHref("Talent Matcher — 5-seat Professional pilot")}
            onClick={() => track("pricing_pilot_clicked")}
          >
            <Mail className="w-4 h-4 mr-2" /> Ask about the pilot
          </a>
        </Button>
      </div>

      <div className="text-xs text-muted-foreground text-center max-w-2xl mx-auto space-y-1">
        <p>
          The ladder is simple: Core gives you search, Professional gives you
          market visibility, and Business gives your wider team shared
          intelligence and control.
        </p>
        <p>
          Annual billing gives you 2 months free (pay for 10 months per year).
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
