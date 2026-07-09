import { getUncachableStripeClient } from "./stripeClient";
import type Stripe from "stripe";

/**
 * Idempotent Stripe product/price seed for the paid tiers.
 *
 * Prices are GBP. Annual = 10 x monthly (2 months free).
 *  - Core:         £120 / user / month
 *  - Professional: £220 / user / month
 *  - Business:     £450 / month per 5-seat bundle
 *                  + £95 / month per additional seat (separate price on
 *                  the same product, metadata price_component=additional_seat)
 *
 * Legacy products (starter/solo/team/pro_agency) are deactivated so new
 * checkouts never see them; existing subscriptions keep their old prices.
 */

interface PriceSeed {
  /** null = base price (per-user or per-bundle); otherwise component tag. */
  component: "additional_seat" | null;
  monthlyPence: number;
}

interface PlanSeed {
  key: string;
  name: string;
  description: string;
  prices: PriceSeed[];
}

const ANNUAL_MONTHS_CHARGED = 10;
const CURRENCY = "gbp";

const PLANS: PlanSeed[] = [
  {
    key: "core",
    name: "Talent Matcher Core",
    description:
      "For individual recruiters and small boutiques. £120 per user per month. 7-day free trial.",
    prices: [{ component: null, monthlyPence: 12000 }],
  },
  {
    key: "professional",
    name: "Talent Matcher Professional",
    description:
      "For agency desk leads and active recruiters working multiple markets. £220 per user per month. 7-day free trial.",
    prices: [{ component: null, monthlyPence: 22000 }],
  },
  {
    key: "business",
    name: "Talent Matcher Business",
    description:
      "For agencies rolling Talent Matcher out across multiple desks. £450 per month per 5-seat bundle, £95 per month per additional seat. 7-day free trial.",
    prices: [
      { component: null, monthlyPence: 45000 },
      { component: "additional_seat", monthlyPence: 9500 },
    ],
  },
];

const LEGACY_PLAN_KEYS = ["starter", "solo", "team", "pro_agency"];

async function ensurePrice(
  stripe: Stripe,
  productId: string,
  planKey: string,
  component: "additional_seat" | null,
  interval: "month" | "year",
  amountPence: number,
): Promise<void> {
  const label = `${planKey}${component ? `/${component}` : ""}/${interval}`;
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const existing = prices.data.find(
    (p) =>
      p.recurring?.interval === interval &&
      p.unit_amount === amountPence &&
      p.currency === CURRENCY &&
      (p.metadata["price_component"] ?? null) === (component ?? null),
  );
  if (existing) {
    console.log(`Price ${label} already exists: ${existing.id}`);
    return;
  }
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amountPence,
    currency: CURRENCY,
    recurring: { interval },
    metadata: {
      plan_key: planKey,
      billing_interval: interval,
      ...(component ? { price_component: component } : {}),
    },
  });
  console.log(`Created price ${label}: ${price.id}`);
}

async function deactivateLegacyProducts(stripe: Stripe): Promise<void> {
  for (const key of LEGACY_PLAN_KEYS) {
    const existing = await stripe.products.search({
      query: `metadata['plan_key']:'${key}' AND active:'true'`,
    });
    for (const product of existing.data) {
      // Deactivate prices first (products with active prices can still be
      // archived, but tidy prices keep the dashboard clear). Existing
      // subscriptions are unaffected.
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 100,
      });
      for (const price of prices.data) {
        await stripe.prices.update(price.id, { active: false });
        console.log(`Deactivated legacy price ${key}: ${price.id}`);
      }
      await stripe.products.update(product.id, { active: false });
      console.log(`Deactivated legacy product ${key}: ${product.id}`);
    }
  }
}

async function main(): Promise<void> {
  const stripe = await getUncachableStripeClient();

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `metadata['plan_key']:'${plan.key}' AND active:'true'`,
    });

    let productId: string;
    if (existing.data.length > 0 && existing.data[0]) {
      productId = existing.data[0].id;
      console.log(`Product for ${plan.key} already exists: ${productId}`);
      // Keep name/description in sync with the pricing config.
      await stripe.products.update(productId, {
        name: plan.name,
        description: plan.description,
      });
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { plan_key: plan.key },
      });
      productId = product.id;
      console.log(`Created product for ${plan.key}: ${productId}`);
    }

    for (const price of plan.prices) {
      await ensurePrice(
        stripe,
        productId,
        plan.key,
        price.component,
        "month",
        price.monthlyPence,
      );
      await ensurePrice(
        stripe,
        productId,
        plan.key,
        price.component,
        "year",
        price.monthlyPence * ANNUAL_MONTHS_CHARGED,
      );
    }
  }

  await deactivateLegacyProducts(stripe);

  console.log("Stripe product seed complete.");
}

main().catch((err) => {
  console.error("Stripe product seed failed:", err);
  process.exit(1);
});
