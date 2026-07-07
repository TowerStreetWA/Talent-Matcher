import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { db, tenantUsersTable, invitesTable } from "@workspace/db";
import {
  ListTeamMembersResponse,
  UpdateTeamMemberBody,
  UpdateTeamMemberResponse,
  ListInvitesResponse,
  CreateInviteBody,
  CreateInviteResponse,
} from "@workspace/api-zod";
import { hashSessionToken } from "../lib/auth";
import { tenantOf, auditActor } from "../middlewares/auth";
import { recordAudit } from "../lib/audit";
import { sendEmail, inviteEmailHtml } from "../lib/email";

const router: IRouter = Router();

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toMemberDto(user: typeof tenantUsersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

function toInviteDto(invite: typeof invitesTable.$inferSelect) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    invitedByName: invite.invitedByName,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

function appBaseUrl(): string {
  const domain =
    process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim() ||
    process.env["REPLIT_DEV_DOMAIN"];
  return domain ? `https://${domain}` : "http://localhost:80";
}

router.get("/team", async (req, res): Promise<void> => {
  const tenantUuid = req.auth?.tenantId;
  if (!tenantUuid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const members = await db
    .select()
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.tenantId, tenantUuid))
    .orderBy(asc(tenantUsersTable.createdAt));
  res.json(ListTeamMembersResponse.parse(members.map(toMemberDto)));
});

router.patch("/team/:userId", async (req, res): Promise<void> => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const parsed = UpdateTeamMemberBody.safeParse(req.body);
  if (!parsed.success || (parsed.data.role == null && parsed.data.status == null)) {
    res.status(400).json({ message: "Provide a role or status to change" });
    return;
  }
  const userId = req.params["userId"] ?? "";
  const [target] = await db
    .select()
    .from(tenantUsersTable)
    .where(
      and(
        eq(tenantUsersTable.id, userId),
        eq(tenantUsersTable.tenantId, auth.tenantId),
      ),
    )
    .limit(1);
  if (!target) {
    res.status(404).json({ message: "Member not found" });
    return;
  }
  if (target.id === auth.userId) {
    res.status(400).json({ message: "You cannot change your own role or status" });
    return;
  }
  if (target.role === "owner") {
    res.status(400).json({ message: "Workspace owners cannot be modified" });
    return;
  }

  const changes: Partial<{ role: string; status: string }> = {};
  if (parsed.data.role != null) changes.role = parsed.data.role;
  if (parsed.data.status != null) changes.status = parsed.data.status;

  const [updated] = await db
    .update(tenantUsersTable)
    .set(changes)
    .where(eq(tenantUsersTable.id, target.id))
    .returning();
  if (!updated) {
    res.status(404).json({ message: "Member not found" });
    return;
  }
  const summary = [
    parsed.data.role != null ? `role → ${parsed.data.role}` : null,
    parsed.data.status != null ? `status → ${parsed.data.status}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  await recordAudit({
    action: "team.member_updated",
    entityType: "team",
    entityId: target.id,
    metadata: `${target.fullName} (${target.email}): ${summary}`,
    ...auditActor(req),
  });
  res.json(UpdateTeamMemberResponse.parse(toMemberDto(updated)));
});

function pendingInvitesWhere(tenantSlug: string) {
  return and(
    eq(invitesTable.tenantId, tenantSlug),
    isNull(invitesTable.acceptedAt),
    isNull(invitesTable.revokedAt),
    gt(invitesTable.expiresAt, new Date()),
  );
}

router.get("/team/invites", async (req, res): Promise<void> => {
  const invites = await db
    .select()
    .from(invitesTable)
    .where(pendingInvitesWhere(tenantOf(req)))
    .orderBy(desc(invitesTable.createdAt));
  res.json(ListInvitesResponse.parse(invites.map(toInviteDto)));
});

router.post("/team/invites", async (req, res): Promise<void> => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const parsed = CreateInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "A valid email and role are required" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const tenantSlug = tenantOf(req);

  const [existingUser] = await db
    .select({ id: tenantUsersTable.id })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.email, email))
    .limit(1);
  if (existingUser) {
    res.status(409).json({ message: "An account with this email already exists" });
    return;
  }
  const [existingInvite] = await db
    .select({ id: invitesTable.id })
    .from(invitesTable)
    .where(and(pendingInvitesWhere(tenantSlug), eq(invitesTable.email, email)))
    .limit(1);
  if (existingInvite) {
    res.status(409).json({ message: "There is already a pending invite for this email" });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const [invite] = await db
    .insert(invitesTable)
    .values({
      tenantId: tenantSlug,
      email,
      role: parsed.data.role,
      tokenHash: hashSessionToken(token),
      invitedByName: auth.fullName,
      expiresAt,
    })
    .returning();
  if (!invite) {
    res.status(500).json({ message: "Failed to create invite" });
    return;
  }

  const inviteUrl = `${appBaseUrl()}/accept-invite?token=${token}`;
  const { subject, html } = inviteEmailHtml({
    tenantName: auth.tenantName,
    inviterName: auth.fullName,
    role: parsed.data.role,
    inviteUrl,
  });
  const emailSent = await sendEmail({ to: email, subject, html });

  await recordAudit({
    action: "team.invite_created",
    entityType: "team",
    entityId: invite.id,
    metadata: `Invited ${email} as ${parsed.data.role}${emailSent ? "" : " (email not delivered)"}`,
    ...auditActor(req),
  });

  res.json(
    CreateInviteResponse.parse({
      invite: toInviteDto(invite),
      inviteUrl,
      emailSent,
    }),
  );
});

router.delete("/team/invites/:inviteId", async (req, res): Promise<void> => {
  const inviteId = req.params["inviteId"] ?? "";
  const [revoked] = await db
    .update(invitesTable)
    .set({ revokedAt: new Date() })
    .where(and(pendingInvitesWhere(tenantOf(req)), eq(invitesTable.id, inviteId)))
    .returning();
  if (!revoked) {
    res.status(404).json({ message: "Invite not found" });
    return;
  }
  await recordAudit({
    action: "team.invite_revoked",
    entityType: "team",
    entityId: revoked.id,
    metadata: `Revoked invite for ${revoked.email}`,
    ...auditActor(req),
  });
  res.json({ message: "Invite revoked" });
});

export default router;
