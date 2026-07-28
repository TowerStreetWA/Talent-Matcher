import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobSpecFolderItemsTable } from "./jobSpecFolderItems";

export const jobSpecContactsTable = pgTable("job_spec_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  folderItemId: uuid("folder_item_id")
    .notNull()
    .references(() => jobSpecFolderItemsTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  /** "talent_acquisition" | "hiring_manager" */
  contactType: text("contact_type").notNull(),
  /** "apollo" | "manual" */
  source: text("source").notNull().default("apollo"),
  /** "high" = matched a specific config; "best_guess" = matched generic fallback */
  confidence: text("confidence").notNull().default("high"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertJobSpecContactSchema = createInsertSchema(
  jobSpecContactsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJobSpecContact = z.infer<typeof insertJobSpecContactSchema>;
export type JobSpecContact = typeof jobSpecContactsTable.$inferSelect;
