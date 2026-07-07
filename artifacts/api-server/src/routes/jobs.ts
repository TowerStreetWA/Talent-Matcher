import { Router, type IRouter } from "express";
import { desc, eq, and, ilike, or } from "drizzle-orm";
import { db, jobsTable, jobSourcesTable } from "@workspace/db";
import { ListJobsResponse, GetJobResponse } from "@workspace/api-zod";
import { toJobDto } from "../lib/dto";
import { tenantOf } from "../middlewares/auth";

const router: IRouter = Router();

const paramId = (raw: string | string[]): string =>
  Array.isArray(raw) ? (raw[0] ?? "") : raw;

router.get("/jobs", async (req, res): Promise<void> => {
  const search = typeof req.query["search"] === "string" ? req.query["search"] : "";
  const sourceId =
    typeof req.query["sourceId"] === "string" ? req.query["sourceId"] : "";
  const status = typeof req.query["status"] === "string" ? req.query["status"] : "";
  const conditions = [eq(jobsTable.tenantId, tenantOf(req))];
  if (search) {
    const like = `%${search}%`;
    const searchCond = or(
      ilike(jobsTable.title, like),
      ilike(jobsTable.companyName, like),
      ilike(jobsTable.locationText, like),
    );
    if (searchCond) conditions.push(searchCond);
  }
  if (sourceId) conditions.push(eq(jobsTable.sourceId, sourceId));
  if (status) conditions.push(eq(jobsTable.status, status));
  const rows = await db
    .select({ job: jobsTable, sourceName: jobSourcesTable.name })
    .from(jobsTable)
    .leftJoin(jobSourcesTable, eq(jobsTable.sourceId, jobSourcesTable.id))
    .where(and(...conditions))
    .orderBy(desc(jobsTable.postedAt))
    .limit(200);
  res.json(
    ListJobsResponse.parse(rows.map((r) => toJobDto(r.job, r.sourceName))),
  );
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const [row] = await db
    .select({ job: jobsTable, sourceName: jobSourcesTable.name })
    .from(jobsTable)
    .leftJoin(jobSourcesTable, eq(jobsTable.sourceId, jobSourcesTable.id))
    .where(and(eq(jobsTable.id, id), eq(jobsTable.tenantId, tenantOf(req))));
  if (!row) {
    res.status(404).json({ message: "Job not found" });
    return;
  }
  res.json(GetJobResponse.parse(toJobDto(row.job, row.sourceName)));
});

export default router;
