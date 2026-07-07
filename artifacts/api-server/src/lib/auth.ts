import {
  randomBytes,
  scrypt as scryptCb,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  tenantsTable,
  tenantUsersTable,
  userSessionsTable,
  type Tenant,
  type TenantUser,
} from "@workspace/db";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "vm_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Role = "owner" | "admin" | "recruiter" | "viewer";

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  recruiter: 1,
  admin: 2,
  owner: 3,
};

export function isRole(value: string): value is Role {
  return value in ROLE_RANK;
}

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) {
    return false;
  }
  const derived = await scrypt(password, parts[1], 64);
  const expected = Buffer.from(parts[2], "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  tenantUserId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(userSessionsTable).values({
    tenantUserId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent ?? null,
  });
  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await db
    .update(userSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(userSessionsTable.tokenHash, hashSessionToken(token)));
}

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  sessionToken: string;
}

export async function resolveSession(
  token: string,
): Promise<{ user: TenantUser; tenant: Tenant } | null> {
  const [row] = await db
    .select({ user: tenantUsersTable, tenant: tenantsTable })
    .from(userSessionsTable)
    .innerJoin(
      tenantUsersTable,
      eq(userSessionsTable.tenantUserId, tenantUsersTable.id),
    )
    .innerJoin(tenantsTable, eq(tenantUsersTable.tenantId, tenantsTable.id))
    .where(
      and(
        eq(userSessionsTable.tokenHash, hashSessionToken(token)),
        isNull(userSessionsTable.revokedAt),
        gt(userSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.user.status !== "active") return null;
  if (row.tenant.status !== "active") return null;
  return row;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function sessionCookieOptions(expiresAt: Date): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  expires: Date;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    expires: expiresAt,
  };
}
