import { pgTable, uuid, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
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
  // seeded demo/sample source — clearly labeled in the UI, never a live feed
  isDemo: boolean("is_demo").notNull().default(false),
  // machine provider id for ingestion-backed sources (e.g. "google_jobs_serpapi",
  // "linkedin_via_google_jobs", "company_site"); null for manual/demo sources
  provider: text("provider"),
  // number of vacancies attributed to this source in its most recent run
  lastFetchCount: integer("last_fetch_count"),
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
