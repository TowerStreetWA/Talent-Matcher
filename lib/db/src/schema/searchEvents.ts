import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

// Search usage instrumentation: one row per executed job search, including
// zero-result searches, so dictionaries/sector mappings can be tuned later.
export const searchEventsTable = pgTable("search_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Tenant slug, consistent with the other data tables.
  tenantId: text("tenant_id").notNull().default("demo"),
  userId: uuid("user_id"),
  type: text("type").notNull().default("job_search"),
  query: text("query").notNull().default(""),
  location: text("location").notNull().default(""),
  sector: text("sector"),
  sourceType: text("source_type"),
  resultsCount: integer("results_count").notNull(),
  zeroResults: boolean("zero_results").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SearchEvent = typeof searchEventsTable.$inferSelect;
