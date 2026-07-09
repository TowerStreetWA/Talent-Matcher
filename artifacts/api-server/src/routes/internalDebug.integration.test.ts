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

const getScorecards = async (cookie?: string): Promise<Response> =>
  fetch(`${baseUrl}/api/internal/debug/sector-scorecards`, {
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

interface SectorScorecardRow {
  industry: string;
  directories: string[];
  seeded_employers: number;
  careers_page_detected: number;
  actively_posting_employers: number;
  ats_resolved_employers: number;
  basic_html_employers: number;
  firecrawl_employers: number;
  needs_firecrawl_employers: number;
  unsupported_ats_employers: number;
  zero_job_employers: number;
  active_canonical_jobs: number;
  direct_employer_jobs: number;
  coverage_status: string;
  best_next_gain: string;
  segments: Array<{ segment: string; active_jobs: number; seeded_employers: number }> | null;
}

describe("GET /api/internal/debug/sector-scorecards (integration)", () => {
  it("requires authentication and rejects viewers", async () => {
    expect((await getScorecards()).status).toBe(401);
    expect((await getScorecards(viewerCookie)).status).toBe(403);
  });

  it("returns one scorecard per directory industry with rule outputs", async () => {
    const res = await getScorecards(ownerCookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { industries: SectorScorecardRow[] };

    const industries = body.industries.map((i) => i.industry).sort();
    expect(industries).toEqual([
      "accountancy_finance",
      "asset_management",
      "banking",
      "insurance",
      "it_tech",
      "pensions",
    ]);

    for (const card of body.industries) {
      expect(card.seeded_employers).toBeGreaterThan(0);
      // employer partitions must be internally consistent
      expect(card.actively_posting_employers + card.zero_job_employers).toBe(
        card.seeded_employers,
      );
      expect(card.careers_page_detected).toBeLessThanOrEqual(card.seeded_employers);
      expect(card.ats_resolved_employers).toBeLessThanOrEqual(card.seeded_employers);
      expect(card.direct_employer_jobs).toBeLessThanOrEqual(card.active_canonical_jobs);
      expect(["healthy", "developing", "thin"]).toContain(card.coverage_status);
      expect([
        "add more ATS employers",
        "support remaining ATS providers",
        "top up Firecrawl for JS-heavy sites",
        "expand seed list",
      ]).toContain(card.best_next_gain);
    }

    // Insurance carries segment detail (config segment keys); others do not.
    const insurance = body.industries.find((i) => i.industry === "insurance")!;
    expect(insurance.segments?.map((s) => s.segment).sort()).toEqual([
      "broker",
      "company_market",
      "lloyds_syndicate",
      "mga_coverholder",
    ]);
    for (const seg of insurance.segments!) {
      expect(seg.seeded_employers).toBeGreaterThan(0);
      expect(seg.active_jobs).toBeGreaterThanOrEqual(0);
    }
    const banking = body.industries.find((i) => i.industry === "banking")!;
    expect(banking.segments).toBeNull();
  });
});
