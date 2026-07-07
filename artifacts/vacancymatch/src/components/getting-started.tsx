import React from "react";
import { useLocation } from "wouter";
import {
  useGetBillingSubscription,
  useGetDashboardSummary,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useBillingGate } from "@/lib/billing-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Rocket, X } from "lucide-react";

interface Step {
  key: string;
  title: string;
  description: string;
  done: boolean;
  action: () => void;
  actionLabel: string;
}

function dismissKey(tenantId: string | undefined): string {
  return `vm_getting_started_dismissed:${tenantId ?? "unknown"}`;
}

export default function GettingStarted() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { promptTrial } = useBillingGate();
  const { data: summary } = useGetDashboardSummary();
  const { data: subscription } = useGetBillingSubscription();

  const [dismissed, setDismissed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(dismissKey(user?.tenantId)) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed || !summary || !subscription) return null;

  const steps: Step[] = [
    {
      key: "trial",
      title: "Start your free trial",
      description: "Unlock CV uploads, matching, and recruiter actions — no card required.",
      done: subscription.canUseCoreProduct,
      action: () => promptTrial(),
      actionLabel: "Start free trial",
    },
    {
      key: "source",
      title: "Add a job source",
      description: "Connect where your live vacancies come from.",
      done: summary.activeSourceCount > 0,
      action: () => setLocation("/sources"),
      actionLabel: "Add a source",
    },
    {
      key: "cv",
      title: "Upload your first CV",
      description: "We'll parse it into a candidate profile and match it against live jobs.",
      done: summary.candidateCount > 0,
      action: () => setLocation("/upload"),
      actionLabel: "Upload a CV",
    },
    {
      key: "review",
      title: "Review your matches",
      description: "Shortlist your first match to complete setup.",
      done: summary.shortlistedCount > 0,
      action: () => setLocation("/matches"),
      actionLabel: "Review matches",
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  const primaryIndex = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(user?.tenantId), "1");
    } catch {
      // localStorage unavailable — dismiss for this session only
    }
    setDismissed(true);
  };

  return (
    <Card className="border-primary/30" data-testid="getting-started-panel">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Rocket className="w-5 h-5 text-primary" /> Get set up
          </CardTitle>
          <CardDescription className="mt-1">
            {doneCount} of {steps.length} steps complete
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={dismiss}
          aria-label="Hide getting started"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.map((step, i) => {
          const isPrimary = i === primaryIndex;
          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${
                isPrimary ? "bg-primary/5 border border-primary/20" : ""
              }`}
              data-testid={`getting-started-step-${step.key}`}
            >
              {step.done ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <Circle
                  className={`w-5 h-5 shrink-0 ${
                    isPrimary ? "text-primary" : "text-muted-foreground/40"
                  }`}
                />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.done
                      ? "text-muted-foreground line-through"
                      : isPrimary
                        ? ""
                        : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </p>
                {isPrimary && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                )}
              </div>
              {isPrimary && (
                <Button size="sm" onClick={step.action} className="shrink-0">
                  {step.actionLabel}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
