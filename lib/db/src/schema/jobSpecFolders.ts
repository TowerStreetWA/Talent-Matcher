import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantUsersTable } from "./tenantUsers";

export const jobSpecFoldersTable = pgTable("job_spec_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  /** null = team folder; set = personal folder owned by this user */
  ownerUserId: uuid("owner_user_id").references(() => tenantUsersTable.id, {
    onDelete: "set null",
  }),
  /** "team" = visible to whole tenant, "personal" = private to ownerUserId */
  visibility: text("visibility").notNull().default("team"),
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

export const insertJobSpecFolderSchema = createInsertSchema(
  jobSpecFoldersTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJobSpecFolder = z.infer<typeof insertJobSpecFolderSchema>;
export type JobSpecFolder = typeof jobSpecFoldersTable.$inferSelect;
