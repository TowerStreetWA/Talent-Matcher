import { Router, type IRouter } from "express";
import { and, eq, gt, isNull, like } from "drizzle-orm";
import { db, tenantsTable, tenantUsersTable, invitesTable } from "@workspace/db";
import {
  LoginBody,
  LoginResponse,
  LogoutResponse,
  GetMeResponse,
  SignupBody,
  SignupResponse,
  AcceptInviteBody,
  AcceptInviteResponse,
  LookupInviteResponse,
} from "@workspace/api-zod";
import {
  SESSION_COOKIE,
  createSession,
  revokeSession,
  sessionCookieOptions,
  verifyPassword,
  hashPassword,
  hashSessionToken,
  isRole,
} from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { recordAudit } from "../lib/audit";
import { seedSourcesForTenant } from "../lib/seed";

const router: IRouter = Router();

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "workspace";
}

async function uniqueSlug(companyName: string): Promise<string> {
  const base = slugify(companyName);
  const existing = await db
    .select({ slug: tenantsTable.slug })
    .from(tenantsTable)
    .where(like(tenantsTable.slug, `${base}%`));
  const taken = new Set(existing.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i <= 50; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message:
        parsed.error.issues[0]?.message != null
          ? `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
          : "Invalid input",
    });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const companyName = parsed.data.companyName.trim();
  const fullName = parsed.data.fullName.trim();
  if (!companyName || !fullName) {
    res.status(400).json({ message: "Company name and full name are required" });
    return;
  }

  const [existingUser] = await db
    .select({ id: tenantUsersTable.id })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.email, email))
    .limit(1);
  if (existingUser) {
    res.status(409).json({ message: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let created: { tenantId: string; tenantName: string; slug: string; userId: string } | null =
    null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const slug = await uniqueSlug(companyName);
    try {
      created = await db.transaction(async (tx) => {
        const [tenant] = await tx
          .insert(tenantsTable)
          .values({ name: companyName, slug })
          .returning();
        if (!tenant) throw new Error("Failed to create tenant");
        const [user] = await tx
          .insert(tenantUsersTable)
          .values({
            tenantId: tenant.id,
            email,
            passwordHash,
            fullName,
            role: "owner",
          })
          .returning();
        if (!user) throw new Error("Failed to create user");
        await recordAudit(
          {
            action: "auth.signup",
            entityType: "auth",
            entityId: user.id,
            metadata: `${fullName} created workspace "${companyName}" (${slug})`,
            actorName: fullName,
            tenantId: slug,
          },
          tx,
        );
        return { tenantId: tenant.id, tenantName: tenant.name, slug, userId: user.id };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Slug or email raced with a concurrent signup; re-check email, retry slug.
        const [raced] = await db
          .select({ id: tenantUsersTable.id })
          .from(tenantUsersTable)
          .where(eq(tenantUsersTable.email, email))
          .limit(1);
        if (raced) {
          res.status(409).json({ message: "An account with this email already exists" });
          return;
        }
        continue;
      }
      throw err;
    }
  }
  if (!created) {
    res.status(409).json({ message: "Could not create a workspace, please try again" });
    return;
  }

  const { token, expiresAt } = await createSession(created.userId, {
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });
  req.log.info({ tenant: created.slug }, "New workspace signup");
  // Fire-and-forget: seed standard job sources for the new tenant
  seedSourcesForTenant(created.slug).catch((err) =>
    req.log.error({ err, tenant: created.slug }, "Failed to seed sources for new tenant"),
  );
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  res.json(
    SignupResponse.parse({
      id: created.userId,
      tenantId: created.tenantId,
      tenantName: created.tenantName,
      email,
      fullName,
      role: "owner",
    }),
  );
});

function pendingInviteConditions(tokenHash: string) {
  return and(
    eq(invitesTable.tokenHash, tokenHash),
    isNull(invitesTable.acceptedAt),
    isNull(invitesTable.revokedAt),
    gt(invitesTable.expiresAt, new Date()),
  );
}

router.get("/auth/invite", async (req, res): Promise<void> => {
  const token = typeof req.query["token"] === "string" ? req.query["token"] : "";
  if (!token) {
    res.status(404).json({ message: "Invite not found" });
    return;
  }
  const [row] = await db
    .select({ invite: invitesTable, tenant: tenantsTable })
    .from(invitesTable)
    .innerJoin(tenantsTable, eq(invitesTable.tenantId, tenantsTable.slug))
    .where(pendingInviteConditions(hashSessionToken(token)))
    .limit(1);
  if (!row || row.tenant.status !== "active") {
    res.status(404).json({ message: "This invite is invalid, expired, or already used" });
    return;
  }
  res.json(
    LookupInviteResponse.parse({
      email: row.invite.email,
      role: row.invite.role,
      tenantName: row.tenant.name,
      invitedByName: row.invite.invitedByName,
    }),
  );
});

router.post("/auth/accept-invite", async (req, res): Promise<void> => {
  const parsed = AcceptInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Full name and a password of at least 8 characters are required" });
    return;
  }
  const [row] = await db
    .select({ invite: invitesTable, tenant: tenantsTable })
    .from(invitesTable)
    .innerJoin(tenantsTable, eq(invitesTable.tenantId, tenantsTable.slug))
    .where(pendingInviteConditions(hashSessionToken(parsed.data.token)))
    .limit(1);
  if (!row || row.tenant.status !== "active") {
    res.status(400).json({ message: "This invite is invalid, expired, or already used" });
    return;
  }
  // The account email is always the invited email — the token cannot be used
  // to create an account for a different address.
  const email = row.invite.email;
  const role = isRole(row.invite.role) ? row.invite.role : "recruiter";
  const fullName = parsed.data.fullName.trim();
  if (!fullName) {
    res.status(400).json({ message: "Full name is required" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);

  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(invitesTable)
        .set({ acceptedAt: new Date() })
        .where(pendingInviteConditions(row.invite.tokenHash))
        .returning({ id: invitesTable.id });
      if (!claimed) throw new Error("INVITE_ALREADY_USED");
      const [user] = await tx
        .insert(tenantUsersTable)
        .values({
          tenantId: row.tenant.id,
          email,
          passwordHash,
          fullName,
          role,
        })
        .returning();
      if (!user) throw new Error("Failed to create user");
      await recordAudit(
        {
          action: "auth.invite_accepted",
          entityType: "auth",
          entityId: user.id,
          metadata: `${fullName} (${email}) joined as ${role}, invited by ${row.invite.invitedByName}`,
          actorName: fullName,
          tenantId: row.tenant.slug,
        },
        tx,
      );
      return user.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ message: "An account with this email already exists" });
      return;
    }
    if (err instanceof Error && err.message === "INVITE_ALREADY_USED") {
      res.status(400).json({ message: "This invite is invalid, expired, or already used" });
      return;
    }
    throw err;
  }

  const { token, expiresAt } = await createSession(userId, {
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });
  req.log.info({ tenant: row.tenant.slug }, "Invite accepted");
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  res.json(
    AcceptInviteResponse.parse({
      id: userId,
      tenantId: row.tenant.id,
      tenantName: row.tenant.name,
      email,
      fullName,
      role,
    }),
  );
});

// Valid-format scrypt hash of a random throwaway password; used to equalize
// login timing when the email does not match any user (prevents enumeration).
const DUMMY_PASSWORD_HASH =
  "scrypt:e4d1a9c2b7f3806512de9a4c1b8f7e03:9c1f2b8a7d6e5f4031c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e";

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [row] = await db
    .select({ user: tenantUsersTable, tenant: tenantsTable })
    .from(tenantUsersTable)
    .innerJoin(tenantsTable, eq(tenantUsersTable.tenantId, tenantsTable.id))
    .where(eq(tenantUsersTable.email, email))
    .limit(1);

  const passwordOk = await verifyPassword(
    parsed.data.password,
    row?.user.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  const valid =
    row != null &&
    row.user.status === "active" &&
    row.tenant.status === "active" &&
    passwordOk;

  if (!valid || !row) {
    if (row) {
      await recordAudit({
        action: "auth.login_failed",
        entityType: "auth",
        entityId: row.user.id,
        metadata: `Failed login attempt for ${email}`,
        actorName: email,
        tenantId: row.tenant.slug,
      });
    }
    req.log.warn({ email }, "Failed login attempt");
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  if (!isRole(row.user.role)) {
    res.status(403).json({ message: "Invalid role configuration" });
    return;
  }

  const { token, expiresAt } = await createSession(row.user.id, {
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });
  await db
    .update(tenantUsersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(tenantUsersTable.id, row.user.id));
  await recordAudit({
    action: "auth.login",
    entityType: "auth",
    entityId: row.user.id,
    metadata: `${row.user.fullName} logged in`,
    actorName: row.user.fullName,
    tenantId: row.tenant.slug,
  });

  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  res.json(
    LoginResponse.parse({
      id: row.user.id,
      tenantId: row.tenant.id,
      tenantName: row.tenant.name,
      email: row.user.email,
      fullName: row.user.fullName,
      role: row.user.role,
    }),
  );
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth;
  if (auth) {
    await revokeSession(auth.sessionToken);
    await recordAudit({
      action: "auth.logout",
      entityType: "auth",
      entityId: auth.userId,
      metadata: `${auth.fullName} logged out`,
      actorName: auth.fullName,
      tenantId: auth.tenantSlug,
    });
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json(LogoutResponse.parse({ message: "Logged out" }));
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  res.json(
    GetMeResponse.parse({
      id: auth.userId,
      tenantId: auth.tenantId,
      tenantName: auth.tenantName,
      email: auth.email,
      fullName: auth.fullName,
      role: auth.role,
    }),
  );
});

export default router;
