import {
  pgTable,
  uuid,
  text,
  real,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { candidatesTable } from "./candidates";
import { jobsTable } from "./jobs";
import { matchRunsTable } from "./matchRuns";

export type ScoreBreakdown = {
  skills: number;
  title: number;
  industry: number;
  location: number;
  comp: number;
  recency: number;
};

export const matchesTable = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("demo"),
  matchRunId: uuid("match_run_id")
    .notNull()
    .references(() => matchRunsTable.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidatesTable.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  overallScore: real("overall_score").notNull(),
  scoreBreakdown: jsonb("score_breakdown").$type<ScoreBreakdown>().notNull(),
  explanation: text("explanation").array().notNull().default([]),
  matchedSkills: text("matched_skills").array().notNull().default([]),
  missingSkills: text("missing_skills").array().notNull().default([]),
  recruiterStatus: text("recruiter_status").notNull().default("new"),
  recruiterNote: text("recruiter_note"),
  pushedToCrm: boolean("pushed_to_crm").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
