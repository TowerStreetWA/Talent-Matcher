import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobSourcesTable = pgTable("job_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("demo"),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  baseUrl: text("base_url"),
  isActive: boolean("is_active").notNull().default(true),
  healthStatus: text("health_status").notNull().default("healthy"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertJobSourceSchema = createInsertSchema(jobSourcesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertJobSource = z.infer<typeof insertJobSourceSchema>;
export type JobSource = typeof jobSourcesTable.$inferSelect;
