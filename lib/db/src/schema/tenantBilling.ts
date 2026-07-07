import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const tenantBillingTable = pgTable("tenant_billing", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planKey: text("plan_key"),
  status: text("status").notNull().default("none"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TenantBilling = typeof tenantBillingTable.$inferSelect;
export type NewTenantBilling = typeof tenantBillingTable.$inferInsert;
