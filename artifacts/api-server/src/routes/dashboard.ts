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
} from "@workspace/api-zod";
import { toMatchDto } from "../lib/dto";
import { describeActivity } from "../lib/activityDescription";
import { tenantOf } from "../middlewares/auth";

const router: IRouter = Router();

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

export default router;
