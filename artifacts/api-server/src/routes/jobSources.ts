import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, jobSourcesTable, jobsTable } from "@workspace/db";
import {
  ListJobSourcesResponse,
  CreateJobSourceBody,
  CreateJobSourceResponse,
  UpdateJobSourceBody,
  UpdateJobSourceResponse,
} from "@workspace/api-zod";
import { toJobSourceDto } from "../lib/dto";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

const paramId = (raw: string | string[]): string =>
  Array.isArray(raw) ? (raw[0] ?? "") : raw;

async function jobCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      sourceId: jobsTable.sourceId,
      count: sql<number>`count(*)::int`,
    })
    .from(jobsTable)
    .groupBy(jobsTable.sourceId);
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.sourceId) map.set(r.sourceId, r.count);
  }
  return map;
}

router.get("/job-sources", async (_req, res): Promise<void> => {
  const [rows, counts] = await Promise.all([
    db.select().from(jobSourcesTable).orderBy(desc(jobSourcesTable.createdAt)),
    jobCounts(),
  ]);
  res.json(
    ListJobSourcesResponse.parse(
      rows.map((s) => toJobSourceDto(s, counts.get(s.id) ?? 0)),
    ),
  );
});

router.post("/job-sources", async (req, res): Promise<void> => {
  const parsed = CreateJobSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(jobSourcesTable)
    .values({ ...parsed.data, lastSyncAt: new Date() })
    .returning();
  if (!row) {
    res.status(500).json({ message: "Failed to create job source" });
    return;
  }
  await recordAudit({
    action: "job_source.created",
    entityType: "job_source",
    entityId: row.id,
    metadata: `Source "${row.name}" (${row.sourceType}) registered`,
  });
  res.status(201).json(CreateJobSourceResponse.parse(toJobSourceDto(row, 0)));
});

router.patch("/job-sources/:id", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const parsed = UpdateJobSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(jobSourcesTable)
    .set(parsed.data)
    .where(eq(jobSourcesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ message: "Job source not found" });
    return;
  }
  if (parsed.data.isActive !== undefined) {
    await recordAudit({
      action: parsed.data.isActive
        ? "job_source.enabled"
        : "job_source.disabled",
      entityType: "job_source",
      entityId: row.id,
      metadata: `Source "${row.name}" ${parsed.data.isActive ? "enabled" : "disabled"}`,
    });
  }
  const counts = await jobCounts();
  res.json(
    UpdateJobSourceResponse.parse(toJobSourceDto(row, counts.get(row.id) ?? 0)),
  );
});

export default router;
