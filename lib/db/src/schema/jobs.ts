import { pgTable, uuid, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobSourcesTable } from "./jobSources";

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
  descriptionText: text("description_text"),
  applyUrl: text("apply_url"),
  industry: text("industry"),
  skills: text("skills").array().notNull().default([]),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
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
