import { Router, type IRouter } from "express";
import {
  CreateBillingCheckoutBody,
  CreateBillingCheckoutResponse,
  CreateBillingPortalResponse,
  GetBillingSubscriptionResponse,
  ListBillingPlansResponse,
} from "@workspace/api-zod";
import { getUncachableStripeClient } from "../lib/stripeClient";
import {
  ensureStripeCustomer,
  getBillingRow,
  getPlanWithPrices,
  listPlansWithPrices,
  redactContactOnlyPlan,
  syncTenantBilling,
  toBillingState,
} from "../lib/billing/service";
import {
  getPlan,
  computeBusinessSeatBreakdown,
  type BillingInterval,
} from "../lib/billing/plans";
import { requireRole, tenantOf, auditActor } from "../middlewares/auth";
import { recordAudit } from "../lib/audit";
import { sendEmail, checkoutStartedEmailHtml } from "../lib/email";

const router: IRouter = Router();

/**
 * Public billing routes (no auth): the pricing page is public, so plan
 * definitions + prices must be readable before login. Mounted BEFORE
 * requireAuth in routes/index.ts. Contains no tenant data.
 */
export const publicBillingRouter: IRouter = Router();

function appBaseUrl(): string {
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (!domain) {
    throw new Error("REPLIT_DOMAINS is not set; cannot build redirect URLs");
  }
  return `https://${domain}`;
}

publicBillingRouter.get("/billing/plans", async (_req, res): Promise<void> => {
  const plans = await listPlansWithPrices();
  // Contact-only tiers (Business: team rollout pricing) are not publicly
  // priced — redact price IDs/amounts from this public endpoint. The
  // internal seat-bundle rates stay in config for quotes and existing
  // subscriptions.
  res.json(ListBillingPlansResponse.parse(plans.map(redactContactOnlyPlan)));
});

router.get("/billing/subscription", async (req, res): Promise<void> => {
  const row = await syncTenantBilling(tenantOf(req));
  res.json(GetBillingSubscriptionResponse.parse(toBillingState(row)));
});

router.post(
  "/billing/checkout",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateBillingCheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "planKey is required" });
      return;
    }
    const plan = getPlan(parsed.data.planKey);
    if (!plan) {
      res.status(400).json({ message: "Unknown plan" });
      return;
    }
    if (plan.contactOnly) {
      res.status(400).json({
        message: "This plan is quote-based. Contact us to set up your plan.",
      });
      return;
    }
    const billingInterval: BillingInterval =
      parsed.data.billingInterval === "year" ? "year" : "month";
    const seats = parsed.data.seats ?? plan.softCaps.seatMinimum;
    if (!Number.isInteger(seats)) {
      res.status(400).json({ message: "seats must be a whole number" });
      return;
    }
    if (seats < plan.softCaps.seatMinimum) {
      res.status(400).json({
        message: `${plan.label} requires at least ${plan.softCaps.seatMinimum} seats.`,
      });
      return;
    }

    const priced = await getPlanWithPrices(plan.key);
    const basePriceId =
      billingInterval === "year" ? priced?.annualPriceId : priced?.monthlyPriceId;
    if (!priced || !basePriceId) {
      res.status(400).json({
        message:
          "This plan has no Stripe price configured yet. Run the product seed script first.",
      });
      return;
    }

    let lineItems: Array<{ price: string; quantity: number }>;
    if (plan.pricingModel === "seat_bundle") {
      const breakdown = computeBusinessSeatBreakdown(seats);
      lineItems = [{ price: basePriceId, quantity: breakdown.bundles }];
      if (breakdown.additionalSeats > 0) {
        const seatPriceId =
          billingInterval === "year"
            ? priced.additionalSeatAnnualPriceId
            : priced.additionalSeatMonthlyPriceId;
        if (!seatPriceId) {
          res.status(400).json({
            message:
              "The additional-seat price is not configured yet. Run the product seed script first.",
          });
          return;
        }
        lineItems.push({
          price: seatPriceId,
          quantity: breakdown.additionalSeats,
        });
      }
    } else {
      lineItems = [{ price: basePriceId, quantity: seats }];
    }

    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const tenantSlug = tenantOf(req);
    const customerId = await ensureStripeCustomer(
      tenantSlug,
      auth.tenantName,
      auth.email,
    );

    const stripe = await getUncachableStripeClient();
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: lineItems,
        success_url: `${appBaseUrl()}/billing?checkout=success`,
        cancel_url: `${appBaseUrl()}/billing?checkout=canceled`,
        subscription_data: {
          metadata: {
            tenant_slug: tenantSlug,
            plan_key: plan.key,
            billing_interval: billingInterval,
            seats: String(seats),
          },
          ...(plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
        },
        ...(plan.trialDays > 0
          ? { payment_method_collection: "if_required" as const }
          : {}),
      });
    } catch (err) {
      // Surface Stripe's own validation errors (e.g. a legacy customer
      // with a subscription in another currency) as a 400 instead of a
      // generic 500. Existing subscribers change plans via the portal.
      const type =
        err && typeof err === "object" && "type" in err
          ? (err as { type?: string }).type
          : undefined;
      if (type === "StripeInvalidRequestError") {
        req.log.warn(
          { err, planKey: plan.key, billingInterval },
          "Stripe rejected checkout session",
        );
        res.status(400).json({
          message:
            "Stripe could not start this checkout. If you already have a subscription, use “Manage billing in Stripe” to change your plan instead.",
        });
        return;
      }
      throw err;
    }

    if (!session.url) {
      res.status(500).json({ message: "Stripe did not return a checkout URL" });
      return;
    }

    await recordAudit({
      action: "billing.checkout_created",
      entityType: "billing",
      entityId: session.id,
      metadata: `Checkout session created for plan ${plan.key} (${billingInterval === "year" ? "annual" : "monthly"}, ${seats} seat${seats === 1 ? "" : "s"})${plan.trialDays > 0 ? ` with ${plan.trialDays}-day trial` : ""}`,
      ...auditActor(req),
    });

    if (req.auth?.email) {
      const mail = checkoutStartedEmailHtml({
        planName: plan.label,
        trialDays: plan.trialDays,
      });
      // Fire-and-forget: email must not block or fail the checkout response.
      void sendEmail({ to: req.auth.email, ...mail });
    }

    res.json(CreateBillingCheckoutResponse.parse({ url: session.url }));
  },
);

router.post(
  "/billing/portal",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const tenantSlug = tenantOf(req);
    const row = await getBillingRow(tenantSlug);
    if (!row?.stripeCustomerId) {
      res.status(400).json({
        message: "No billing account yet. Start a subscription first.",
      });
      return;
    }
    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: `${appBaseUrl()}/billing`,
    });

    await recordAudit({
      action: "billing.portal_created",
      entityType: "billing",
      entityId: row.stripeCustomerId,
      metadata: "Stripe Customer Portal session created",
      ...auditActor(req),
    });

    res.json(CreateBillingPortalResponse.parse({ url: session.url }));
  },
);

export default router;
