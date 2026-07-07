import { Router, type IRouter } from "express";
import { desc, eq, and, gte } from "drizzle-orm";
import {
  db,
  matchesTable,
  jobsTable,
  jobSourcesTable,
  candidatesTable,
  crmSyncEventsTable,
} from "@workspace/db";
import {
  ListMatchesResponse,
  UpdateMatchBody,
  UpdateMatchResponse,
  PushMatchToCrmBody,
  PushMatchToCrmResponse,
} from "@workspace/api-zod";
import { toMatchDto, toCrmSyncEventDto } from "../lib/dto";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

const paramId = (raw: string | string[]): string =>
  Array.isArray(raw) ? (raw[0] ?? "") : raw;

const matchJoinQuery = () =>
  db
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
    );

router.get("/matches", async (req, res): Promise<void> => {
  const recruiterStatus =
    typeof req.query["recruiterStatus"] === "string"
      ? req.query["recruiterStatus"]
      : "";
  const minScoreRaw =
    typeof req.query["minScore"] === "string" ? req.query["minScore"] : "";
  const minScore = minScoreRaw ? Number(minScoreRaw) : null;
  const conditions = [];
  if (recruiterStatus)
    conditions.push(eq(matchesTable.recruiterStatus, recruiterStatus));
  if (minScore != null && !Number.isNaN(minScore))
    conditions.push(gte(matchesTable.overallScore, minScore));
  const rows = await matchJoinQuery()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(matchesTable.overallScore))
    .limit(200);
  res.json(
    ListMatchesResponse.parse(
      rows.map((r) =>
        toMatchDto(r.match, r.job, r.sourceName, `${r.candFirst} ${r.candLast}`),
      ),
    ),
  );
});

router.patch("/matches/:id", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const parsed = UpdateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ message: "No fields provided to update" });
    return;
  }
  const [updated] = await db
    .update(matchesTable)
    .set(parsed.data)
    .where(eq(matchesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ message: "Match not found" });
    return;
  }
  const [row] = await matchJoinQuery().where(eq(matchesTable.id, id));
  if (!row) {
    res.status(404).json({ message: "Match not found" });
    return;
  }
  if (parsed.data.recruiterStatus) {
    await recordAudit({
      action: `match.${parsed.data.recruiterStatus}`,
      entityType: "match",
      entityId: id,
      metadata: `${row.candFirst} ${row.candLast} → ${row.job.title} marked ${parsed.data.recruiterStatus}`,
    });
  }
  res.json(
    UpdateMatchResponse.parse(
      toMatchDto(row.match, row.job, row.sourceName, `${row.candFirst} ${row.candLast}`),
    ),
  );
});

router.post("/matches/:id/push-to-crm", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const parsed = PushMatchToCrmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }
  const [row] = await matchJoinQuery().where(eq(matchesTable.id, id));
  if (!row) {
    res.status(404).json({ message: "Match not found" });
    return;
  }
  const now = new Date();
  const candidateName = `${row.candFirst} ${row.candLast}`;
  const crmName = parsed.data.crmName;
  const note = parsed.data.note;
  const event = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(crmSyncEventsTable)
      .values({
        candidateId: row.match.candidateId,
        jobId: row.match.jobId,
        direction: "outbound",
        crmName,
        payloadSummary: `${candidateName} → ${row.job.title} @ ${row.job.companyName ?? "Unknown"} (score ${row.match.overallScore})${note ? ` — ${note}` : ""}`,
        status: "sent",
        processedAt: now,
      })
      .returning();
    if (!inserted) {
      throw new Error("Failed to record CRM sync");
    }
    await tx
      .update(matchesTable)
      .set({ pushedToCrm: true, recruiterStatus: "pushed" })
      .where(eq(matchesTable.id, id));
    await recordAudit(
      {
        action: "match.pushed_to_crm",
        entityType: "match",
        entityId: id,
        metadata: `${candidateName} → ${row.job.title} pushed to ${crmName}`,
      },
      tx,
    );
    return inserted;
  });
  res
    .status(201)
    .json(
      PushMatchToCrmResponse.parse(
        toCrmSyncEventDto(event, candidateName, row.job.title),
      ),
    );
});

export default router;
