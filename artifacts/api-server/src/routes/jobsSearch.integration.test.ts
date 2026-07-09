import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { db, tenantUsersTable } from "@workspace/db";
import app from "../app";
import { createSession, SESSION_COOKIE } from "../lib/auth";

interface SearchResponse {
  results: { id: string; title: string }[];
  total: number;
  page: number;
  pageSize: number;
}

let server: Server;
let baseUrl: string;
let cookie: string;
let sessionToken: string;

const get = async (
  path: string,
  opts: { auth?: boolean } = { auth: true },
): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    headers: opts.auth === false ? {} : { cookie },
  });

beforeAll(async () => {
  const [owner] = await db
    .select({ id: tenantUsersTable.id })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.email, "owner@demo.test"))
    .limit(1);
  if (!owner) {
    throw new Error(
      "Seeded demo owner not found — run the dev server once to seed auth data",
    );
  }
  const session = await createSession(owner.id, {});
  sessionToken = session.token;
  cookie = `${SESSION_COOKIE}=${session.token}`;

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
  if (sessionToken) {
    const { revokeSession } = await import("../lib/auth");
    await revokeSession(sessionToken);
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("GET /api/jobs/search (integration)", () => {
  it("requires authentication", async () => {
    const res = await get("/api/jobs/search", { auth: false });
    expect(res.status).toBe(401);
  });

  it("returns a well-formed page of results with defaults", async () => {
    const res = await get("/api/jobs/search");
    expect(res.status).toBe(200);
    const body = (await res.json()) as SearchResponse;
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(25);
    expect(Array.isArray(body.results)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.results.length).toBeLessThanOrEqual(body.pageSize);
    expect(body.total).toBeGreaterThanOrEqual(body.results.length);
  });

  it("paginates: page 2 echoes params and never repeats page-1 results", async () => {
    const pageSize = 2;
    const first = await get(`/api/jobs/search?page=1&pageSize=${pageSize}`);
    expect(first.status).toBe(200);
    const page1 = (await first.json()) as SearchResponse;
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(pageSize);
    expect(page1.results.length).toBeLessThanOrEqual(pageSize);

    const second = await get(`/api/jobs/search?page=2&pageSize=${pageSize}`);
    expect(second.status).toBe(200);
    const page2 = (await second.json()) as SearchResponse;
    expect(page2.page).toBe(2);
    expect(page2.pageSize).toBe(pageSize);
    expect(page2.total).toBe(page1.total);

    const page1Ids = new Set(page1.results.map((r) => r.id));
    for (const job of page2.results) {
      expect(page1Ids.has(job.id)).toBe(false);
    }
    if (page1.total > pageSize) {
      expect(page2.results.length).toBeGreaterThan(0);
    } else {
      expect(page2.results.length).toBe(0);
    }
  });

  it("rejects an unknown sector with a 400 and a message", async () => {
    const res = await get("/api/jobs/search?sector=underwater_basket");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Unknown sector");
  });

  it("rejects an unknown source with a 400 and a message", async () => {
    const res = await get("/api/jobs/search?source=carrier_pigeon");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Unknown source");
  });

  it("parses includeRecruiters (true/1 include; false/omitted exclude)", async () => {
    const totals: Record<string, number> = {};
    for (const qs of ["", "?includeRecruiters=false", "?includeRecruiters=true", "?includeRecruiters=1"]) {
      const res = await get(`/api/jobs/search${qs}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResponse;
      totals[qs || "omitted"] = body.total;
    }
    // false and omitted behave identically (recruiters excluded).
    expect(totals["?includeRecruiters=false"]).toBe(totals["omitted"]);
    // true and 1 behave identically and never return fewer rows than default.
    expect(totals["?includeRecruiters=1"]).toBe(totals["?includeRecruiters=true"]);
    expect(totals["?includeRecruiters=true"]).toBeGreaterThanOrEqual(
      totals["omitted"] ?? 0,
    );
  });
});

describe("POST /api/internal/maintenance/reclassify-company-kinds (authz)", () => {
  it("denies non-admin roles", async () => {
    const [recruiter] = await db
      .select({ id: tenantUsersTable.id })
      .from(tenantUsersTable)
      .where(eq(tenantUsersTable.email, "recruiter@demo.test"))
      .limit(1);
    expect(recruiter).toBeDefined();
    const session = await createSession(recruiter!.id, {});
    try {
      const res = await fetch(
        `${baseUrl}/api/internal/maintenance/reclassify-company-kinds`,
        {
          method: "POST",
          headers: { cookie: `${SESSION_COOKIE}=${session.token}` },
        },
      );
      expect(res.status).toBe(403);
    } finally {
      const { revokeSession } = await import("../lib/auth");
      await revokeSession(session.token);
    }
  });
});
