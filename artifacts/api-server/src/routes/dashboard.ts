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
import { buildInsuranceHintBlock } from "../lib/search/insuranceSynonyms";
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
// Top pension jobs — 10 most recent active canonical pensions jobs
// ---------------------------------------------------------------------------

router.get("/dashboard/top-pension-jobs", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const rows = await db
    .select({
      id: jobsTable.id,
      title: jobsTable.title,
      companyName: jobsTable.companyName,
      locationText: jobsTable.locationText,
      remoteType: jobsTable.remoteType,
      salaryMin: jobsTable.salaryMin,
      salaryMax: jobsTable.salaryMax,
      salaryCurrency: jobsTable.salaryCurrency,
      postedAt: jobsTable.postedAt,
      applyUrl: jobsTable.applyUrl,
      skills: jobsTable.skills,
    })
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.status, "active"),
        eq(jobsTable.tenantId, tenant),
        eq(jobsTable.isCanonical, true),
        eq(jobsTable.sectorTag, "pensions"),
      ),
    )
    .orderBy(desc(jobsTable.postedAt))
    .limit(10);

  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      companyName: r.companyName ?? "",
      locationText: r.locationText ?? null,
      remoteType: r.remoteType ?? null,
      salaryMin: r.salaryMin ?? null,
      salaryMax: r.salaryMax ?? null,
      salaryCurrency: r.salaryCurrency ?? null,
      postedAt: r.postedAt?.toISOString() ?? null,
      applyUrl: r.applyUrl ?? null,
      skills: r.skills ?? [],
    })),
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
//
// Architecture: AI does ONLY title normalisation (original title → canonical
// role name). All company counting is done here in code from the actual DB
// rows, so company counts are always 100% accurate and never capped.
// ---------------------------------------------------------------------------

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

/**
 * Ask the AI to return a title→canonical mapping for a list of distinct job
 * titles. Company counting is NOT done here — the AI only normalises names.
 */
async function normaliseTitles(
  titles: string[],
  sectorLabel: string,
  log: { info: (obj: object, msg: string) => void },
): Promise<Map<string, string>> {
  if (titles.length === 0) return new Map();

  const synonymHint = buildInsuranceHintBlock();
  const prompt = `You are a job title normaliser for the financial services recruitment industry.

Map each of the following job titles to a short canonical role name. Group similar titles under one canonical name (e.g. "Senior Underwriter", "Property Underwriter", "Casualty Underwriter" all map to "Underwriter"; "Software Engineer", "Full Stack Developer", "Sr. Software Engineer" all map to "Software Engineer").

Sector context: ${sectorLabel}

Insurance-domain equivalences to apply (canonical: alias1, alias2 ...):
${synonymHint}

Return ONLY a valid JSON object where each key is the exact input title and its value is the canonical role name. No markdown, no explanation — just the JSON object.

Titles to normalise:
${JSON.stringify(titles)}`;

  try {
    const { completion } = await chatCompletion({
      model: "gpt-5.4-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      // Each key-value pair is ~50 chars; allow headroom for all titles
      max_tokens: Math.min(8000, Math.max(2000, titles.length * 40)),
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    // Extract the JSON object even if the model adds surrounding text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed: unknown = JSON.parse(match[0]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return new Map(
          Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
            k,
            typeof v === "string" ? v : String(v),
          ]),
        );
      }
    }
  } catch (err) {
    log.info(
      { event: "title_normalise_error", sector: sectorLabel, err: String(err) },
      "Title normalisation failed — using raw titles",
    );
  }
  return new Map(); // fallback: identity mapping (raw titles used as-is)
}

async function runAnalysis(
  tenant: string,
  log: { info: (obj: object, msg: string) => void },
): Promise<CachedAnalysis["data"]> {
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

  // Group all rows by sector
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

      // Dedupe (title, company) pairs — keeps all distinct (title, company)
      // combinations so every hiring company is counted accurately.
      const seen = new Set<string>();
      const deduped = entries.filter((e) => {
        const key = `${e.title.toLowerCase()}|${e.company.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Collect distinct titles to normalise — cap at 300 to stay within
      // token budget; rare titles beyond the cap keep their raw name.
      const distinctTitles = [...new Set(deduped.map((e) => e.title))].slice(0, 300);

      // Step 1 — AI: normalise titles (title → canonical name)
      const titleMap = await normaliseTitles(distinctTitles, label, log);

      // Step 2 — code: group by canonical name, collect distinct companies
      const roleCompanies = new Map<string, Set<string>>();
      for (const entry of deduped) {
        const canonical = titleMap.get(entry.title) ?? entry.title;
        if (!roleCompanies.has(canonical)) roleCompanies.set(canonical, new Set());
        roleCompanies.get(canonical)!.add(entry.company);
      }

      // Step 3 — code: sort by company count, take top 10
      const roles = Array.from(roleCompanies.entries())
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 10)
        .map(([title, companies]) => ({
          title,
          count: companies.size,
          companies: Array.from(companies).map((name) => ({ name })),
        }));

      log.info(
        { event: "role_analysis_sector_done", sector, roles: roles.length, topCount: roles[0]?.count },
        "Sector role analysis complete",
      );

      return { sector, label, roles };
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
