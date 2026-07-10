import React from "react";
import { Link } from "wouter";
import { useListBillingPlans } from "@workspace/api-client-react";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IntervalToggle,
  PlanCard,
  demoMailtoHref,
  SALES_CONTACT_EMAIL,
  type BillingIntervalChoice,
} from "@/components/plan-cards";
import {
  Target,
  Mail,
  Search,
  Building2,
  Filter,
  BellRing,
  FileText,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: Building2,
    title: "Direct-employer-first search",
    body: "Jobs sourced from employer careers sites, ATS boards and curated directories — recruitment-firm ads are filtered out by default, so you see the roles your clients are actually hiring for.",
  },
  {
    icon: Search,
    title: "Built for financial services & tech",
    body: "Deep taxonomy across Insurance, Banking, Pensions, Asset Management, Accountancy & Finance and IT & Technology — with sector and function tags on every role.",
  },
  {
    icon: FileText,
    title: "AI CV parsing & matching",
    body: "Upload a CV and get an explainable, weighted match against live vacancies — skills, title, sector, location and compensation, with the reasoning shown for every score.",
  },
  {
    icon: Filter,
    title: "Recruiter filtering you control",
    body: "One toggle to include or exclude agency-posted roles. Family and sector chips to slice a market in seconds.",
  },
  {
    icon: BellRing,
    title: "Saved searches & alerts",
    body: "Save any search and get alerted when new matching roles appear — every 15 minutes, honouring your exact filters.",
  },
  {
    icon: Users,
    title: "Team workspaces",
    body: "Shared candidates, matches and sources across your desk, with roles and permissions, audit trails and CRM push.",
  },
];

const SECTORS = [
  "Insurance",
  "Banking",
  "Pensions",
  "Asset Management",
  "Accountancy & Finance",
  "IT & Technology",
];

export default function Landing() {
  const [interval, setInterval] = React.useState<BillingIntervalChoice>("month");
  const { data: plans, isLoading } = useListBillingPlans();

  React.useEffect(() => {
    track("landing_page_viewed");
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold">
            <Target className="w-5 h-5 text-primary" />
            Talent Matcher
          </span>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href="#pricing">Pricing</a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <a
                href={demoMailtoHref()}
                onClick={() => track("landing_demo_clicked", { where: "header" })}
              >
                <Mail className="w-4 h-4 mr-2" /> Book a demo
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 text-center space-y-6">
            <Badge variant="secondary" className="text-xs">
              Built for specialist recruiters
            </Badge>
            <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight max-w-3xl mx-auto">
              Find the roles employers are actually hiring for — before the
              rest of the market
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Talent Matcher indexes live vacancies straight from employer
              careers sites and ATS boards across financial services and
              technology, then matches your candidates against them with
              explainable AI scoring.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <a
                  href={demoMailtoHref()}
                  onClick={() => track("landing_demo_clicked", { where: "hero" })}
                >
                  <Mail className="w-4 h-4 mr-2" /> Book a demo
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#pricing">See pricing</a>
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {SECTORS.map((s) => (
                <Badge key={s} variant="outline" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-7xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center space-y-3 mb-10">
            <h2 className="font-serif text-3xl font-medium tracking-tight">
              A recruiter's daily workflow, sharpened
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From vacancy discovery to candidate matching to client delivery —
              everything sits in one tenant-scoped workspace.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardContent className="pt-6 space-y-2">
                  <f.icon className="w-6 h-6 text-primary" />
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 py-16 md:py-20 space-y-8">
            <div className="text-center space-y-3">
              <h2 className="font-serif text-3xl font-medium tracking-tight">
                Simple, transparent pricing
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Talent Matcher is a paid platform built for specialist
                recruiters who need cleaner live vacancy coverage, stronger
                direct-employer visibility, and ongoing market refresh across
                key sectors. Core gives you search, Professional gives you
                market visibility, and Business gives your wider team shared
                intelligence and control.
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
                      <Button asChild className="w-full">
                        <a
                          href={demoMailtoHref(
                            `Talent Matcher — ${plan.label} plan enquiry`,
                          )}
                          onClick={() =>
                            track("landing_plan_contact_clicked", {
                              plan: plan.key,
                            })
                          }
                        >
                          <Mail className="w-4 h-4 mr-2" /> Book a demo
                        </a>
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
            <div className="rounded-lg border bg-background p-6 max-w-2xl mx-auto text-center space-y-2">
              <p className="text-sm font-semibold">
                Example pilot offer — 5-seat Professional pilot: £1,100 / month
              </p>
              <p className="text-sm text-muted-foreground">
                A practical starting point for a specialist agency is a 5-seat
                Professional pilot for Banking and Insurance teams — sector
                scorecards, recruiter filtering, alerts, and multi-desk
                visibility from day one, while keeping rollout manageable.
              </p>
              <Button asChild size="sm" variant="outline">
                <a
                  href={demoMailtoHref(
                    "Talent Matcher — 5-seat Professional pilot",
                  )}
                  onClick={() => track("landing_pilot_clicked")}
                >
                  <Mail className="w-4 h-4 mr-2" /> Ask about the pilot
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">
              Annual billing gives you 2 months free (pay for 10 months per
              year).
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">Talent Matcher</span>
            <span>— employer-first recruiting intelligence</span>
          </span>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
            <a
              href={demoMailtoHref()}
              className="hover:text-foreground"
              onClick={() => track("landing_demo_clicked", { where: "footer" })}
            >
              {SALES_CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
