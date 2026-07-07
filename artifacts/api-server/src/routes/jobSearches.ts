import { Router, type IRouter } from "express";
import { desc, eq, and } from "drizzle-orm";
import { db, savedJobSearchesTable, type SavedJobSearch } from "@workspace/db";
import {
  ListSavedJobSearchesResponse,
  CreateSavedJobSearchBody,
  CreateSavedJobSearchResponse,
  UpdateSavedJobSearchBody,
  UpdateSavedJobSearchResponse,
} from "@workspace/api-zod";
import { recordAudit } from "../lib/audit";
import { tenantOf, auditActor } from "../middlewares/auth";

const router: IRouter = Router();

const paramId = (raw: string | string[]): string =>
  Array.isArray(raw) ? (raw[0] ?? "") : raw;

const toDto = (row: SavedJobSearch): Record<string, unknown> => ({
  id: row.id,
  name: row.name,
  query: row.query,
  location: row.location,
  sector: row.sector,
  sourceType: row.sourceType,
  alertEnabled: row.alertEnabled,
  lastRunAt: row.lastRunAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

router.get("/job-searches", async (req, res): Promise<void> => {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(savedJobSearchesTable)
    .where(
      and(
        eq(savedJobSearchesTable.tenantId, tenantOf(req)),
        eq(savedJobSearchesTable.userId, userId),
      ),
    )
    .orderBy(desc(savedJobSearchesTable.createdAt));
  res.json(ListSavedJobSearchesResponse.parse(rows.map(toDto)));
});

router.post("/job-searches", async (req, res): Promise<void> => {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const parsed = CreateSavedJobSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid saved search input" });
    return;
  }
  const body = parsed.data;
  const [row] = await db
    .insert(savedJobSearchesTable)
    .values({
      tenantId: tenantOf(req),
      userId,
      name: body.name.trim(),
      query: body.query?.trim() ?? "",
      location: body.location?.trim() ?? "",
      sector: body.sector ?? null,
      sourceType: body.sourceType ?? null,
      alertEnabled: body.alertEnabled ?? false,
    })
    .returning();
  if (!row) {
    res.status(500).json({ message: "Failed to save search" });
    return;
  }
  await recordAudit({
    action: "job_search.saved",
    entityType: "saved_job_search",
    entityId: row.id,
    metadata: `Saved search "${row.name}" (alerts ${row.alertEnabled ? "on" : "off"})`,
    ...auditActor(req),
  });
  res.status(201).json(CreateSavedJobSearchResponse.parse(toDto(row)));
});

router.patch("/job-searches/:id", async (req, res): Promise<void> => {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const id = paramId(req.params["id"] ?? "");
  const parsed = UpdateSavedJobSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid update input" });
    return;
  }
  const updates: Partial<{ name: string; alertEnabled: boolean }> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.alertEnabled !== undefined)
    updates.alertEnabled = parsed.data.alertEnabled;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "No changes provided" });
    return;
  }
  const [row] = await db
    .update(savedJobSearchesTable)
    .set(updates)
    .where(
      and(
        eq(savedJobSearchesTable.id, id),
        eq(savedJobSearchesTable.tenantId, tenantOf(req)),
        eq(savedJobSearchesTable.userId, userId),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ message: "Saved search not found" });
    return;
  }
  await recordAudit({
    action: "job_search.updated",
    entityType: "saved_job_search",
    entityId: row.id,
    metadata: `Updated saved search "${row.name}" (alerts ${row.alertEnabled ? "on" : "off"})`,
    ...auditActor(req),
  });
  res.json(UpdateSavedJobSearchResponse.parse(toDto(row)));
});

router.delete("/job-searches/:id", async (req, res): Promise<void> => {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const id = paramId(req.params["id"] ?? "");
  const [row] = await db
    .delete(savedJobSearchesTable)
    .where(
      and(
        eq(savedJobSearchesTable.id, id),
        eq(savedJobSearchesTable.tenantId, tenantOf(req)),
        eq(savedJobSearchesTable.userId, userId),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ message: "Saved search not found" });
    return;
  }
  await recordAudit({
    action: "job_search.deleted",
    entityType: "saved_job_search",
    entityId: row.id,
    metadata: `Deleted saved search "${row.name}"`,
    ...auditActor(req),
  });
  res.status(204).end();
});

export default router;
