import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { candidatesTable } from "./candidates";

export const matchRunsTable = pgTable("match_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("demo"),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidatesTable.id, { onDelete: "cascade" }),
  triggerType: text("trigger_type").notNull().default("manual"),
  modelVersion: text("model_version").notNull().default("v1-weighted"),
  status: text("status").notNull().default("completed"),
  matchCount: integer("match_count").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertMatchRunSchema = createInsertSchema(matchRunsTable).omit({
  id: true,
});
export type InsertMatchRun = z.infer<typeof insertMatchRunSchema>;
export type MatchRun = typeof matchRunsTable.$inferSelect;
