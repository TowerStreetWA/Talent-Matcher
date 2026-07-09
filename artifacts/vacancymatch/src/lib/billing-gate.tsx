import React from "react";
import { useLocation } from "wouter";
import {
  ApiError,
  useCreateBillingCheckout,
  useListBillingPlans,
  getListBillingPlansQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2 } from "lucide-react";

export const CHECKOUT_RETURN_KEY = "vm_checkout_return";

export function isBillingGateError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}

function extractMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const data: unknown = err.data;
  if (data && typeof data === "object" && "message" in data) {
    const msg = (data as { message: unknown }).message;
    if (typeof msg === "string" && msg.trim() !== "") return msg;
  }
  return null;
}

type GateListener = (message: string | null) => void;
let gateListener: GateListener | null = null;

/**
 * Called from the global react-query MutationCache onError handler.
 * Opens the trial prompt dialog when a write was blocked by the billing
 * gate (HTTP 402). All other errors are ignored here and handled by the
 * pages' own error handling.
 */
export function notifyApiError(err: unknown): void {
  if (!isBillingGateError(err)) return;
  gateListener?.(extractMessage(err));
}

interface BillingGateContextValue {
  promptTrial: (message?: string) => void;
}

const BillingGateContext = React.createContext<BillingGateContextValue>({
  promptTrial: () => {},
});

export function useBillingGate(): BillingGateContextValue {
  return React.useContext(BillingGateContext);
}

export function BillingGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const canManage = user?.role === "owner" || user?.role === "admin";

  const openPrompt = React.useCallback((msg: string | null) => {
    setMessage(msg);
    setOpen(true);
    track("trial_prompt_shown");
  }, []);

  React.useEffect(() => {
    gateListener = openPrompt;
    return () => {
      if (gateListener === openPrompt) gateListener = null;
    };
  }, [openPrompt]);

  const promptTrial = React.useCallback(
    (msg?: string) => openPrompt(msg ?? null),
    [openPrompt],
  );

  const { data: plans } = useListBillingPlans({
    query: { enabled: open && !!user, queryKey: getListBillingPlansQueryKey() },
  });
  // Prefer the entry tier (Solo) for the trial CTA; fall back to any
  // self-serve plan with a monthly price.
  const trialPlan =
    plans?.find((p) => p.key === "solo" && p.trialDays > 0 && p.monthlyPriceId) ??
    plans?.find((p) => p.trialDays > 0 && p.monthlyPriceId) ??
    plans?.find((p) => p.monthlyPriceId);

  const checkout = useCreateBillingCheckout({
    mutation: {
      onSuccess: (data) => {
        track("checkout_started");
        window.location.href = data.url;
      },
      onError: (err: unknown) => {
        toast({
          title: "Could not start checkout",
          description:
            err && typeof err === "object" && "message" in err
              ? String((err as { message: unknown }).message)
              : "Please try again from the Billing page.",
          variant: "destructive",
        });
      },
    },
  });

  // Remember where the user was so we can send them back after the trial
  // starts (read on the Billing page after the Stripe checkout redirect).
  const rememberReturnPath = React.useCallback(() => {
    if (location && location !== "/billing") {
      sessionStorage.setItem(CHECKOUT_RETURN_KEY, location);
    }
  }, [location]);

  const startTrial = () => {
    if (!trialPlan) return;
    rememberReturnPath();
    track("trial_prompt_checkout_started", { plan: trialPlan.key });
    checkout.mutate({
      data: { planKey: trialPlan.key, billingInterval: "month" },
    });
  };

  const viewPlans = () => {
    rememberReturnPath();
    setOpen(false);
    setLocation("/billing");
  };

  const contextValue = React.useMemo(() => ({ promptTrial }), [promptTrial]);

  return (
    <BillingGateContext.Provider value={contextValue}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Start your free trial
            </DialogTitle>
            <DialogDescription>
              {message ??
                "Start your free trial to unlock CV uploads, matching, and recruiter actions."}
            </DialogDescription>
          </DialogHeader>

          {canManage ? (
            trialPlan && (
              <ul className="text-sm space-y-1.5">
                {trialPlan.trialDays > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    {trialPlan.trialDays}-day free {trialPlan.label} trial — no card
                    required
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  Full access to uploads, matching, and alerts
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  Cancel anytime
                </li>
              </ul>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Ask a workspace admin or owner to start the trial — they can do it from the
              Billing page in a few clicks.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={viewPlans}>
              View plans
            </Button>
            {canManage && (
              <Button
                onClick={startTrial}
                disabled={!trialPlan || checkout.isPending}
              >
                {checkout.isPending
                  ? "Redirecting…"
                  : trialPlan && trialPlan.trialDays > 0
                    ? `Start ${trialPlan.trialDays}-day free trial`
                    : "Choose a plan"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BillingGateContext.Provider>
  );
}
