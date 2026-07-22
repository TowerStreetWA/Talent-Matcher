import { Router, type IRouter } from "express";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import {
  db,
  candidatesTable,
  jobsTable,
  jobSourcesTable,
  matchRunsTable,
  matchesTable,
  auditLogsTable,
} from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetTopMatchesResponse,
  GetIndustryCountsResponse,
  GetRoleAnalysisResponse,
} from "@workspace/api-zod";
import { toMatchDto } from "../lib/dto";
import { describeActivity } from "../lib/activityDescription";
import { tenantOf } from "../middlewares/auth";
import { chatCompletion } from "../lib/aiClient";
import { SECTOR_LABELS } from "../lib/search/classification";
import type { FinSector } from "../lib/search/finTaxonomy";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------------

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    [candidates],
    [jobs],
    [sources],
    [runs],
    [shortlisted],
    [pushed],
    [avgTop],
    [newWeek],
  ] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(candidatesTable)
      .where(eq(candidatesTable.tenantId, tenant)),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(and(eq(jobsTable.status, "active"), eq(jobsTable.tenantId, tenant))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobSourcesTable)
      .where(
        and(
          eq(jobSourcesTable.isActive, true),
          eq(jobSourcesTable.tenantId, tenant),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(matchRunsTable)
      .where(eq(matchRunsTable.tenantId, tenant)),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(matchesTable)
      .where(
        and(
          eq(matchesTable.recruiterStatus, "shortlisted"),
          eq(matchesTable.tenantId, tenant),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(matchesTable)
      .where(
        and(eq(matchesTable.pushedToCrm, true), eq(matchesTable.tenantId, tenant)),
      ),
    db
      .select({
        avg: sql<number>`coalesce(avg(${candidatesTable.bestMatchScore}), 0)::float`,
      })
      .from(candidatesTable)
      .where(
        and(
          sql`${candidatesTable.bestMatchScore} is not null`,
          eq(candidatesTable.tenantId, tenant),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(matchesTable)
      .where(
        and(gte(matchesTable.createdAt, weekAgo), eq(matchesTable.tenantId, tenant)),
      ),
  ]);
  res.json(
    GetDashboardSummaryResponse.parse({
      candidateCount: candidates?.c ?? 0,
      activeJobCount: jobs?.c ?? 0,
      activeSourceCount: sources?.c ?? 0,
      matchRunCount: runs?.c ?? 0,
      shortlistedCount: shortlisted?.c ?? 0,
      pushedToCrmCount: pushed?.c ?? 0,
      avgTopScore: Math.round((avgTop?.avg ?? 0) * 10) / 10,
      newMatchesThisWeek: newWeek?.c ?? 0,
    }),
  );
});

// ---------------------------------------------------------------------------
// Recent activity (kept for backwards compat; dashboard no longer shows it)
// ---------------------------------------------------------------------------

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.tenantId, tenantOf(req)))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(15);
  res.json(
    GetRecentActivityResponse.parse(
      rows.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        description: describeActivity(l.action, l.metadata),
        createdAt: l.createdAt.toISOString(),
      })),
    ),
  );
});

// ---------------------------------------------------------------------------
// Top matches
// ---------------------------------------------------------------------------

router.get("/dashboard/top-matches", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      match: matchesTable,
      job: jobsTable,
      sourceName: jobSourcesTable.name,
      candFirst: candidatesTable.firstName,
      candLast: candidatesTable.lastName,
    })
    .from(matchesTable)
    .innerJoin(jobsTable, eq(matchesTable.jobId, jobsTable.id))
    .leftJoin(jobSourcesTable, eq(jobsTable.sourceId, jobSourcesTable.id))
    .innerJoin(
      candidatesTable,
      eq(matchesTable.candidateId, candidatesTable.id),
    )
    .where(
      and(
        eq(matchesTable.recruiterStatus, "new"),
        eq(matchesTable.tenantId, tenantOf(req)),
      ),
    )
    .orderBy(desc(matchesTable.overallScore))
    .limit(8);
  res.json(
    GetTopMatchesResponse.parse(
      rows.map((r) =>
        toMatchDto(r.match, r.job, r.sourceName, `${r.candFirst} ${r.candLast}`),
      ),
    ),
  );
});

// ---------------------------------------------------------------------------
// Industry counts — active canonical jobs grouped by sector_tag
// ---------------------------------------------------------------------------

router.get("/dashboard/industry-counts", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const rows = await db
    .select({
      sector: jobsTable.sectorTag,
      count: sql<number>`count(*)::int`,
    })
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.status, "active"),
        eq(jobsTable.tenantId, tenant),
        eq(jobsTable.isCanonical, true),
        sql`${jobsTable.sectorTag} is not null`,
      ),
    )
    .groupBy(jobsTable.sectorTag)
    .orderBy(desc(sql`count(*)`));

  res.json(
    GetIndustryCountsResponse.parse(
      rows.map((r) => ({
        sector: r.sector!,
        label: (SECTOR_LABELS as Record<string, string>)[r.sector!] ?? r.sector!,
        count: r.count,
      })),
    ),
  );
});

// ---------------------------------------------------------------------------
// Role analysis — AI-powered top roles per sector, cached 24h per tenant
// ---------------------------------------------------------------------------

interface RoleAnalysisEntry {
  title: string;
  companies: string[];
}

interface CachedAnalysis {
  data: {
    sectors: Array<{
      sector: string;
      label: string;
      roles: Array<{ title: string; count: number; companies: Array<{ name: string }> }>;
    }>;
    lastUpdatedAt: string | null;
    status: "ready" | "analysing" | "empty";
  };
  cachedAt: Date;
}

const roleAnalysisCache = new Map<string, CachedAnalysis>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isCacheValid(entry: CachedAnalysis): boolean {
  return Date.now() - entry.cachedAt.getTime() < CACHE_TTL_MS;
}

async function runAnalysis(tenant: string, log: { info: (obj: object, msg: string) => void }): Promise<CachedAnalysis["data"]> {
  const jobs = await db
    .select({
      sector: jobsTable.sectorTag,
      title: jobsTable.title,
      company: jobsTable.companyName,
    })
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.status, "active"),
        eq(jobsTable.tenantId, tenant),
        eq(jobsTable.isCanonical, true),
        sql`${jobsTable.sectorTag} is not null`,
      ),
    );

  if (jobs.length === 0) {
    return { sectors: [], lastUpdatedAt: new Date().toISOString(), status: "empty" };
  }

  // Group by sector
  const bySector = new Map<string, Array<{ title: string; company: string }>>();
  for (const j of jobs) {
    if (!j.sector) continue;
    if (!bySector.has(j.sector)) bySector.set(j.sector, []);
    bySector.get(j.sector)!.push({ title: j.title, company: j.company ?? "Unknown" });
  }

  log.info({ event: "role_analysis_start", tenant, sectors: bySector.size }, "Starting AI role analysis");

  const sectorResults = await Promise.all(
    Array.from(bySector.entries()).map(async ([sector, entries]) => {
      const label = (SECTOR_LABELS as Record<string, string>)[sector] ?? sector;

      // Dedupe and cap to keep prompt size manageable
      const seen = new Set<string>();
      const deduped = entries
        .filter((e) => {
          const key = `${e.title.toLowerCase()}|${e.company.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 400);

      const lines = deduped.map((e) => `${e.title} | ${e.company}`).join("\n");

      const prompt = `You are a job market analyst for the financial services industry.

Analyse these job postings from the "${label}" sector. Each line is: "job title | company name"

${lines}

Instructions:
1. Group similar job titles into normalised role names (e.g. "Software Engineer", "Software Developer", "Full Stack Developer" → "Software Engineer").
2. For each normalised role, collect ALL distinct company names from the input that map to it — include every company, do not truncate or cap the list.
3. Return a JSON array of the top 10 roles ranked by the number of distinct companies hiring for them, sorted highest first.

Format (return ONLY the JSON array, no other text):
[{"title":"Normalised Role Name","companies":["Company A","Company B","Company C"]}]`;

      try {
        const { completion } = await chatCompletion({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 3000,
        });

        const text = completion.choices[0]?.message?.content ?? "[]";
        let roles: RoleAnalysisEntry[] = [];
        try {
          // Extract JSON array from response (may have surrounding text)
          const match = text.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) roles = parsed;
          }
        } catch {
          // ignore parse errors
        }

        return {
          sector,
          label,
          roles: roles.slice(0, 10).map((r) => ({
            title: r.title ?? "Unknown Role",
            count: Array.isArray(r.companies) ? r.companies.length : 0,
            companies: (Array.isArray(r.companies) ? r.companies : []).map((c: string) => ({
              name: typeof c === "string" ? c : String(c),
            })),
          })),
        };
      } catch (err) {
        log.info({ event: "role_analysis_sector_error", sector, err: String(err) }, "AI analysis failed for sector");
        return { sector, label, roles: [] };
      }
    }),
  );

  log.info({ event: "role_analysis_complete", tenant }, "AI role analysis complete");

  return {
    sectors: sectorResults.filter((s) => s.roles.length > 0),
    lastUpdatedAt: new Date().toISOString(),
    status: "ready",
  };
}

router.get("/dashboard/role-analysis", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const cached = roleAnalysisCache.get(tenant);

  if (cached && isCacheValid(cached)) {
    res.json(GetRoleAnalysisResponse.parse(cached.data));
    return;
  }

  const data = await runAnalysis(tenant, req.log);
  roleAnalysisCache.set(tenant, { data, cachedAt: new Date() });
  res.json(GetRoleAnalysisResponse.parse(data));
});

router.post("/dashboard/role-analysis/refresh", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  roleAnalysisCache.delete(tenant);
  const data = await runAnalysis(tenant, req.log);
  roleAnalysisCache.set(tenant, { data, cachedAt: new Date() });
  res.json(GetRoleAnalysisResponse.parse(data));
});

export default router;
