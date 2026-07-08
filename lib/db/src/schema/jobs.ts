import { pgTable, uuid, text, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobSourcesTable } from "./jobSources";

/** A non-canonical origin where the same vacancy was also discovered. */
export interface BackingSource {
  sourceType: string;
  sourceProvider: string;
  sourceUrl: string | null;
}

export const jobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("demo"),
  sourceId: uuid("source_id").references(() => jobSourcesTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  companyName: text("company_name"),
  locationText: text("location_text"),
  remoteType: text("remote_type"),
  employmentType: text("employment_type"),
  salaryMin: real("salary_min"),
  salaryMax: real("salary_max"),
  salaryCurrency: text("salary_currency"),
  // raw salary/compensation string exactly as discovered at the source
  salaryText: text("salary_text"),
  descriptionText: text("description_text"),
  applyUrl: text("apply_url"),
  industry: text("industry"),
  skills: text("skills").array().notNull().default([]),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  // Vacancy discovery source model (Phase 10) — all additive, nullable or defaulted.
  // sourceType: "direct_employer" | "google_jobs" | "job_board" | "agency" (null for legacy/manual rows)
  sourceType: text("source_type"),
  // e.g. "company_site", "google_jobs_serpapi"
  sourceProvider: text("source_provider"),
  // canonical job detail URL at the source
  sourceUrl: text("source_url"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }),
  // sector tag from the ingestion search pattern (e.g. "insurance"); null for
  // legacy/manual rows — query-time classification remains the fallback
  sectorTag: text("sector_tag"),
  // duplicate clustering: rows sharing a canonicalGroupId are the same vacancy;
  // exactly one of them has isCanonical=true and is used for matching/search
  canonicalGroupId: uuid("canonical_group_id"),
  isCanonical: boolean("is_canonical").notNull().default(true),
  // on the canonical row: other origins this vacancy was also seen at
  backingSources: jsonb("backing_sources").$type<BackingSource[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
