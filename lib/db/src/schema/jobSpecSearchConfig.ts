import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantUsersTable } from "./tenantUsers";

/**
 * Per-sector or per-title-keyword Apollo search configuration.
 * Exactly one of sectorTag / jobTitleKeyword should be set (the other null).
 * When neither is set, this row acts as the tenant-level default override.
 *
 * Hard-coded generic default (used when no row matches):
 *   targetTitles: ["Talent Acquisition Manager","Talent Partner","HR Manager","Recruiter","Recruitment Manager","Head of Talent"]
 *   managerTitles: ["Manager","Head of","Director","VP","Lead"]
 */
export const jobSpecSearchConfigTable = pgTable("job_spec_search_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  /** e.g. "insurance" | "banking" | "pensions" — null if scoped by jobTitleKeyword */
  sectorTag: text("sector_tag"),
  /** free-text keyword matched against job title — null if scoped by sectorTag */
  jobTitleKeyword: text("job_title_keyword"),
  /** Apollo title keywords to search for the Talent Acquisition contact */
  targetTitles: text("target_titles").array().notNull().default([]),
  /** Apollo title keywords to search for the hiring manager / team lead */
  managerTitles: text("manager_titles").array().notNull().default([]),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => tenantUsersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertJobSpecSearchConfigSchema = createInsertSchema(
  jobSpecSearchConfigTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJobSpecSearchConfig = z.infer<
  typeof insertJobSpecSearchConfigSchema
>;
export type JobSpecSearchConfig = typeof jobSpecSearchConfigTable.$inferSelect;
