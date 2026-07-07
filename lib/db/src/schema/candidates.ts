import {
  pgTable,
  uuid,
  text,
  real,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const candidatesTable = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("demo"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  currentTitle: text("current_title"),
  currentCompany: text("current_company"),
  locationText: text("location_text"),
  summary: text("summary"),
  seniority: text("seniority"),
  skills: text("skills").array().notNull().default([]),
  titles: text("titles").array().notNull().default([]),
  industries: text("industries").array().notNull().default([]),
  remotePreference: text("remote_preference"),
  desiredSalaryMin: real("desired_salary_min"),
  desiredSalaryMax: real("desired_salary_max"),
  salaryCurrency: text("salary_currency"),
  cvFileName: text("cv_file_name"),
  cvText: text("cv_text"),
  status: text("status").notNull().default("active"),
  lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),
  bestMatchScore: real("best_match_score"),
  matchCount: integer("match_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;
