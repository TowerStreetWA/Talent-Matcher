import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, jobsTable, jobSourcesTable, type BackingSource } from "@workspace/db";
import { logger } from "../logger";
import {
  clusterKey,
  locationsCompatible,
  parseSalaryText,
  sourcePreferenceRank,
} from "./dedupe";
import type {
  EmployerSiteFetchInput,
  GoogleJobsQuery,
  NormalizedVacancy,
  VacancyProvider,
} from "./types";

type JobRow = typeof jobsTable.$inferSelect;

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  company_site: "Company career sites",
  google_jobs_serpapi: "Google Jobs",
};

export interface IngestionSummary {
  sourceType: string;
  sourceProvider: string;
  fetched: number;
  insertedCanonical: number;
  insertedDuplicates: number;
  canonicalSwaps: number;
  refreshedExisting: number;
  clustersTouched: number;
  warnings: string[];
}

/** Find or create the per-tenant job_sources row backing a discovery provider. */
async function ensureIngestionSource(
  tenantId: string,
  provider: VacancyProvider,
): Promise<typeof jobSourcesTable.$inferSelect> {
  const name = SOURCE_DISPLAY_NAMES[provider.sourceProvider] ?? provider.sourceProvider;
  const [existing] = await db
    .select()
    .from(jobSourcesTable)
    .where(and(eq(jobSourcesTable.tenantId, tenantId), eq(jobSourcesTable.name, name)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(jobSourcesTable)
    .values({
      tenantId,
      name,
      sourceType: provider.sourceType,
      isActive: true,
    })
    .returning();
  if (!created) throw new Error("Failed to create ingestion job source");
  return created;
}

function toBackingSource(row: {
  sourceType: string | null;
  sourceProvider: string | null;
  sourceUrl: string | null;
}): BackingSource {
  return {
    sourceType: row.sourceType ?? "unknown",
    sourceProvider: row.sourceProvider ?? "unknown",
    sourceUrl: row.sourceUrl,
  };
}

function insertValues(
  v: NormalizedVacancy,
  tenantId: string,
  sourceId: string,
  now: Date,
): typeof jobsTable.$inferInsert {
  const salary = parseSalaryText(v.salaryText);
  return {
    tenantId,
    sourceId,
    title: v.title,
    companyName: v.companyName,
    locationText: v.locationText,
    remoteType: v.remoteType,
    employmentType: v.employmentType,
    salaryMin: salary.salaryMin,
    salaryMax: salary.salaryMax,
    salaryCurrency: salary.salaryCurrency,
    salaryText: v.salaryText,
    descriptionText: v.descriptionText,
    applyUrl: v.applyUrl,
    skills: v.skills,
    postedAt: v.postedAt,
    status: "active",
    sourceType: v.sourceType,
    sourceProvider: v.sourceProvider,
    sourceUrl: v.sourceUrl,
    discoveredAt: now,
  };
}

/**
 * Run one discovery provider for a tenant: fetch vacancies, dedupe against
 * existing active jobs (and within the batch), store canonical + duplicate
 * rows, and log per-run counts.
 */
export async function runVacancyIngestion(opts: {
  tenantId: string;
  provider: VacancyProvider;
  input: GoogleJobsQuery | EmployerSiteFetchInput;
}): Promise<IngestionSummary> {
  const { tenantId, provider, input } = opts;
  const source = await ensureIngestionSource(tenantId, provider);
  const { vacancies, warnings } = await provider.fetchVacancies(input);

  const existingJobs: JobRow[] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.status, "active")));

  const now = new Date();
  const summary: IngestionSummary = {
    sourceType: provider.sourceType,
    sourceProvider: provider.sourceProvider,
    fetched: vacancies.length,
    insertedCanonical: 0,
    insertedDuplicates: 0,
    canonicalSwaps: 0,
    refreshedExisting: 0,
    clustersTouched: 0,
    warnings,
  };
  const clustersTouched = new Set<string>();

  for (const vacancy of vacancies) {
    // Idempotency: same source URL already ingested for this tenant.
    if (vacancy.sourceUrl) {
      const already = existingJobs.find(
        (j) => j.sourceUrl != null && j.sourceUrl === vacancy.sourceUrl,
      );
      if (already) {
        await db
          .update(jobsTable)
          .set({ discoveredAt: now })
          .where(eq(jobsTable.id, already.id));
        summary.refreshedExisting += 1;
        continue;
      }
    }

    const key = clusterKey(vacancy);
    const clusterMembers = existingJobs.filter(
      (j) =>
        clusterKey({ title: j.title, companyName: j.companyName, locationText: j.locationText }) ===
          key && locationsCompatible(j.locationText, vacancy.locationText),
    );
    const canonical = clusterMembers.find((j) => j.isCanonical) ?? clusterMembers[0];

    if (!canonical) {
      // New unique vacancy → canonical row in its own cluster.
      const [inserted] = await db
        .insert(jobsTable)
        .values({
          ...insertValues(vacancy, tenantId, source.id, now),
          canonicalGroupId: randomUUID(),
          isCanonical: true,
          backingSources: [],
        })
        .returning();
      if (inserted) existingJobs.push(inserted);
      summary.insertedCanonical += 1;
      continue;
    }

    // Duplicate cluster: ensure a shared group id.
    let groupId = canonical.canonicalGroupId;
    if (!groupId) {
      groupId = randomUUID();
      await db
        .update(jobsTable)
        .set({ canonicalGroupId: groupId })
        .where(eq(jobsTable.id, canonical.id));
      canonical.canonicalGroupId = groupId;
    }
    clustersTouched.add(groupId);

    const newRank = sourcePreferenceRank(vacancy);
    const canonicalRank = sourcePreferenceRank(canonical);

    if (newRank < canonicalRank) {
      // New source is preferred (e.g. direct employer beats an aggregator copy).
      // Insert + demotion happen atomically so a failure can't leave two
      // canonical rows (or none) in the cluster.
      const backing: BackingSource[] = [
        ...(canonical.backingSources ?? []),
        toBackingSource(canonical),
      ];
      const inserted = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(jobsTable)
          .values({
            ...insertValues(vacancy, tenantId, source.id, now),
            canonicalGroupId: groupId,
            isCanonical: true,
            backingSources: backing,
          })
          .returning();
        await tx
          .update(jobsTable)
          .set({ isCanonical: false, backingSources: [] })
          .where(eq(jobsTable.id, canonical.id));
        return row;
      });
      canonical.isCanonical = false;
      canonical.backingSources = [];
      if (inserted) existingJobs.push(inserted);
      summary.insertedCanonical += 1;
      summary.canonicalSwaps += 1;
    } else {
      // Existing canonical wins: store the new copy as a duplicate and record
      // it as a backing source on the canonical record (atomically).
      const backing: BackingSource[] = [
        ...(canonical.backingSources ?? []),
        toBackingSource(vacancy),
      ];
      const inserted = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(jobsTable)
          .values({
            ...insertValues(vacancy, tenantId, source.id, now),
            canonicalGroupId: groupId,
            isCanonical: false,
            backingSources: [],
          })
          .returning();
        await tx
          .update(jobsTable)
          .set({ backingSources: backing })
          .where(eq(jobsTable.id, canonical.id));
        return row;
      });
      canonical.backingSources = backing;
      if (inserted) existingJobs.push(inserted);
      summary.insertedDuplicates += 1;
    }
  }

  summary.clustersTouched = clustersTouched.size;

  await db
    .update(jobSourcesTable)
    .set({ lastSyncAt: now, healthStatus: "healthy" })
    .where(eq(jobSourcesTable.id, source.id));

  logger.info(
    {
      event: "vacancy_ingestion",
      tenantId,
      sourceType: summary.sourceType,
      sourceProvider: summary.sourceProvider,
      fetched: summary.fetched,
      insertedCanonical: summary.insertedCanonical,
      insertedDuplicates: summary.insertedDuplicates,
      canonicalSwaps: summary.canonicalSwaps,
      refreshedExisting: summary.refreshedExisting,
      clustersTouched: summary.clustersTouched,
      warningCount: warnings.length,
    },
    "vacancy ingestion run completed",
  );

  return summary;
}
