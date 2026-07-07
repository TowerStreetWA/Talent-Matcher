import type { Request, Response, NextFunction } from "express";
import {
  SESSION_COOKIE,
  parseCookies,
  resolveSession,
  roleAtLeast,
  isRole,
  type AuthContext,
  type Role,
} from "../lib/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const session = await resolveSession(token);
  if (!session) {
    res.status(401).json({ message: "Session expired or invalid" });
    return;
  }
  const role = session.user.role;
  if (!isRole(role)) {
    res.status(403).json({ message: "Invalid role" });
    return;
  }
  req.auth = {
    userId: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    role,
    tenantId: session.tenant.id,
    tenantSlug: session.tenant.slug,
    tenantName: session.tenant.name,
    sessionToken: token,
  };
  next();
}

export function requireRole(minimum: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    if (!roleAtLeast(req.auth.role, minimum)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function tenantOf(req: Request): string {
  return req.auth?.tenantSlug ?? "demo";
}

export function auditActor(req: Request): {
  actorName: string;
  tenantId: string;
} {
  return {
    actorName: req.auth?.fullName ?? "System",
    tenantId: tenantOf(req),
  };
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function blockViewerWrites(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    req.auth &&
    req.auth.role === "viewer" &&
    !READ_METHODS.has(req.method)
  ) {
    res.status(403).json({ message: "Viewers have read-only access" });
    return;
  }
  next();
}
