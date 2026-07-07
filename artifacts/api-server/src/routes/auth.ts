import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable, tenantUsersTable } from "@workspace/db";
import {
  LoginBody,
  LoginResponse,
  LogoutResponse,
  GetMeResponse,
} from "@workspace/api-zod";
import {
  SESSION_COOKIE,
  createSession,
  revokeSession,
  sessionCookieOptions,
  verifyPassword,
  isRole,
} from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

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
