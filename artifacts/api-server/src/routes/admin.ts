import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  crmSyncEventsTable,
  candidatesTable,
  jobsTable,
  auditLogsTable,
} from "@workspace/db";
import {
  ListCrmSyncEventsResponse,
  ListAuditLogsResponse,
} from "@workspace/api-zod";
import { toCrmSyncEventDto, toAuditLogDto } from "../lib/dto";

const router: IRouter = Router();

router.get("/crm-sync-events", async (_req, res): Promise<void> => {
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

router.get("/audit-logs", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(200);
  res.json(ListAuditLogsResponse.parse(rows.map(toAuditLogDto)));
});

export default router;
