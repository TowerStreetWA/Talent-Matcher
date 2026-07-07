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
  getPriceIdForPlan,
  listPlansWithPrices,
  syncTenantBilling,
  toBillingState,
} from "../lib/billing/service";
import { getPlan } from "../lib/billing/plans";
import { requireRole, tenantOf, auditActor } from "../middlewares/auth";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

function appBaseUrl(): string {
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (!domain) {
    throw new Error("REPLIT_DOMAINS is not set; cannot build redirect URLs");
  }
  return `https://${domain}`;
}

router.get("/billing/plans", async (_req, res): Promise<void> => {
  const plans = await listPlansWithPrices();
  res.json(ListBillingPlansResponse.parse(plans));
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
    const priceId = await getPriceIdForPlan(plan.key);
    if (!priceId) {
      res.status(400).json({
        message:
          "This plan has no Stripe price configured yet. Run the product seed script first.",
      });
      return;
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
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appBaseUrl()}/billing?checkout=success`,
      cancel_url: `${appBaseUrl()}/billing?checkout=canceled`,
      subscription_data: {
        metadata: { tenant_slug: tenantSlug, plan_key: plan.key },
        ...(plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
      },
      ...(plan.trialDays > 0
        ? { payment_method_collection: "if_required" as const }
        : {}),
    });

    if (!session.url) {
      res.status(500).json({ message: "Stripe did not return a checkout URL" });
      return;
    }

    await recordAudit({
      action: "billing.checkout_created",
      entityType: "billing",
      entityId: session.id,
      metadata: `Checkout session created for plan ${plan.key}${plan.trialDays > 0 ? ` with ${plan.trialDays}-day trial` : ""}`,
      ...auditActor(req),
    });

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
