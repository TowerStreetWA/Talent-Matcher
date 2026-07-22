import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { candidatesTable } from "./candidates";
import { tenantUsersTable } from "./tenantUsers";
import { jobsTable } from "./jobs";

export const specListsTable = pgTable("spec_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("demo"),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidatesTable.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => tenantUsersTable.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SpecList = typeof specListsTable.$inferSelect;

export const specListItemsTable = pgTable("spec_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  specListId: uuid("spec_list_id")
    .notNull()
    .references(() => specListsTable.id, { onDelete: "cascade" }),
  vacancyId: uuid("vacancy_id")
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  note: text("note"),
  status: text("status").notNull().default("proposed"),
  statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type SpecListItem = typeof specListItemsTable.$inferSelect;
