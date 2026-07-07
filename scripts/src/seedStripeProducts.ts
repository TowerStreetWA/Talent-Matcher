import { getUncachableStripeClient } from "./stripeClient";

interface PlanSeed {
  key: string;
  name: string;
  description: string;
  amountCents: number;
}

const PLANS: PlanSeed[] = [
  {
    key: "starter",
    name: "VacancyMatch Starter",
    description: "For solo recruiters getting started. 7-day free trial.",
    amountCents: 4900,
  },
  {
    key: "team",
    name: "VacancyMatch Team",
    description: "For growing recruitment teams.",
    amountCents: 14900,
  },
];

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
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { plan_key: plan.key },
      });
      productId = product.id;
      console.log(`Created product for ${plan.key}: ${productId}`);
    }

    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 10,
    });
    const monthly = prices.data.find(
      (p) =>
        p.recurring?.interval === "month" &&
        p.unit_amount === plan.amountCents &&
        p.currency === "usd",
    );
    if (monthly) {
      console.log(`Price for ${plan.key} already exists: ${monthly.id}`);
    } else {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: plan.amountCents,
        currency: "usd",
        recurring: { interval: "month" },
      });
      console.log(`Created price for ${plan.key}: ${price.id}`);
    }
  }

  console.log("Stripe product seed complete.");
}

main().catch((err) => {
  console.error("Stripe product seed failed:", err);
  process.exit(1);
});
