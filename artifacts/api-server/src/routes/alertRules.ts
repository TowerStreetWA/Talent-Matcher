import { Router, type IRouter } from "express";
import { desc, eq, and } from "drizzle-orm";
import { db, alertRulesTable, candidatesTable } from "@workspace/db";
import {
  ListAlertRulesResponse,
  CreateAlertRuleBody,
  CreateAlertRuleResponse,
  UpdateAlertRuleBody,
  UpdateAlertRuleResponse,
} from "@workspace/api-zod";
import { toAlertRuleDto } from "../lib/dto";
import { recordAudit } from "../lib/audit";
import { tenantOf, auditActor } from "../middlewares/auth";

const router: IRouter = Router();

const paramId = (raw: string | string[]): string =>
  Array.isArray(raw) ? (raw[0] ?? "") : raw;

router.get("/alert-rules", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      rule: alertRulesTable,
      candFirst: candidatesTable.firstName,
      candLast: candidatesTable.lastName,
    })
    .from(alertRulesTable)
    .innerJoin(
      candidatesTable,
      eq(alertRulesTable.candidateId, candidatesTable.id),
    )
    .where(eq(alertRulesTable.tenantId, tenantOf(req)))
    .orderBy(desc(alertRulesTable.createdAt));
  res.json(
    ListAlertRulesResponse.parse(
      rows.map((r) =>
        toAlertRuleDto(r.rule, `${r.candFirst} ${r.candLast}`),
      ),
    ),
  );
});

router.post("/alert-rules", async (req, res): Promise<void> => {
  const parsed = CreateAlertRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }
  const [candidate] = await db
    .select()
    .from(candidatesTable)
    .where(
      and(
        eq(candidatesTable.id, parsed.data.candidateId),
        eq(candidatesTable.tenantId, tenantOf(req)),
      ),
    );
  if (!candidate) {
    res.status(400).json({ message: "Candidate not found" });
    return;
  }
  const [row] = await db
    .insert(alertRulesTable)
    .values({ ...parsed.data, tenantId: tenantOf(req), lastCheckedAt: new Date() })
    .returning();
  if (!row) {
    res.status(500).json({ message: "Failed to create alert rule" });
    return;
  }
  await recordAudit({
    action: "alert_rule.created",
    entityType: "alert_rule",
    entityId: row.id,
    metadata: `Watching ${candidate.firstName} ${candidate.lastName} for matches ≥ ${row.minScore} (${row.frequency})`,
    ...auditActor(req),
  });
  res.status(201).json(
    CreateAlertRuleResponse.parse(
      toAlertRuleDto(row, `${candidate.firstName} ${candidate.lastName}`),
    ),
  );
});

router.patch("/alert-rules/:id", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const parsed = UpdateAlertRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(alertRulesTable)
    .set(parsed.data)
    .where(
      and(
        eq(alertRulesTable.id, id),
        eq(alertRulesTable.tenantId, tenantOf(req)),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ message: "Alert rule not found" });
    return;
  }
  const [candidate] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, row.candidateId));
  res.json(
    UpdateAlertRuleResponse.parse(
      toAlertRuleDto(
        row,
        candidate ? `${candidate.firstName} ${candidate.lastName}` : null,
      ),
    ),
  );
});

router.delete("/alert-rules/:id", async (req, res): Promise<void> => {
  const id = paramId(req.params["id"] ?? "");
  const [row] = await db
    .delete(alertRulesTable)
    .where(
      and(
        eq(alertRulesTable.id, id),
        eq(alertRulesTable.tenantId, tenantOf(req)),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ message: "Alert rule not found" });
    return;
  }
  await recordAudit({
    action: "alert_rule.deleted",
    entityType: "alert_rule",
    entityId: id,
    ...auditActor(req),
  });
  res.json({ message: "Alert rule deleted" });
});

export default router;
