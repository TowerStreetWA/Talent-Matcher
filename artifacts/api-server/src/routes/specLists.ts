import { Router, type IRouter } from "express";
import { eq, and, asc, count, sql } from "drizzle-orm";
import {
  db,
  candidatesTable,
  jobsTable,
  specListsTable,
  specListItemsTable,
} from "@workspace/db";
import {
  ListSpecListsResponse,
  CreateSpecListBody,
  CreateSpecListResponse,
  GetSpecListResponse,
  AddSpecListItemBody,
  AddSpecListItemResponse,
  UpdateSpecListItemBody,
  UpdateSpecListItemResponse,
} from "@workspace/api-zod";
import { tenantOf, auditActor } from "../middlewares/auth";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

function toSpecListDto(
  row: typeof specListsTable.$inferSelect,
  itemCount: number,
) {
  return {
    id: row.id,
    candidateId: row.candidateId,
    createdBy: row.createdBy,
    title: row.title ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    itemCount,
  };
}

function toItemDto(
  item: typeof specListItemsTable.$inferSelect,
  job: typeof jobsTable.$inferSelect,
) {
  return {
    id: item.id,
    specListId: item.specListId,
    vacancyId: item.vacancyId,
    note: item.note ?? null,
    status: item.status,
    statusUpdatedAt: item.statusUpdatedAt?.toISOString() ?? null,
    sortOrder: item.sortOrder,
    jobTitle: job.title,
    companyName: job.companyName,
    locationText: job.locationText ?? null,
    applyUrl: job.applyUrl ?? null,
    salaryText: job.salaryText ?? null,
  };
}

// GET /candidates/:id/spec-lists
router.get("/candidates/:id/spec-lists", async (req, res): Promise<void> => {
  const candidateId = req.params["id"] ?? "";
  const tenant = tenantOf(req);

  const candidate = await db
    .select({ id: candidatesTable.id })
    .from(candidatesTable)
    .where(and(eq(candidatesTable.id, candidateId), eq(candidatesTable.tenantId, tenant)))
    .limit(1);
  if (!candidate.length) {
    res.status(404).json({ message: "Candidate not found" });
    return;
  }

  const lists = await db
    .select()
    .from(specListsTable)
    .where(and(eq(specListsTable.candidateId, candidateId), eq(specListsTable.tenantId, tenant)))
    .orderBy(asc(specListsTable.createdAt));

  const counts = lists.length
    ? await db
        .select({ specListId: specListItemsTable.specListId, cnt: count() })
        .from(specListItemsTable)
        .where(
          sql`${specListItemsTable.specListId} = ANY(ARRAY[${sql.join(
            lists.map((l) => sql`${l.id}::uuid`),
            sql`, `,
          )}])`,
        )
        .groupBy(specListItemsTable.specListId)
    : [];

  const countMap = new Map(counts.map((c) => [c.specListId, c.cnt]));
  const dtos = lists.map((l) => toSpecListDto(l, countMap.get(l.id) ?? 0));

  res.json(ListSpecListsResponse.parse(dtos));
});

// POST /candidates/:id/spec-lists
router.post("/candidates/:id/spec-lists", async (req, res): Promise<void> => {
  const candidateId = req.params["id"] ?? "";
  const tenant = tenantOf(req);

  const candidate = await db
    .select({ id: candidatesTable.id })
    .from(candidatesTable)
    .where(and(eq(candidatesTable.id, candidateId), eq(candidatesTable.tenantId, tenant)))
    .limit(1);
  if (!candidate.length) {
    res.status(404).json({ message: "Candidate not found" });
    return;
  }

  const parsed = CreateSpecListBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(specListsTable)
    .values({
      tenantId: tenant,
      candidateId,
      createdBy: req.auth!.userId,
      title: parsed.data.title ?? null,
    })
    .returning();

  if (!row) {
    res.status(500).json({ message: "Insert failed" });
    return;
  }

  await recordAudit({
    action: "spec_list.created",
    entityType: "spec_list",
    entityId: row.id,
    ...auditActor(req),
  });

  res.status(201).json(CreateSpecListResponse.parse({ ...toSpecListDto(row, 0), items: [] }));
});

// GET /spec-lists/:id
router.get("/spec-lists/:id", async (req, res): Promise<void> => {
  const id = req.params["id"] ?? "";
  const tenant = tenantOf(req);

  const [list] = await db
    .select()
    .from(specListsTable)
    .where(and(eq(specListsTable.id, id), eq(specListsTable.tenantId, tenant)))
    .limit(1);

  if (!list) {
    res.status(404).json({ message: "Spec list not found" });
    return;
  }

  const items = await db
    .select()
    .from(specListItemsTable)
    .where(eq(specListItemsTable.specListId, id))
    .orderBy(asc(specListItemsTable.sortOrder), asc(specListItemsTable.id));

  const jobIds = items.map((i) => i.vacancyId);
  const jobs = jobIds.length
    ? await db
        .select()
        .from(jobsTable)
        .where(
          sql`${jobsTable.id} = ANY(ARRAY[${sql.join(
            jobIds.map((jid) => sql`${jid}::uuid`),
            sql`, `,
          )}])`,
        )
    : [];

  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const itemDtos = items
    .map((item) => {
      const job = jobMap.get(item.vacancyId);
      return job ? toItemDto(item, job) : null;
    })
    .filter(Boolean);

  res.json(
    GetSpecListResponse.parse({ ...toSpecListDto(list, itemDtos.length), items: itemDtos }),
  );
});

// DELETE /spec-lists/:id
router.delete("/spec-lists/:id", async (req, res): Promise<void> => {
  const id = req.params["id"] ?? "";
  const tenant = tenantOf(req);

  const [list] = await db
    .select({ id: specListsTable.id })
    .from(specListsTable)
    .where(and(eq(specListsTable.id, id), eq(specListsTable.tenantId, tenant)))
    .limit(1);

  if (!list) {
    res.status(404).json({ message: "Spec list not found" });
    return;
  }

  await db.delete(specListsTable).where(eq(specListsTable.id, id));

  await recordAudit({
    action: "spec_list.deleted",
    entityType: "spec_list",
    entityId: id,
    ...auditActor(req),
  });

  res.json({ message: "Deleted" });
});

// POST /spec-lists/:id/items
router.post("/spec-lists/:id/items", async (req, res): Promise<void> => {
  const specListId = req.params["id"] ?? "";
  const tenant = tenantOf(req);

  const [list] = await db
    .select()
    .from(specListsTable)
    .where(and(eq(specListsTable.id, specListId), eq(specListsTable.tenantId, tenant)))
    .limit(1);

  if (!list) {
    res.status(404).json({ message: "Spec list not found" });
    return;
  }

  const parsed = AddSpecListItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const { vacancyId, note, sortOrder } = parsed.data;

  const job = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, vacancyId))
    .limit(1);

  if (!job.length || !job[0]) {
    res.status(404).json({ message: "Vacancy not found" });
    return;
  }

  const existing = await db
    .select({ id: specListItemsTable.id })
    .from(specListItemsTable)
    .where(
      and(
        eq(specListItemsTable.specListId, specListId),
        eq(specListItemsTable.vacancyId, vacancyId),
      ),
    )
    .limit(1);

  if (existing.length) {
    res.status(409).json({ message: "Vacancy already in this spec list" });
    return;
  }

  const [item] = await db
    .insert(specListItemsTable)
    .values({
      specListId,
      vacancyId,
      note: note ?? null,
      sortOrder: sortOrder ?? 0,
    })
    .returning();

  if (!item) {
    res.status(500).json({ message: "Insert failed" });
    return;
  }

  await db
    .update(specListsTable)
    .set({ updatedAt: new Date() })
    .where(eq(specListsTable.id, specListId));

  res.status(201).json(AddSpecListItemResponse.parse(toItemDto(item, job[0])));
});

// PATCH /spec-lists/:id/items/:itemId
router.patch("/spec-lists/:id/items/:itemId", async (req, res): Promise<void> => {
  const specListId = req.params["id"] ?? "";
  const itemId = req.params["itemId"] ?? "";
  const tenant = tenantOf(req);

  const [list] = await db
    .select({ id: specListsTable.id })
    .from(specListsTable)
    .where(and(eq(specListsTable.id, specListId), eq(specListsTable.tenantId, tenant)))
    .limit(1);

  if (!list) {
    res.status(404).json({ message: "Spec list not found" });
    return;
  }

  const parsed = UpdateSpecListItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const updates: Partial<typeof specListItemsTable.$inferInsert> = {};
  if ("note" in parsed.data) updates.note = parsed.data.note ?? null;
  if ("sortOrder" in parsed.data && parsed.data.sortOrder !== undefined)
    updates.sortOrder = parsed.data.sortOrder;
  if ("status" in parsed.data && parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    updates.statusUpdatedAt = new Date();
  }

  const [item] = await db
    .update(specListItemsTable)
    .set(updates)
    .where(
      and(eq(specListItemsTable.id, itemId), eq(specListItemsTable.specListId, specListId)),
    )
    .returning();

  if (!item) {
    res.status(404).json({ message: "Item not found" });
    return;
  }

  await db
    .update(specListsTable)
    .set({ updatedAt: new Date() })
    .where(eq(specListsTable.id, specListId));

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, item.vacancyId))
    .limit(1);

  if (!job) {
    res.status(500).json({ message: "Job not found" });
    return;
  }

  res.json(UpdateSpecListItemResponse.parse(toItemDto(item, job)));
});

// DELETE /spec-lists/:id/items/:itemId
router.delete("/spec-lists/:id/items/:itemId", async (req, res): Promise<void> => {
  const specListId = req.params["id"] ?? "";
  const itemId = req.params["itemId"] ?? "";
  const tenant = tenantOf(req);

  const [list] = await db
    .select({ id: specListsTable.id })
    .from(specListsTable)
    .where(and(eq(specListsTable.id, specListId), eq(specListsTable.tenantId, tenant)))
    .limit(1);

  if (!list) {
    res.status(404).json({ message: "Spec list not found" });
    return;
  }

  const deleted = await db
    .delete(specListItemsTable)
    .where(
      and(eq(specListItemsTable.id, itemId), eq(specListItemsTable.specListId, specListId)),
    )
    .returning({ id: specListItemsTable.id });

  if (!deleted.length) {
    res.status(404).json({ message: "Item not found" });
    return;
  }

  await db
    .update(specListsTable)
    .set({ updatedAt: new Date() })
    .where(eq(specListsTable.id, specListId));

  res.json({ message: "Removed" });
});

export default router;
