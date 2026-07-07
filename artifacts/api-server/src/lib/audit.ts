import { db, auditLogsTable } from "@workspace/db";

type DbExecutor = Pick<typeof db, "insert">;

export async function recordAudit(
  entry: {
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: string | null;
    actorName?: string;
    tenantId?: string;
  },
  executor: DbExecutor = db,
): Promise<void> {
  await executor.insert(auditLogsTable).values({
    tenantId: entry.tenantId ?? "demo",
    actorName: entry.actorName ?? "System",
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  });
}
