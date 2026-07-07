import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { candidatesTable } from "./candidates";
import { jobsTable } from "./jobs";

export const crmSyncEventsTable = pgTable("crm_sync_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("demo"),
  candidateId: uuid("candidate_id").references(() => candidatesTable.id, {
    onDelete: "set null",
  }),
  jobId: uuid("job_id").references(() => jobsTable.id, {
    onDelete: "set null",
  }),
  direction: text("direction").notNull().default("outbound"),
  crmName: text("crm_name").notNull(),
  payloadSummary: text("payload_summary"),
  status: text("status").notNull().default("sent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const insertCrmSyncEventSchema = createInsertSchema(
  crmSyncEventsTable,
).omit({ id: true, createdAt: true });
export type InsertCrmSyncEvent = z.infer<typeof insertCrmSyncEventSchema>;
export type CrmSyncEvent = typeof crmSyncEventsTable.$inferSelect;
