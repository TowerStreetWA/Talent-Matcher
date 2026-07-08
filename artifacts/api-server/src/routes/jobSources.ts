import { Router, type IRouter } from "express";
import { desc, eq, and, sql } from "drizzle-orm";
import { db, jobSourcesTable, jobsTable } from "@workspace/db";
import {
  ListJobSourcesResponse,
  CreateJobSourceBody,
  CreateJobSourceResponse,
  UpdateJobSourceBody,
  UpdateJobSourceResponse,
} from "@workspace/api-zod";
import {
  toJobSourceDto,
  EMPTY_JOB_SOURCE_METRICS,
  type JobSourceMetrics,
} from "../lib/dto";
import { recordAudit } from "../lib/audit";
import { tenantOf, auditActor } from "../middlewares/auth";

const router: IRouter = Router();

const paramId = (raw: string | string[]): string =>
  Array.isArray(raw) ? (raw[0] ?? "") : raw;

async function jobMetrics(tenant: string): Promise<Map<string, JobSourceMetrics>> {
  const rows = await db
    .select({
      sourceId: jobsTable.sourceId,
      totalJobs: sql<number>`count(*)::int`,
      activeJobs: sql<number>`count(*) filter (where ${jobsTable.status} = 'active')::int`,
      canonicalJobs: sql<number>`count(*) filter (where ${jobsTable.status} = 'active' and ${jobsTable.isCanonical})::int`,
      duplicateJobs: sql<number>`count(*) filter (where not ${jobsTable.isCanonical})::int`,
    })
    .from(jobsTable)
    .where(eq(jobsTable.tenantId, tenant))
    .groupBy(jobsTable.sourceId);
  const map = new Map<string, JobSourceMetrics>();
  for (const r of rows) {
    if (r.sourceId) {
      map.set(r.sourceId, {
        totalJobs: r.totalJobs,
        activeJobs: r.activeJobs,
        canonicalJobs: r.canonicalJobs,
        duplicateJobs: r.duplicateJobs,
      });
    }
  }
  return map;
}

router.get("/job-sources", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const [rows, metrics] = await Promise.all([
    db
      .select()
      .from(jobSourcesTable)
      .where(eq(jobSourcesTable.tenantId, tenant))
      .orderBy(desc(jobSourcesTable.createdAt)),
    jobMetrics(tenant),
  ]);
  res.json(
    ListJobSourcesResponse.parse(
      rows.map((s) =>
        toJobSourceDto(s, metrics.get(s.id) ?? EMPTY_JOB_SOURCE_METRICS),
      ),
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
    .values({ ...parsed.data, tenantId: tenantOf(req), lastSyncAt: new Date() })
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
    ...auditActor(req),
  });
  res
    .status(201)
    .json(
      CreateJobSourceResponse.parse(
        toJobSourceDto(row, EMPTY_JOB_SOURCE_METRICS),
      ),
    );
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
    .where(
      and(
        eq(jobSourcesTable.id, id),
        eq(jobSourcesTable.tenantId, tenantOf(req)),
      ),
    )
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
      ...auditActor(req),
    });
  }
  const metrics = await jobMetrics(tenantOf(req));
  res.json(
    UpdateJobSourceResponse.parse(
      toJobSourceDto(row, metrics.get(row.id) ?? EMPTY_JOB_SOURCE_METRICS),
    ),
  );
});

export default router;
