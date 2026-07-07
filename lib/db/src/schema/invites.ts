import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const invitesTable = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Tenant slug, matching the tenantId convention on data rows.
  tenantId: text("tenant_id").notNull().default("demo"),
  email: text("email").notNull(),
  role: text("role").notNull().default("recruiter"),
  tokenHash: text("token_hash").notNull().unique(),
  invitedByName: text("invited_by_name").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Invite = typeof invitesTable.$inferSelect;
export type NewInvite = typeof invitesTable.$inferInsert;
