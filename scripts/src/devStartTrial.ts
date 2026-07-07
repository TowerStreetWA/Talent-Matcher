import { getUncachableStripeClient } from "./stripeClient";

const TENANT_SLUG = process.argv[2] ?? "demo";
const TENANT_NAME = "Demo Recruitment Agency";
const BILLING_EMAIL = "owner@demo.test";

async function main(): Promise<void> {
  const stripe = await getUncachableStripeClient();

  const products = await stripe.products.search({
    query: `metadata['plan_key']:'starter' AND active:'true'`,
  });
  const product = products.data[0];
  if (!product) {
    throw new Error("Starter product not found. Run seedStripeProducts first.");
  }
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new Error("Starter price not found. Run seedStripeProducts first.");
  }

  const existingCustomers = await stripe.customers.search({
    query: `metadata['tenant_slug']:'${TENANT_SLUG}'`,
  });
  let customer = existingCustomers.data[0];
  if (!customer) {
    customer = await stripe.customers.create({
      email: BILLING_EMAIL,
      name: TENANT_NAME,
      metadata: { tenant_slug: TENANT_SLUG },
    });
    console.log(`Created customer ${customer.id} for tenant ${TENANT_SLUG}`);
  } else {
    console.log(`Customer already exists: ${customer.id}`);
  }

  const existingSubs = await stripe.subscriptions.list({
    customer: customer.id,
    status: "all",
    limit: 5,
  });
  const live = existingSubs.data.find((s) =>
    ["trialing", "active", "past_due"].includes(s.status),
  );
  if (live) {
    console.log(`Tenant already has a live subscription: ${live.id} (${live.status})`);
    return;
  }

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    trial_period_days: 7,
    trial_settings: {
      end_behavior: { missing_payment_method: "cancel" },
    },
    metadata: { tenant_slug: TENANT_SLUG, plan_key: "starter" },
  });
  console.log(
    `Created trial subscription ${subscription.id} (status: ${subscription.status}) for tenant ${TENANT_SLUG}`,
  );
  console.log(
    "The webhook will sync it shortly; then GET /billing/subscription reflects the trial.",
  );
}

main().catch((err) => {
  console.error("devStartTrial failed:", err);
  process.exit(1);
});
