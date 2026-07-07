import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { tenantUsersTable } from "./tenantUsers";

export const userSessionsTable = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantUserId: uuid("tenant_user_id")
      .notNull()
      .references(() => tenantUsersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("user_sessions_user_idx").on(table.tenantUserId)],
);

export type UserSession = typeof userSessionsTable.$inferSelect;
