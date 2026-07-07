import { desc, eq, and, inArray } from "drizzle-orm";
import {
  db,
  candidatesTable,
  jobsTable,
  jobSourcesTable,
  matchRunsTable,
  matchesTable,
} from "@workspace/db";
import { computeMatch } from "./matching";
import { recordAudit } from "./audit";

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

  return db.transaction(async (tx) => {
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
