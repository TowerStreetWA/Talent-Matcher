import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobSpecFoldersTable } from "./jobSpecFolders";
import { jobsTable } from "./jobs";
import { tenantUsersTable } from "./tenantUsers";

export const jobSpecFolderItemsTable = pgTable("job_spec_folder_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  folderId: uuid("folder_id")
    .notNull()
    .references(() => jobSpecFoldersTable.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  addedBy: uuid("added_by")
    .notNull()
    .references(() => tenantUsersTable.id, { onDelete: "cascade" }),
  note: text("note"),
  status: text("status").notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  addedAt: timestamp("added_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertJobSpecFolderItemSchema = createInsertSchema(
  jobSpecFolderItemsTable,
).omit({ id: true, addedAt: true });
export type InsertJobSpecFolderItem = z.infer<
  typeof insertJobSpecFolderItemSchema
>;
export type JobSpecFolderItem = typeof jobSpecFolderItemsTable.$inferSelect;
