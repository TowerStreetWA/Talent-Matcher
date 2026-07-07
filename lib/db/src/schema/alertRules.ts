import {
  pgTable,
  uuid,
  text,
  real,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { candidatesTable } from "./candidates";

export const alertRulesTable = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("demo"),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidatesTable.id, { onDelete: "cascade" }),
  minScore: real("min_score").notNull(),
  frequency: text("frequency").notNull().default("daily"),
  isActive: boolean("is_active").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAlertRuleSchema = createInsertSchema(alertRulesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRulesTable.$inferSelect;
