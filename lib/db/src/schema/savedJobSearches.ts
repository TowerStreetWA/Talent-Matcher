import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantUsersTable } from "./tenantUsers";

export const savedJobSearchesTable = pgTable("saved_job_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Tenant slug, consistent with the other data tables.
  tenantId: text("tenant_id").notNull().default("demo"),
  userId: uuid("user_id")
    .notNull()
    .references(() => tenantUsersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  query: text("query").notNull().default(""),
  location: text("location").notNull().default(""),
  // FS sector tag (insurance | banking | pensions | asset_management |
  // accountancy_finance | it_tech) or null.
  sector: text("sector"),
  // Display-family keys (config/curatedTitles/displayFamilies.ts) or empty.
  families: jsonb("families").$type<string[]>().notNull().default([]),
  // Source-type filter (direct_employer | google_jobs | job_board | agency) or null.
  sourceType: text("source_type"),
  // Whether recruitment-agency postings are included (search default is false).
  includeRecruiters: boolean("include_recruiters").notNull().default(false),
  alertEnabled: boolean("alert_enabled").notNull().default(false),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSavedJobSearchSchema = createInsertSchema(
  savedJobSearchesTable,
).omit({ id: true, createdAt: true });
export type InsertSavedJobSearch = z.infer<typeof insertSavedJobSearchSchema>;
export type SavedJobSearch = typeof savedJobSearchesTable.$inferSelect;

// Data-level alert events recorded by the saved-search alert sweep. Not yet
// wired to email/in-app delivery — this is the durable record for later wiring.
export const savedSearchAlertEventsTable = pgTable(
  "saved_search_alert_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull().default("demo"),
    savedSearchId: uuid("saved_search_id")
      .notNull()
      .references(() => savedJobSearchesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => tenantUsersTable.id, { onDelete: "cascade" }),
    jobCount: integer("job_count").notNull(),
    // Ids of the new jobs that triggered this event (capped by the sweep).
    jobIds: jsonb("job_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type SavedSearchAlertEvent =
  typeof savedSearchAlertEventsTable.$inferSelect;
