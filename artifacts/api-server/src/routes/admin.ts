import { Router, type IRouter } from "express";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import {
  db,
  crmSyncEventsTable,
  candidatesTable,
  jobsTable,
  auditLogsTable,
  searchEventsTable,
  tenantUsersTable,
} from "@workspace/db";
import {
  ListCrmSyncEventsResponse,
  ListAuditLogsResponse,
  GetUsageReportResponse,
} from "@workspace/api-zod";
import { toCrmSyncEventDto, toAuditLogDto } from "../lib/dto";
import { tenantOf } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/crm-sync-events", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      event: crmSyncEventsTable,
      candFirst: candidatesTable.firstName,
      candLast: candidatesTable.lastName,
      jobTitle: jobsTable.title,
    })
    .from(crmSyncEventsTable)
    .leftJoin(
      candidatesTable,
      eq(crmSyncEventsTable.candidateId, candidatesTable.id),
    )
    .leftJoin(jobsTable, eq(crmSyncEventsTable.jobId, jobsTable.id))
    .where(eq(crmSyncEventsTable.tenantId, tenantOf(req)))
    .orderBy(desc(crmSyncEventsTable.createdAt))
    .limit(100);
  res.json(
    ListCrmSyncEventsResponse.parse(
      rows.map((r) =>
        toCrmSyncEventDto(
          r.event,
          r.candFirst ? `${r.candFirst} ${r.candLast}` : null,
          r.jobTitle,
        ),
      ),
    ),
  );
});

router.get("/audit-logs", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.tenantId, tenantOf(req)))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(200);
  res.json(ListAuditLogsResponse.parse(rows.map(toAuditLogDto)));
});

router.get("/admin/usage-report", async (req, res): Promise<void> => {
  const tenantSlug = tenantOf(req);
  const tenantUuid = req.auth?.tenantId;
  if (!tenantUuid) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // Parse date range — default to last 30 days
  const toDate = req.query["to"]
    ? new Date(`${req.query["to"] as string}T23:59:59Z`)
    : new Date();
  const fromDate = req.query["from"]
    ? new Date(`${req.query["from"] as string}T00:00:00Z`)
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  // All team members for this tenant
  const members = await db
    .select({
      id: tenantUsersTable.id,
      fullName: tenantUsersTable.fullName,
      email: tenantUsersTable.email,
      role: tenantUsersTable.role,
    })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.tenantId, tenantUuid));

  // Search event aggregates per userId within the date window
  const searchAggs = await db
    .select({
      userId: searchEventsTable.userId,
      searches: sql<number>`cast(count(*) as int)`,
      resultsReturned: sql<number>`cast(coalesce(sum(${searchEventsTable.resultsCount}),0) as int)`,
      zeroResultSearches: sql<number>`cast(sum(case when ${searchEventsTable.zeroResults} then 1 else 0 end) as int)`,
      lastSearchAt: sql<string | null>`max(${searchEventsTable.createdAt})`,
    })
    .from(searchEventsTable)
    .where(
      and(
        eq(searchEventsTable.tenantId, tenantSlug),
        gte(searchEventsTable.createdAt, fromDate),
        lte(searchEventsTable.createdAt, toDate),
      ),
    )
    .groupBy(searchEventsTable.userId);

  // CRM push counts per actorName from audit_logs
  const crmAggs = await db
    .select({
      actorName: auditLogsTable.actorName,
      crmPushes: sql<number>`cast(count(*) as int)`,
    })
    .from(auditLogsTable)
    .where(
      and(
        eq(auditLogsTable.tenantId, tenantSlug),
        eq(auditLogsTable.action, "match.pushed_to_crm"),
        gte(auditLogsTable.createdAt, fromDate),
        lte(auditLogsTable.createdAt, toDate),
      ),
    )
    .groupBy(auditLogsTable.actorName);

  // Build lookup maps
  const searchByUserId = new Map(
    searchAggs.map((r) => [r.userId ?? "__anon__", r]),
  );
  const crmByActorName = new Map(crmAggs.map((r) => [r.actorName, r.crmPushes]));

  // Per-user rows — include all members even if they have zero activity
  const byUser = members.map((m) => {
    const s = searchByUserId.get(m.id) ?? null;
    const searches = s?.searches ?? 0;
    const resultsReturned = s?.resultsReturned ?? 0;
    const zeroResultSearches = s?.zeroResultSearches ?? 0;
    const avgResultsPerSearch =
      searches > 0 ? Math.round((resultsReturned / searches) * 10) / 10 : 0;
    const crmPushes = crmByActorName.get(m.fullName) ?? 0;
    return {
      userId: m.id,
      userName: m.fullName,
      email: m.email,
      role: m.role,
      searches,
      resultsReturned,
      zeroResultSearches,
      avgResultsPerSearch,
      crmPushes,
      lastSearchAt: s?.lastSearchAt
        ? new Date(s.lastSearchAt).toISOString()
        : null,
    };
  });

  // Aggregate totals
  const totalSearches = byUser.reduce((n, u) => n + u.searches, 0);
  const totalResultsReturned = byUser.reduce((n, u) => n + u.resultsReturned, 0);
  const totalZeroResultSearches = byUser.reduce(
    (n, u) => n + u.zeroResultSearches,
    0,
  );
  const totalCrmPushes = byUser.reduce((n, u) => n + u.crmPushes, 0);
  const avgResultsPerSearch =
    totalSearches > 0
      ? Math.round((totalResultsReturned / totalSearches) * 10) / 10
      : 0;

  res.json(
    GetUsageReportResponse.parse({
      period: {
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
      },
      aggregate: {
        searches: totalSearches,
        resultsReturned: totalResultsReturned,
        zeroResultSearches: totalZeroResultSearches,
        avgResultsPerSearch,
        crmPushes: totalCrmPushes,
      },
      byUser,
    }),
  );
});

export default router;
