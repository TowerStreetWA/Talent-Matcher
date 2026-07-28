import { Router, type IRouter } from "express";
import { eq, and, asc, count, sql } from "drizzle-orm";
import {
  db,
  jobsTable,
  jobSpecFoldersTable,
  jobSpecFolderItemsTable,
  jobSpecContactsTable,
  jobSpecSearchConfigTable,
  type JobSpecFolder,
  type JobSpecFolderItem,
  type JobSpecContact,
} from "@workspace/db";
import { tenantOf, auditActor } from "../middlewares/auth";
import { recordAudit } from "../lib/audit";
import {
  enrichCompany,
  DEFAULT_TARGET_TITLES,
  DEFAULT_MANAGER_TITLES,
} from "../lib/apolloEnrichment";
import { z } from "zod/v4";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// DTO helpers
// ---------------------------------------------------------------------------

function toFolderDto(
  row: JobSpecFolder,
  itemCount: number,
) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    ownerUserId: row.ownerUserId ?? null,
    visibility: row.visibility,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    itemCount,
  };
}

function toContactDto(c: JobSpecContact) {
  return {
    id: c.id,
    folderItemId: c.folderItemId,
    fullName: c.fullName,
    title: c.title ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    linkedinUrl: c.linkedinUrl ?? null,
    contactType: c.contactType,
    source: c.source,
    confidence: c.confidence,
    createdAt: c.createdAt.toISOString(),
  };
}

function toItemDto(
  item: JobSpecFolderItem,
  job: typeof jobsTable.$inferSelect,
  contacts: JobSpecContact[],
) {
  return {
    id: item.id,
    folderId: item.folderId,
    jobId: item.jobId,
    addedBy: item.addedBy,
    note: item.note ?? null,
    status: item.status,
    sortOrder: item.sortOrder,
    addedAt: item.addedAt.toISOString(),
    job: {
      id: job.id,
      title: job.title,
      companyName: job.companyName ?? null,
      locationText: job.locationText ?? null,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      salaryCurrency: job.salaryCurrency ?? null,
      salaryText: job.salaryText ?? null,
      applyUrl: job.applyUrl ?? null,
      sourceProvider: job.sourceProvider ?? null,
      sectorTag: job.sectorTag ?? null,
      postedAt: job.postedAt?.toISOString() ?? null,
    },
    contacts: contacts.map(toContactDto),
  };
}

// ---------------------------------------------------------------------------
// Ensure default team folder exists for tenant (idempotent)
// ---------------------------------------------------------------------------
async function ensureTeamFolder(
  tenantId: string,
  userId: string,
): Promise<JobSpecFolder> {
  const [existing] = await db
    .select()
    .from(jobSpecFoldersTable)
    .where(
      and(
        eq(jobSpecFoldersTable.tenantId, tenantId),
        eq(jobSpecFoldersTable.visibility, "team"),
        sql`${jobSpecFoldersTable.ownerUserId} IS NULL`,
      ),
    )
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(jobSpecFoldersTable)
    .values({
      tenantId,
      name: "Team Spec List",
      visibility: "team",
      ownerUserId: null,
      createdBy: userId,
    })
    .returning();
  return created!;
}

// ---------------------------------------------------------------------------
// Resolve Apollo search config for a job
// ---------------------------------------------------------------------------
async function resolveSearchConfig(
  tenantId: string,
  sectorTag: string | null,
  jobTitle: string,
): Promise<{ targetTitles: string[]; managerTitles: string[]; confidence: "high" | "best_guess" }> {
  const configs = await db
    .select()
    .from(jobSpecSearchConfigTable)
    .where(eq(jobSpecSearchConfigTable.tenantId, tenantId));

  // Priority 1: exact sector match
  if (sectorTag) {
    const sectorMatch = configs.find(
      (c) => c.sectorTag === sectorTag && !c.jobTitleKeyword,
    );
    if (sectorMatch) {
      return {
        targetTitles: sectorMatch.targetTitles,
        managerTitles: sectorMatch.managerTitles,
        confidence: "high",
      };
    }
  }

  // Priority 2: job title keyword match (case-insensitive substring)
  const titleLower = jobTitle.toLowerCase();
  const titleMatch = configs.find(
    (c) =>
      c.jobTitleKeyword &&
      titleLower.includes(c.jobTitleKeyword.toLowerCase()),
  );
  if (titleMatch) {
    return {
      targetTitles: titleMatch.targetTitles,
      managerTitles: titleMatch.managerTitles,
      confidence: "high",
    };
  }

  // Priority 3: tenant-level default override (no sector, no keyword)
  const tenantDefault = configs.find(
    (c) => !c.sectorTag && !c.jobTitleKeyword,
  );
  if (tenantDefault) {
    return {
      targetTitles: tenantDefault.targetTitles,
      managerTitles: tenantDefault.managerTitles,
      confidence: "best_guess",
    };
  }

  // Fallback: hard-coded generic defaults
  return {
    targetTitles: DEFAULT_TARGET_TITLES,
    managerTitles: DEFAULT_MANAGER_TITLES,
    confidence: "best_guess",
  };
}

// ---------------------------------------------------------------------------
// Run enrichment for a folder item — delete existing Apollo contacts, re-fetch
// ---------------------------------------------------------------------------
async function runEnrichment(
  itemId: string,
  tenantId: string,
  companyName: string,
  sectorTag: string | null,
  jobTitle: string,
): Promise<JobSpecContact[]> {
  const { targetTitles, managerTitles, confidence } =
    await resolveSearchConfig(tenantId, sectorTag, jobTitle);

  const { taContacts, managerContacts } = await enrichCompany(
    companyName,
    targetTitles,
    managerTitles,
  );

  // Remove previous Apollo-sourced contacts for this item
  await db
    .delete(jobSpecContactsTable)
    .where(
      and(
        eq(jobSpecContactsTable.folderItemId, itemId),
        eq(jobSpecContactsTable.source, "apollo"),
      ),
    );

  const toInsert = [
    ...taContacts.map((c) => ({
      folderItemId: itemId,
      fullName: c.fullName,
      title: c.title ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      linkedinUrl: c.linkedinUrl ?? null,
      contactType: "talent_acquisition" as const,
      source: "apollo" as const,
      confidence,
    })),
    ...managerContacts.map((c) => ({
      folderItemId: itemId,
      fullName: c.fullName,
      title: c.title ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      linkedinUrl: c.linkedinUrl ?? null,
      contactType: "hiring_manager" as const,
      source: "apollo" as const,
      confidence,
    })),
  ];

  if (!toInsert.length) return [];
  return db.insert(jobSpecContactsTable).values(toInsert).returning();
}

// ---------------------------------------------------------------------------
// GET /spec-folders
// ---------------------------------------------------------------------------
router.get("/spec-folders", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const userId = req.auth!.userId;

  // Ensure default team folder exists
  await ensureTeamFolder(tenant, userId);

  const folders = await db
    .select()
    .from(jobSpecFoldersTable)
    .where(
      and(
        eq(jobSpecFoldersTable.tenantId, tenant),
        // Show team folders + own personal folders
        sql`(${jobSpecFoldersTable.visibility} = 'team' OR ${jobSpecFoldersTable.ownerUserId} = ${userId})`,
      ),
    )
    .orderBy(
      asc(jobSpecFoldersTable.visibility), // team first
      asc(jobSpecFoldersTable.createdAt),
    );

  // Count items per folder
  const folderIds = folders.map((f) => f.id);
  const counts =
    folderIds.length > 0
      ? await db
          .select({
            folderId: jobSpecFolderItemsTable.folderId,
            cnt: count(),
          })
          .from(jobSpecFolderItemsTable)
          .where(
            sql`${jobSpecFolderItemsTable.folderId} = ANY(ARRAY[${sql.join(folderIds.map((id) => sql`${id}::uuid`))}])`,
          )
          .groupBy(jobSpecFolderItemsTable.folderId)
      : [];
  const countMap = new Map(counts.map((c) => [c.folderId, c.cnt]));

  res.json(folders.map((f) => toFolderDto(f, countMap.get(f.id) ?? 0)));
});

// ---------------------------------------------------------------------------
// POST /spec-folders
// ---------------------------------------------------------------------------
const CreateFolderBody = z.object({
  name: z.string().min(1),
  visibility: z.enum(["team", "personal"]).default("personal"),
});

router.post("/spec-folders", async (req, res): Promise<void> => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const tenant = tenantOf(req);
  const actor = auditActor(req);
  const userId = req.auth!.userId;

  const [folder] = await db
    .insert(jobSpecFoldersTable)
    .values({
      tenantId: tenant,
      name: parsed.data.name,
      visibility: parsed.data.visibility,
      ownerUserId: parsed.data.visibility === "personal" ? userId : null,
      createdBy: userId,
    })
    .returning();
  if (!folder) { res.status(500).json({ message: "Failed to create folder" }); return; }

  await recordAudit({
    action: "spec_folder.created",
    entityType: "spec_folder",
    entityId: folder.id,
    metadata: `Created folder "${folder.name}" (${folder.visibility})`,
    ...actor,
  });

  res.status(201).json(toFolderDto(folder, 0));
});

// ---------------------------------------------------------------------------
// PATCH /spec-folders/:id
// ---------------------------------------------------------------------------
router.patch("/spec-folders/:id", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const id = req.params["id"] ?? "";
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [existing] = await db
    .select()
    .from(jobSpecFoldersTable)
    .where(and(eq(jobSpecFoldersTable.id, id), eq(jobSpecFoldersTable.tenantId, tenant)))
    .limit(1);
  if (!existing) { res.status(404).json({ message: "Folder not found" }); return; }

  const [updated] = await db
    .update(jobSpecFoldersTable)
    .set({ name: parsed.data.name })
    .where(eq(jobSpecFoldersTable.id, id))
    .returning();

  const [cnt] = await db
    .select({ cnt: count() })
    .from(jobSpecFolderItemsTable)
    .where(eq(jobSpecFolderItemsTable.folderId, id));
  res.json(toFolderDto(updated!, cnt?.cnt ?? 0));
});

// ---------------------------------------------------------------------------
// DELETE /spec-folders/:id
// ---------------------------------------------------------------------------
router.delete("/spec-folders/:id", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const actor = auditActor(req);
  const id = req.params["id"] ?? "";

  const [existing] = await db
    .select()
    .from(jobSpecFoldersTable)
    .where(and(eq(jobSpecFoldersTable.id, id), eq(jobSpecFoldersTable.tenantId, tenant)))
    .limit(1);
  if (!existing) { res.status(404).json({ message: "Folder not found" }); return; }

  await db.delete(jobSpecFoldersTable).where(eq(jobSpecFoldersTable.id, id));
  await recordAudit({
    action: "spec_folder.deleted",
    entityType: "spec_folder",
    entityId: id,
    metadata: `Deleted folder "${existing.name}"`,
    ...actor,
  });
  res.json({ message: "Folder deleted" });
});

// ---------------------------------------------------------------------------
// GET /spec-folders/:id/items
// ---------------------------------------------------------------------------
router.get("/spec-folders/:id/items", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const folderId = req.params["id"] ?? "";

  const [folder] = await db
    .select()
    .from(jobSpecFoldersTable)
    .where(and(eq(jobSpecFoldersTable.id, folderId), eq(jobSpecFoldersTable.tenantId, tenant)))
    .limit(1);
  if (!folder) { res.status(404).json({ message: "Folder not found" }); return; }

  const items = await db
    .select()
    .from(jobSpecFolderItemsTable)
    .where(eq(jobSpecFolderItemsTable.folderId, folderId))
    .orderBy(asc(jobSpecFolderItemsTable.sortOrder), asc(jobSpecFolderItemsTable.addedAt));

  if (!items.length) { res.json([]); return; }

  const jobIds = [...new Set(items.map((i) => i.jobId))];
  const itemIds = items.map((i) => i.id);

  const [jobs, contacts] = await Promise.all([
    db.select().from(jobsTable).where(
      sql`${jobsTable.id} = ANY(ARRAY[${sql.join(jobIds.map((id) => sql`${id}::uuid`))}])`,
    ),
    db.select().from(jobSpecContactsTable).where(
      sql`${jobSpecContactsTable.folderItemId} = ANY(ARRAY[${sql.join(itemIds.map((id) => sql`${id}::uuid`))}])`,
    ),
  ]);

  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const contactMap = new Map<string, JobSpecContact[]>();
  for (const c of contacts) {
    const arr = contactMap.get(c.folderItemId) ?? [];
    arr.push(c);
    contactMap.set(c.folderItemId, arr);
  }

  const dtos = items.map((item) => {
    const job = jobMap.get(item.jobId);
    if (!job) return null;
    return toItemDto(item, job, contactMap.get(item.id) ?? []);
  }).filter(Boolean);

  res.json(dtos);
});

// ---------------------------------------------------------------------------
// POST /spec-folders/:id/items
// ---------------------------------------------------------------------------
const AddItemBody = z.object({
  jobId: z.string().uuid(),
  note: z.string().optional(),
});

router.post("/spec-folders/:id/items", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const actor = auditActor(req);
  const userId = req.auth!.userId;
  const folderId = req.params["id"] ?? "";

  const parsed = AddItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [folder] = await db
    .select()
    .from(jobSpecFoldersTable)
    .where(and(eq(jobSpecFoldersTable.id, folderId), eq(jobSpecFoldersTable.tenantId, tenant)))
    .limit(1);
  if (!folder) { res.status(404).json({ message: "Folder not found" }); return; }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, parsed.data.jobId), eq(jobsTable.tenantId, tenant)))
    .limit(1);
  if (!job) { res.status(404).json({ message: "Job not found" }); return; }

  // Duplicate check
  const [dup] = await db
    .select({ id: jobSpecFolderItemsTable.id })
    .from(jobSpecFolderItemsTable)
    .where(
      and(
        eq(jobSpecFolderItemsTable.folderId, folderId),
        eq(jobSpecFolderItemsTable.jobId, parsed.data.jobId),
      ),
    )
    .limit(1);
  if (dup) { res.status(409).json({ message: "Job already in this folder" }); return; }

  // Get current max sort order
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${jobSpecFolderItemsTable.sortOrder}), -1)` })
    .from(jobSpecFolderItemsTable)
    .where(eq(jobSpecFolderItemsTable.folderId, folderId));

  const [item] = await db
    .insert(jobSpecFolderItemsTable)
    .values({
      folderId,
      jobId: job.id,
      addedBy: userId,
      note: parsed.data.note ?? null,
      sortOrder: (maxRow?.max ?? -1) + 1,
    })
    .returning();
  if (!item) { res.status(500).json({ message: "Failed to add item" }); return; }

  await recordAudit({
    action: "spec_folder.item_added",
    entityType: "spec_folder_item",
    entityId: item.id,
    metadata: `Added "${job.title}" @ ${job.companyName ?? "unknown"} to folder "${folder.name}"`,
    ...actor,
  });

  // Fire-and-forget Apollo enrichment
  if (job.companyName) {
    runEnrichment(item.id, tenant, job.companyName, job.sectorTag ?? null, job.title).catch(
      (err) => req.log.error({ err, itemId: item.id }, "Apollo enrichment failed"),
    );
  }

  res.status(201).json(toItemDto(item, job, []));
});

// ---------------------------------------------------------------------------
// DELETE /spec-folders/items/:itemId
// ---------------------------------------------------------------------------
router.delete("/spec-folders/items/:itemId", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const actor = auditActor(req);
  const itemId = req.params["itemId"] ?? "";

  const [item] = await db
    .select()
    .from(jobSpecFolderItemsTable)
    .leftJoin(jobSpecFoldersTable, eq(jobSpecFolderItemsTable.folderId, jobSpecFoldersTable.id))
    .where(
      and(
        eq(jobSpecFolderItemsTable.id, itemId),
        eq(jobSpecFoldersTable.tenantId, tenant),
      ),
    )
    .limit(1);
  if (!item) { res.status(404).json({ message: "Item not found" }); return; }

  await db.delete(jobSpecFolderItemsTable).where(eq(jobSpecFolderItemsTable.id, itemId));
  await recordAudit({
    action: "spec_folder.item_removed",
    entityType: "spec_folder_item",
    entityId: itemId,
    ...actor,
  });
  res.json({ message: "Item removed" });
});

// ---------------------------------------------------------------------------
// POST /spec-folders/items/:itemId/enrich  (re-run contact search)
// ---------------------------------------------------------------------------
router.post("/spec-folders/items/:itemId/enrich", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const actor = auditActor(req);
  const itemId = req.params["itemId"] ?? "";

  const [row] = await db
    .select()
    .from(jobSpecFolderItemsTable)
    .leftJoin(jobSpecFoldersTable, eq(jobSpecFolderItemsTable.folderId, jobSpecFoldersTable.id))
    .leftJoin(jobsTable, eq(jobSpecFolderItemsTable.jobId, jobsTable.id))
    .where(
      and(
        eq(jobSpecFolderItemsTable.id, itemId),
        eq(jobSpecFoldersTable.tenantId, tenant),
      ),
    )
    .limit(1);
  if (!row || !row.jobs) { res.status(404).json({ message: "Item not found" }); return; }

  const job = row.jobs;
  if (!job.companyName) {
    res.status(400).json({ message: "Job has no company name — cannot enrich" });
    return;
  }

  const contacts = await runEnrichment(
    itemId,
    tenant,
    job.companyName,
    job.sectorTag ?? null,
    job.title,
  );

  await recordAudit({
    action: "spec_folder.contacts_enriched",
    entityType: "spec_folder_item",
    entityId: itemId,
    metadata: `Re-ran Apollo enrichment for "${job.title}" @ ${job.companyName}; found ${contacts.length} contacts`,
    ...actor,
  });

  res.json(contacts.map(toContactDto));
});

// ---------------------------------------------------------------------------
// GET /spec-folders/items/:itemId/contacts
// ---------------------------------------------------------------------------
router.get("/spec-folders/items/:itemId/contacts", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const itemId = req.params["itemId"] ?? "";

  // Verify item belongs to tenant
  const [item] = await db
    .select()
    .from(jobSpecFolderItemsTable)
    .leftJoin(jobSpecFoldersTable, eq(jobSpecFolderItemsTable.folderId, jobSpecFoldersTable.id))
    .where(
      and(eq(jobSpecFolderItemsTable.id, itemId), eq(jobSpecFoldersTable.tenantId, tenant)),
    )
    .limit(1);
  if (!item) { res.status(404).json({ message: "Item not found" }); return; }

  const contacts = await db
    .select()
    .from(jobSpecContactsTable)
    .where(eq(jobSpecContactsTable.folderItemId, itemId))
    .orderBy(asc(jobSpecContactsTable.contactType), asc(jobSpecContactsTable.createdAt));

  res.json(contacts.map(toContactDto));
});

// ---------------------------------------------------------------------------
// POST /spec-folders/items/:itemId/contacts  (manual add)
// ---------------------------------------------------------------------------
const ContactInput = z.object({
  fullName: z.string().min(1),
  title: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  linkedinUrl: z.string().nullish(),
  contactType: z.enum(["talent_acquisition", "hiring_manager"]),
  confidence: z.enum(["high", "best_guess"]).default("high"),
});

router.post("/spec-folders/items/:itemId/contacts", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const itemId = req.params["itemId"] ?? "";
  const parsed = ContactInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [item] = await db
    .select()
    .from(jobSpecFolderItemsTable)
    .leftJoin(jobSpecFoldersTable, eq(jobSpecFolderItemsTable.folderId, jobSpecFoldersTable.id))
    .where(and(eq(jobSpecFolderItemsTable.id, itemId), eq(jobSpecFoldersTable.tenantId, tenant)))
    .limit(1);
  if (!item) { res.status(404).json({ message: "Item not found" }); return; }

  const [contact] = await db
    .insert(jobSpecContactsTable)
    .values({
      folderItemId: itemId,
      fullName: parsed.data.fullName,
      title: parsed.data.title ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      linkedinUrl: parsed.data.linkedinUrl ?? null,
      contactType: parsed.data.contactType,
      source: "manual",
      confidence: parsed.data.confidence,
    })
    .returning();
  if (!contact) { res.status(500).json({ message: "Failed to create contact" }); return; }

  res.status(201).json(toContactDto(contact));
});

// ---------------------------------------------------------------------------
// PATCH /spec-folders/contacts/:contactId
// ---------------------------------------------------------------------------
router.patch("/spec-folders/contacts/:contactId", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const contactId = req.params["contactId"] ?? "";
  const parsed = ContactInput.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  // Verify ownership via join
  const [existing] = await db
    .select()
    .from(jobSpecContactsTable)
    .leftJoin(jobSpecFolderItemsTable, eq(jobSpecContactsTable.folderItemId, jobSpecFolderItemsTable.id))
    .leftJoin(jobSpecFoldersTable, eq(jobSpecFolderItemsTable.folderId, jobSpecFoldersTable.id))
    .where(and(eq(jobSpecContactsTable.id, contactId), eq(jobSpecFoldersTable.tenantId, tenant)))
    .limit(1);
  if (!existing) { res.status(404).json({ message: "Contact not found" }); return; }

  const [updated] = await db
    .update(jobSpecContactsTable)
    .set({
      ...(parsed.data.fullName !== undefined && { fullName: parsed.data.fullName }),
      ...(parsed.data.title !== undefined && { title: parsed.data.title ?? null }),
      ...(parsed.data.email !== undefined && { email: parsed.data.email ?? null }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone ?? null }),
      ...(parsed.data.linkedinUrl !== undefined && { linkedinUrl: parsed.data.linkedinUrl ?? null }),
      ...(parsed.data.contactType !== undefined && { contactType: parsed.data.contactType }),
      ...(parsed.data.confidence !== undefined && { confidence: parsed.data.confidence }),
    })
    .where(eq(jobSpecContactsTable.id, contactId))
    .returning();

  res.json(toContactDto(updated!));
});

// ---------------------------------------------------------------------------
// DELETE /spec-folders/contacts/:contactId
// ---------------------------------------------------------------------------
router.delete("/spec-folders/contacts/:contactId", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const contactId = req.params["contactId"] ?? "";

  const [existing] = await db
    .select()
    .from(jobSpecContactsTable)
    .leftJoin(jobSpecFolderItemsTable, eq(jobSpecContactsTable.folderItemId, jobSpecFolderItemsTable.id))
    .leftJoin(jobSpecFoldersTable, eq(jobSpecFolderItemsTable.folderId, jobSpecFoldersTable.id))
    .where(and(eq(jobSpecContactsTable.id, contactId), eq(jobSpecFoldersTable.tenantId, tenant)))
    .limit(1);
  if (!existing) { res.status(404).json({ message: "Contact not found" }); return; }

  await db.delete(jobSpecContactsTable).where(eq(jobSpecContactsTable.id, contactId));
  res.json({ message: "Contact deleted" });
});

// ---------------------------------------------------------------------------
// GET /spec-folders/search-configs
// ---------------------------------------------------------------------------
router.get("/spec-folders/search-configs", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const configs = await db
    .select()
    .from(jobSpecSearchConfigTable)
    .where(eq(jobSpecSearchConfigTable.tenantId, tenant))
    .orderBy(asc(jobSpecSearchConfigTable.createdAt));

  res.json(
    configs.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      sectorTag: c.sectorTag ?? null,
      jobTitleKeyword: c.jobTitleKeyword ?? null,
      targetTitles: c.targetTitles,
      managerTitles: c.managerTitles,
      createdBy: c.createdBy,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  );
});

// ---------------------------------------------------------------------------
// POST /spec-folders/search-configs
// ---------------------------------------------------------------------------
const SearchConfigInput = z.object({
  sectorTag: z.string().nullish(),
  jobTitleKeyword: z.string().nullish(),
  targetTitles: z.array(z.string()),
  managerTitles: z.array(z.string()),
});

router.post("/spec-folders/search-configs", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const userId = req.auth!.userId;
  const parsed = SearchConfigInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [config] = await db
    .insert(jobSpecSearchConfigTable)
    .values({
      tenantId: tenant,
      sectorTag: parsed.data.sectorTag ?? null,
      jobTitleKeyword: parsed.data.jobTitleKeyword ?? null,
      targetTitles: parsed.data.targetTitles,
      managerTitles: parsed.data.managerTitles,
      createdBy: userId,
    })
    .returning();
  if (!config) { res.status(500).json({ message: "Failed to create config" }); return; }

  res.status(201).json({
    id: config.id, tenantId: config.tenantId,
    sectorTag: config.sectorTag ?? null, jobTitleKeyword: config.jobTitleKeyword ?? null,
    targetTitles: config.targetTitles, managerTitles: config.managerTitles,
    createdBy: config.createdBy,
    createdAt: config.createdAt.toISOString(), updatedAt: config.updatedAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// PATCH /spec-folders/search-configs/:id
// ---------------------------------------------------------------------------
router.patch("/spec-folders/search-configs/:id", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const id = req.params["id"] ?? "";
  const parsed = SearchConfigInput.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [existing] = await db
    .select()
    .from(jobSpecSearchConfigTable)
    .where(and(eq(jobSpecSearchConfigTable.id, id), eq(jobSpecSearchConfigTable.tenantId, tenant)))
    .limit(1);
  if (!existing) { res.status(404).json({ message: "Config not found" }); return; }

  const [updated] = await db
    .update(jobSpecSearchConfigTable)
    .set({
      ...(parsed.data.sectorTag !== undefined && { sectorTag: parsed.data.sectorTag ?? null }),
      ...(parsed.data.jobTitleKeyword !== undefined && { jobTitleKeyword: parsed.data.jobTitleKeyword ?? null }),
      ...(parsed.data.targetTitles !== undefined && { targetTitles: parsed.data.targetTitles }),
      ...(parsed.data.managerTitles !== undefined && { managerTitles: parsed.data.managerTitles }),
    })
    .where(eq(jobSpecSearchConfigTable.id, id))
    .returning();

  res.json({
    id: updated!.id, tenantId: updated!.tenantId,
    sectorTag: updated!.sectorTag ?? null, jobTitleKeyword: updated!.jobTitleKeyword ?? null,
    targetTitles: updated!.targetTitles, managerTitles: updated!.managerTitles,
    createdBy: updated!.createdBy,
    createdAt: updated!.createdAt.toISOString(), updatedAt: updated!.updatedAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// DELETE /spec-folders/search-configs/:id
// ---------------------------------------------------------------------------
router.delete("/spec-folders/search-configs/:id", async (req, res): Promise<void> => {
  const tenant = tenantOf(req);
  const id = req.params["id"] ?? "";

  const [existing] = await db
    .select()
    .from(jobSpecSearchConfigTable)
    .where(and(eq(jobSpecSearchConfigTable.id, id), eq(jobSpecSearchConfigTable.tenantId, tenant)))
    .limit(1);
  if (!existing) { res.status(404).json({ message: "Config not found" }); return; }

  await db.delete(jobSpecSearchConfigTable).where(eq(jobSpecSearchConfigTable.id, id));
  res.json({ message: "Config deleted" });
});

export default router;
