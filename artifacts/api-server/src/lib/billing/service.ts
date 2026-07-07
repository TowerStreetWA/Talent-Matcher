import { sql, eq } from "drizzle-orm";
import { db, tenantBillingTable, type TenantBilling } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { recordAudit } from "../audit";
import { getPlan, PLANS, canUseCoreProduct, type PlanDef } from "./plans";

export interface PlanWithPrice extends PlanDef {
  priceId: string | null;
  unitAmount: number | null;
  currency: string | null;
  interval: string | null;
}

interface StripePriceRow {
  price_id: string;
  unit_amount: number | null;
  currency: string | null;
  recurring: { interval?: string } | null;
  plan_key: string | null;
}

export async function listPlansWithPrices(): Promise<PlanWithPrice[]> {
  const result = await db.execute(sql`
    SELECT
      pr.id AS price_id,
      pr.unit_amount,
      pr.currency,
      pr.recurring,
      p.metadata->>'plan_key' AS plan_key
    FROM stripe.products p
    JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
    WHERE p.active = true AND p.metadata->>'plan_key' IS NOT NULL
    ORDER BY pr.unit_amount
  `);
  const rows = result.rows as unknown as StripePriceRow[];
  const byPlan = new Map<string, StripePriceRow>();
  for (const row of rows) {
    if (row.plan_key && !byPlan.has(row.plan_key)) {
      byPlan.set(row.plan_key, row);
    }
  }
  return Object.values(PLANS).map((plan) => {
    const row = byPlan.get(plan.key);
    return {
      ...plan,
      priceId: row?.price_id ?? null,
      unitAmount: row?.unit_amount ?? null,
      currency: row?.currency ?? null,
      interval: row?.recurring?.interval ?? null,
    };
  });
}

export async function getPriceIdForPlan(
  planKey: string,
): Promise<string | null> {
  const plans = await listPlansWithPrices();
  return plans.find((p) => p.key === planKey)?.priceId ?? null;
}

export async function getBillingRow(
  tenantSlug: string,
): Promise<TenantBilling | null> {
  const [row] = await db
    .select()
    .from(tenantBillingTable)
    .where(eq(tenantBillingTable.tenantId, tenantSlug))
    .limit(1);
  return row ?? null;
}

async function upsertBillingRow(
  tenantSlug: string,
  values: Partial<typeof tenantBillingTable.$inferInsert>,
): Promise<TenantBilling> {
  const [row] = await db
    .insert(tenantBillingTable)
    .values({ tenantId: tenantSlug, ...values })
    .onConflictDoUpdate({
      target: tenantBillingTable.tenantId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  if (!row) {
    throw new Error("Failed to upsert tenant billing row");
  }
  return row;
}

export async function ensureStripeCustomer(
  tenantSlug: string,
  tenantName: string,
  email: string,
): Promise<string> {
  const existing = await getBillingRow(tenantSlug);
  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }
  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email,
    name: tenantName,
    metadata: { tenant_slug: tenantSlug },
  });
  await upsertBillingRow(tenantSlug, { stripeCustomerId: customer.id });
  return customer.id;
}

interface StripeSubRow {
  id: string;
  status: string;
  cancel_at_period_end: boolean | null;
  canceled_at: number | null;
  trial_end: number | null;
  current_period_end: number | null;
  items: unknown;
}

function epochToDate(epoch: number | null | undefined): Date | null {
  return epoch ? new Date(epoch * 1000) : null;
}

function extractPeriodEnd(row: StripeSubRow): number | null {
  if (row.current_period_end) return row.current_period_end;
  const items = row.items as
    | { data?: Array<{ current_period_end?: number }> }
    | null
    | undefined;
  return items?.data?.[0]?.current_period_end ?? null;
}

async function findSubscriptionPlanKey(
  subscriptionId: string,
): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT p.metadata->>'plan_key' AS plan_key
    FROM stripe.subscription_items si
    JOIN stripe.prices pr ON pr.id = si.price
    JOIN stripe.products p ON p.id = pr.product
    WHERE si.subscription = ${subscriptionId}
    LIMIT 1
  `);
  const row = result.rows[0] as { plan_key?: string | null } | undefined;
  return row?.plan_key ?? null;
}

/**
 * Recompute the cached tenant billing state from the webhook-synced
 * `stripe` schema. Local access decisions read the cache; the cache is
 * only ever derived from webhook-verified Stripe data (never from
 * checkout redirects).
 */
export async function syncTenantBilling(
  tenantSlug: string,
): Promise<TenantBilling | null> {
  const row = await getBillingRow(tenantSlug);
  if (!row?.stripeCustomerId) {
    return row;
  }

  const result = await db.execute(sql`
    SELECT id, status, cancel_at_period_end, canceled_at, trial_end,
           current_period_end, items
    FROM stripe.subscriptions
    WHERE customer = ${row.stripeCustomerId}
    ORDER BY
      CASE status
        WHEN 'active' THEN 0
        WHEN 'trialing' THEN 1
        WHEN 'past_due' THEN 2
        ELSE 3
      END,
      created DESC
    LIMIT 1
  `);
  const sub = result.rows[0] as unknown as StripeSubRow | undefined;
  if (!sub) {
    return row;
  }

  const planKey = (await findSubscriptionPlanKey(sub.id)) ?? row.planKey;
  const updated = await upsertBillingRow(tenantSlug, {
    stripeSubscriptionId: sub.id,
    status: sub.status,
    planKey,
    trialEndsAt: epochToDate(sub.trial_end),
    currentPeriodEnd: epochToDate(extractPeriodEnd(sub)),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  });

  if (row.status !== updated.status) {
    await recordAudit({
      action: "billing.status_changed",
      entityType: "billing",
      entityId: updated.id,
      metadata: `Billing status changed from ${row.status} to ${updated.status} (plan: ${updated.planKey ?? "unknown"})`,
      tenantId: tenantSlug,
    });
  }

  return updated;
}

export interface BillingState {
  planKey: string | null;
  planLabel: string | null;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canUseCoreProduct: boolean;
}

export function toBillingState(row: TenantBilling | null): BillingState {
  const status = row?.status ?? "none";
  const planKey = row?.planKey ?? null;
  return {
    planKey,
    planLabel: planKey ? (getPlan(planKey)?.label ?? planKey) : null,
    status,
    trialEndsAt: row?.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
    canUseCoreProduct: canUseCoreProduct(status),
  };
}
