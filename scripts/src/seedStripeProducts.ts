import { getUncachableStripeClient } from "./stripeClient";
import type Stripe from "stripe";

/**
 * Idempotent Stripe product/price seed for the self-serve tiers.
 * Enterprise is contact-only and deliberately has NO Stripe product.
 *
 * Prices are GBP per user. Annual = 10 x monthly (2 months free).
 * Old USD starter/team prices are left untouched — existing
 * subscriptions keep them; new checkouts only use GBP prices.
 */

interface PlanSeed {
  key: string;
  name: string;
  description: string;
  monthlyPence: number;
}

const ANNUAL_MONTHS_CHARGED = 10;
const CURRENCY = "gbp";

const PLANS: PlanSeed[] = [
  {
    key: "solo",
    name: "VacancyMatch Solo",
    description: "For solo recruiters and 1-person desks. 7-day free trial.",
    monthlyPence: 7900,
  },
  {
    key: "team",
    name: "VacancyMatch Team",
    description: "For small to mid-sized agency teams. 7-day free trial.",
    monthlyPence: 14900,
  },
  {
    key: "pro_agency",
    name: "VacancyMatch Pro Agency",
    description: "For specialist and multi-user desks. 7-day free trial.",
    monthlyPence: 22900,
  },
];

async function ensurePrice(
  stripe: Stripe,
  productId: string,
  planKey: string,
  interval: "month" | "year",
  amountPence: number,
): Promise<void> {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const existing = prices.data.find(
    (p) =>
      p.recurring?.interval === interval &&
      p.unit_amount === amountPence &&
      p.currency === CURRENCY,
  );
  if (existing) {
    console.log(`Price ${planKey}/${interval} already exists: ${existing.id}`);
    return;
  }
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amountPence,
    currency: CURRENCY,
    recurring: { interval },
    metadata: { plan_key: planKey, billing_interval: interval },
  });
  console.log(`Created price ${planKey}/${interval}: ${price.id}`);
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

    await ensurePrice(stripe, productId, plan.key, "month", plan.monthlyPence);
    await ensurePrice(
      stripe,
      productId,
      plan.key,
      "year",
      plan.monthlyPence * ANNUAL_MONTHS_CHARGED,
    );
  }

  console.log("Stripe product seed complete.");
}

main().catch((err) => {
  console.error("Stripe product seed failed:", err);
  process.exit(1);
});
