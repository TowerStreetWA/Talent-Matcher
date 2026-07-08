import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { db, tenantUsersTable } from "@workspace/db";
import app from "../app";
import { createSession, revokeSession, SESSION_COOKIE } from "../lib/auth";

interface UnderwritingCountResponse {
  total_underwriting: number;
  active_canonical_underwriting: number;
  by_source: { source_provider: string; source_type: string; count: number }[];
  search: {
    query: string;
    db_title_match_count: number;
    search_results_count: number;
  };
  sector: { total_insurance_jobs: number };
  family: { total_underwriting_family_jobs: number };
  boards_underwriting: { reed: number; adzuna: number };
}

let server: Server;
let baseUrl: string;
let ownerCookie: string;
let viewerCookie: string;
const sessionTokens: string[] = [];

const sessionFor = async (email: string): Promise<string> => {
  const [user] = await db
    .select({ id: tenantUsersTable.id })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.email, email))
    .limit(1);
  if (!user) {
    throw new Error(
      `Seeded demo user ${email} not found — run the dev server once to seed auth data`,
    );
  }
  const session = await createSession(user.id, {});
  sessionTokens.push(session.token);
  return `${SESSION_COOKIE}=${session.token}`;
};

const get = async (cookie?: string): Promise<Response> =>
  fetch(`${baseUrl}/api/internal/debug/underwriting-count`, {
    headers: cookie ? { cookie } : {},
  });

beforeAll(async () => {
  ownerCookie = await sessionFor("owner@demo.test");
  viewerCookie = await sessionFor("viewer@demo.test");

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Failed to bind test server to an ephemeral port");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await Promise.all(sessionTokens.map((token) => revokeSession(token)));
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("GET /api/internal/debug/underwriting-count (integration)", () => {
  it("requires authentication", async () => {
    const res = await get();
    expect(res.status).toBe(401);
  });

  it("is admin-only: viewers are rejected", async () => {
    const res = await get(viewerCookie);
    expect(res.status).toBe(403);
  });

  it("returns the pinned response shape for admins", async () => {
    const res = await get(ownerCookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as UnderwritingCountResponse;

    // Top-level keys — pinned exactly (additions/removals must update this test).
    expect(Object.keys(body).sort()).toEqual([
      "active_canonical_underwriting",
      "boards_underwriting",
      "by_source",
      "family",
      "search",
      "sector",
      "total_underwriting",
    ]);

    expect(typeof body.total_underwriting).toBe("number");
    expect(typeof body.active_canonical_underwriting).toBe("number");
    expect(body.active_canonical_underwriting).toBeLessThanOrEqual(
      body.total_underwriting,
    );

    // by_source item shape.
    expect(Array.isArray(body.by_source)).toBe(true);
    for (const row of body.by_source) {
      expect(Object.keys(row).sort()).toEqual([
        "count",
        "source_provider",
        "source_type",
      ]);
      expect(typeof row.source_provider).toBe("string");
      expect(typeof row.source_type).toBe("string");
      expect(typeof row.count).toBe("number");
      expect(row.count).toBeGreaterThanOrEqual(0);
    }
    const bySourceTotal = body.by_source.reduce((sum, row) => sum + row.count, 0);
    expect(bySourceTotal).toBe(body.active_canonical_underwriting);

    // search object shape.
    expect(Object.keys(body.search).sort()).toEqual([
      "db_title_match_count",
      "query",
      "search_results_count",
    ]);
    expect(body.search.query).toBe("underwriter");
    expect(body.search.db_title_match_count).toBe(
      body.active_canonical_underwriting,
    );
    expect(typeof body.search.search_results_count).toBe("number");

    // sector / family object shapes.
    expect(Object.keys(body.sector)).toEqual(["total_insurance_jobs"]);
    expect(typeof body.sector.total_insurance_jobs).toBe("number");
    expect(Object.keys(body.family)).toEqual(["total_underwriting_family_jobs"]);
    expect(typeof body.family.total_underwriting_family_jobs).toBe("number");
    // Underwriting is a family within the insurance sector.
    expect(body.family.total_underwriting_family_jobs).toBeLessThanOrEqual(
      body.sector.total_insurance_jobs,
    );

    // boards_underwriting object shape.
    expect(Object.keys(body.boards_underwriting).sort()).toEqual([
      "adzuna",
      "reed",
    ]);
    expect(typeof body.boards_underwriting.reed).toBe("number");
    expect(typeof body.boards_underwriting.adzuna).toBe("number");
    expect(
      body.boards_underwriting.reed + body.boards_underwriting.adzuna,
    ).toBeLessThanOrEqual(body.active_canonical_underwriting);
  });
});
