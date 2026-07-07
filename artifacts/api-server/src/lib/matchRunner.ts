import { desc, eq, and, inArray, lte } from "drizzle-orm";
import {
  db,
  candidatesTable,
  jobsTable,
  jobSourcesTable,
  matchRunsTable,
  matchesTable,
  alertRulesTable,
  tenantsTable,
  tenantUsersTable,
} from "@workspace/db";
import { computeMatch } from "./matching";
import { recordAudit } from "./audit";
import { sendEmail, alertMatchEmailHtml } from "./email";
import { logger } from "./logger";

type Candidate = typeof candidatesTable.$inferSelect;
type MatchRun = typeof matchRunsTable.$inferSelect;

export async function runMatchForCandidate(
  candidate: Candidate,
  triggerType: "manual" | "cv_upload" | "scheduled",
): Promise<MatchRun> {
  const activeSources = await db
    .select({ id: jobSourcesTable.id })
    .from(jobSourcesTable)
    .where(
      and(
        eq(jobSourcesTable.isActive, true),
        eq(jobSourcesTable.tenantId, candidate.tenantId),
      ),
    );
  const activeSourceIds = activeSources.map((s) => s.id);

  const jobs = activeSourceIds.length
    ? await db
        .select()
        .from(jobsTable)
        .where(
          and(
            eq(jobsTable.status, "active"),
            eq(jobsTable.tenantId, candidate.tenantId),
            inArray(jobsTable.sourceId, activeSourceIds),
          ),
        )
    : [];

  const now = new Date();
  const computed = jobs
    .map((job) => ({ job, result: computeMatch(candidate, job, now) }))
    .filter(({ result }) => result.overallScore >= 30)
    .sort((a, b) => b.result.overallScore - a.result.overallScore)
    .slice(0, 25);
  const bestScore = computed[0]?.result.overallScore ?? null;

  const run = await db.transaction(async (tx) => {
    const [run] = await tx
      .insert(matchRunsTable)
      .values({
        tenantId: candidate.tenantId,
        candidateId: candidate.id,
        triggerType,
        status: "completed",
        matchCount: computed.length,
        startedAt: now,
        completedAt: now,
      })
      .returning();
    if (!run) {
      throw new Error("Failed to create match run");
    }

    if (computed.length > 0) {
      await tx.insert(matchesTable).values(
        computed.map(({ job, result }) => ({
          tenantId: candidate.tenantId,
          matchRunId: run.id,
          candidateId: candidate.id,
          jobId: job.id,
          overallScore: result.overallScore,
          scoreBreakdown: result.scoreBreakdown,
          explanation: result.explanation,
          matchedSkills: result.matchedSkills,
          missingSkills: result.missingSkills,
        })),
      );
    }

    await tx
      .update(candidatesTable)
      .set({
        lastMatchedAt: now,
        bestMatchScore: bestScore,
        matchCount: computed.length,
      })
      .where(eq(candidatesTable.id, candidate.id));
    await recordAudit(
      {
        action: "match_run.executed",
        entityType: "match_run",
        entityId: run.id,
        metadata: `Scanned ${jobs.length} live jobs for ${candidate.firstName} ${candidate.lastName}; ${computed.length} matches above threshold`,
        tenantId: candidate.tenantId,
      },
      tx,
    );
    return run;
  });

  if (bestScore !== null) {
    // Fire-and-forget: alert emails must never fail or slow the match run.
    void notifyAlertRules(candidate, bestScore, computed.length).catch((err) => {
      logger.warn({ err }, "Alert notification failed");
    });
  }

  return run;
}

async function notifyAlertRules(
  candidate: Candidate,
  bestScore: number,
  matchCount: number,
): Promise<void> {
  const now = new Date();
  const rules = await db
    .select()
    .from(alertRulesTable)
    .where(
      and(
        eq(alertRulesTable.candidateId, candidate.id),
        eq(alertRulesTable.tenantId, candidate.tenantId),
        eq(alertRulesTable.isActive, true),
        lte(alertRulesTable.minScore, bestScore),
      ),
    );
  if (rules.length === 0) return;

  const recipients = await db
    .select({ email: tenantUsersTable.email, role: tenantUsersTable.role })
    .from(tenantUsersTable)
    .innerJoin(tenantsTable, eq(tenantUsersTable.tenantId, tenantsTable.id))
    .where(
      and(
        eq(tenantsTable.slug, candidate.tenantId),
        eq(tenantUsersTable.status, "active"),
        inArray(tenantUsersTable.role, ["owner", "admin", "recruiter"]),
      ),
    );
  const to = recipients.map((r) => r.email);
  if (to.length === 0) return;

  const candidateName = `${candidate.firstName} ${candidate.lastName}`;
  const strongest = rules.reduce((a, b) => (a.minScore <= b.minScore ? a : b));
  const { subject, html } = alertMatchEmailHtml({
    candidateName,
    bestScore,
    matchCount,
    minScore: strongest.minScore,
  });
  const sent = await sendEmail({ to, subject, html });

  await db
    .update(alertRulesTable)
    .set({ lastCheckedAt: now, ...(sent ? { lastTriggeredAt: now } : {}) })
    .where(
      inArray(
        alertRulesTable.id,
        rules.map((r) => r.id),
      ),
    );
}

export async function latestMatchRun(
  candidateId: string,
): Promise<MatchRun | undefined> {
  const [run] = await db
    .select()
    .from(matchRunsTable)
    .where(eq(matchRunsTable.candidateId, candidateId))
    .orderBy(desc(matchRunsTable.startedAt))
    .limit(1);
  return run;
}
