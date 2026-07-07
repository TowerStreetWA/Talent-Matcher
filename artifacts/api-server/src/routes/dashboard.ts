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

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
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
    db.select({ c: sql<number>`count(*)::int` }).from(candidatesTable),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(eq(jobsTable.status, "active")),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobSourcesTable)
      .where(eq(jobSourcesTable.isActive, true)),
    db.select({ c: sql<number>`count(*)::int` }).from(matchRunsTable),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(matchesTable)
      .where(eq(matchesTable.recruiterStatus, "shortlisted")),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(matchesTable)
      .where(eq(matchesTable.pushedToCrm, true)),
    db
      .select({
        avg: sql<number>`coalesce(avg(${candidatesTable.bestMatchScore}), 0)::float`,
      })
      .from(candidatesTable)
      .where(sql`${candidatesTable.bestMatchScore} is not null`),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(matchesTable)
      .where(gte(matchesTable.createdAt, weekAgo)),
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

router.get("/dashboard/activity", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(15);
  res.json(
    GetRecentActivityResponse.parse(
      rows.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        description: l.metadata ?? l.action,
        createdAt: l.createdAt.toISOString(),
      })),
    ),
  );
});

router.get("/dashboard/top-matches", async (_req, res): Promise<void> => {
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
    .where(and(eq(matchesTable.recruiterStatus, "new")))
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
