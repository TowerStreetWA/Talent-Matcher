import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { db, tenantUsersTable } from "@workspace/db";
import app from "../app";
import { createSession, SESSION_COOKIE } from "../lib/auth";
import {
  clearIngestionPathRegistry,
  recordIngestionPath,
} from "../lib/directory/ingestionPathRegistry";
import { CAREERS_DIRECTORIES } from "../config/careersDirectories";

/**
 * Integration test (real dev DB) for the careers-directory coverage
 * diagnostics contract: the ingestion_paths summary and per-zero-job
 * employer last_ingestion added alongside the basic HTML crawler.
 */

interface IngestionPaths {
  by_path: Record<string, number>;
  by_outcome: Record<string, number>;
  firecrawl_available: boolean;
  firecrawl_unavailable_reason: { reason: string; message: string } | null;
}

interface CoverageResponse {
  directory: string;
  industry: string;
  ingestion_paths: IngestionPaths;
  directory_config: {
    configured_employers: number;
    employers_with_jobs: number;
  };
  employers_with_zero_jobs: {
    name: string;
    careersUrl: string;
    last_ingestion: {
      path: string | null;
      outcome: string;
      jobs: number;
      detail: string | null;
      checkedAt: string;
    } | null;
  }[];
}

let server: Server;
let baseUrl: string;
let cookie: string;
let sessionToken: string;

beforeAll(async () => {
  clearIngestionPathRegistry();
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
  clearIngestionPathRegistry();
  if (sessionToken) {
    const { revokeSession } = await import("../lib/auth");
    await revokeSession(sessionToken);
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("GET /api/internal/debug/careers-directory-coverage", () => {
  it("requires auth", async () => {
    const res = await fetch(
      `${baseUrl}/api/internal/debug/careers-directory-coverage?directory=banking`,
    );
    expect(res.status).toBe(401);
  });

  it("returns the ingestion_paths summary and per-employer last_ingestion", async () => {
    const directory = CAREERS_DIRECTORIES.find((d) => d.key === "banking");
    if (!directory) throw new Error("banking directory config missing");

    // First pass: find an employer that is guaranteed zero-job in this dev DB,
    // so the last_ingestion assertion below cannot be silently skipped.
    const firstRes = await fetch(
      `${baseUrl}/api/internal/debug/careers-directory-coverage?directory=banking`,
      { headers: { cookie } },
    );
    expect(firstRes.status).toBe(200);
    const firstBody = (await firstRes.json()) as CoverageResponse;
    const probe = firstBody.employers_with_zero_jobs[0];
    if (!probe) {
      throw new Error(
        "banking directory has no zero-job employers in this dev DB — pick another directory for this test",
      );
    }
    recordIngestionPath(probe.careersUrl, {
      path: null,
      outcome: "needs_firecrawl",
      jobs: 0,
      detail: "no_credits",
    });

    const res = await fetch(
      `${baseUrl}/api/internal/debug/careers-directory-coverage?directory=banking`,
      { headers: { cookie } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as CoverageResponse;

    expect(body.directory).toBe("banking");
    const paths = body.ingestion_paths;
    expect(paths).toBeTruthy();
    for (const key of ["ats", "basic_html", "firecrawl", "not_yet_attempted"]) {
      expect(typeof paths.by_path[key]).toBe("number");
    }
    // The record we planted has path null → counted under "none" and its
    // outcome tallied.
    expect(paths.by_path["none"]).toBeGreaterThanOrEqual(1);
    expect(paths.by_outcome["needs_firecrawl"]).toBeGreaterThanOrEqual(1);
    expect(typeof paths.firecrawl_available).toBe("boolean");
    if (!paths.firecrawl_available) {
      expect(paths.firecrawl_unavailable_reason).toMatchObject({
        reason: expect.any(String),
        message: expect.any(String),
      });
    } else {
      expect(paths.firecrawl_unavailable_reason).toBeNull();
    }

    // Path counts cover every configured employer exactly once.
    const totalCounted = Object.values(paths.by_path).reduce((a, b) => a + b, 0);
    expect(totalCounted).toBe(body.directory_config.configured_employers);

    // The planted record must surface on the zero-job employer's last_ingestion.
    const probed = body.employers_with_zero_jobs.find(
      (e) => e.careersUrl === probe.careersUrl,
    );
    expect(probed).toBeTruthy();
    expect(probed?.last_ingestion).toMatchObject({
      path: null,
      outcome: "needs_firecrawl",
      jobs: 0,
      detail: "no_credits",
      checkedAt: expect.any(String),
    });
  });

  it("rejects unknown directories", async () => {
    const res = await fetch(
      `${baseUrl}/api/internal/debug/careers-directory-coverage?directory=nope`,
      { headers: { cookie } },
    );
    expect(res.status).toBe(400);
  });
});
