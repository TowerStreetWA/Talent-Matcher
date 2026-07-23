import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { db, jobsTable, jobSourcesTable, type BackingSource } from "@workspace/db";
import { logger } from "../logger";
import { runPostIngestionMatches } from "../matchRunner";
import { classifyCompanyKind } from "../search/companyKind";
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
  linkedin_via_google_jobs: "LinkedIn Jobs (via Google)",
  ats_lever: "Lever boards (ATS)",
  ats_ashby: "Ashby boards (ATS)",
  ats_workable: "Workable boards (ATS)",
  ats_smartrecruiters: "SmartRecruiters boards (ATS)",
  ats_recruitee: "Recruitee boards (ATS)",
  ats_teamtailor: "Teamtailor boards (ATS)",
  ats_workday: "Workday boards (ATS)",
  reed_api: "Reed",
  adzuna_api: "Adzuna",
  london_insurance_lloyds_syndicate: "London Market — Lloyd's syndicates",
  london_insurance_company_market: "London Market — company market insurers",
  london_insurance_mga_coverholder: "London Market — MGAs & coverholders",
  london_insurance_broker: "London Market — brokers",
};

export interface IngestionSummary {
  runId: string;
  sourceType: string;
  sourceProvider: string;
  fetched: number;
  insertedCanonical: number;
  insertedDuplicates: number;
  canonicalSwaps: number;
  refreshedExisting: number;
  clustersTouched: number;
  /** fetched split by the per-vacancy provider attribution (e.g. LinkedIn-via-Google). */
  fetchedByProvider: Record<string, number>;
  /** newly stored rows (canonical + duplicate) split by provider attribution. */
  insertedByProvider: Record<string, number>;
  /** freshness-only bumps of rows that already existed, split by provider. */
  refreshedByProvider: Record<string, number>;
  warnings: string[];
}

/** Find or create the per-tenant job_sources row backing a discovery provider. */
async function ensureIngestionSource(
  tenantId: string,
  sourceType: string,
  sourceProvider: string,
): Promise<typeof jobSourcesTable.$inferSelect> {
  const name = SOURCE_DISPLAY_NAMES[sourceProvider] ?? sourceProvider;
  // Prefer the machine provider id; fall back to display name for rows that
  // predate the provider column.
  const [byProvider] = await db
    .select()
    .from(jobSourcesTable)
    .where(
      and(eq(jobSourcesTable.tenantId, tenantId), eq(jobSourcesTable.provider, sourceProvider)),
    )
    .limit(1);
  if (byProvider) return byProvider;
  const [byName] = await db
    .select()
    .from(jobSourcesTable)
    .where(and(eq(jobSourcesTable.tenantId, tenantId), eq(jobSourcesTable.name, name)))
    .limit(1);
  if (byName) {
    if (byName.provider !== sourceProvider) {
      await db
        .update(jobSourcesTable)
        .set({ provider: sourceProvider })
        .where(eq(jobSourcesTable.id, byName.id));
      byName.provider = sourceProvider;
    }
    return byName;
  }
  const [created] = await db
    .insert(jobSourcesTable)
    .values({
      tenantId,
      name,
      sourceType,
      provider: sourceProvider,
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
    sectorTag: v.sectorTag ?? null,
    companyKind: classifyCompanyKind({
      companyName: v.companyName,
      urls: [v.applyUrl, v.sourceUrl],
      descriptionText: v.descriptionText,
    }),
    discoveredAt: now,
    lastSeenAt: now,
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
  const { vacancies, warnings } = await provider.fetchVacancies(input);

  // Vacancies from one provider run may attribute to different job_sources
  // rows (e.g. LinkedIn-hosted listings discovered via Google Jobs). Resolve
  // and cache the source row per per-vacancy sourceProvider.
  const sourceCache = new Map<string, typeof jobSourcesTable.$inferSelect>();
  async function sourceFor(vacancy: NormalizedVacancy) {
    const cached = sourceCache.get(vacancy.sourceProvider);
    if (cached) return cached;
    const row = await ensureIngestionSource(tenantId, vacancy.sourceType, vacancy.sourceProvider);
    sourceCache.set(vacancy.sourceProvider, row);
    return row;
  }
  // Always ensure the provider's own source row exists (health/lastSync even
  // on empty runs).
  sourceCache.set(
    provider.sourceProvider,
    await ensureIngestionSource(tenantId, provider.sourceType, provider.sourceProvider),
  );

  const existingJobs: JobRow[] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.status, "active")));

  const now = new Date();
  const summary: IngestionSummary = {
    runId: randomUUID(),
    sourceType: provider.sourceType,
    sourceProvider: provider.sourceProvider,
    fetched: vacancies.length,
    insertedCanonical: 0,
    insertedDuplicates: 0,
    canonicalSwaps: 0,
    refreshedExisting: 0,
    clustersTouched: 0,
    fetchedByProvider: {},
    insertedByProvider: {},
    refreshedByProvider: {},
    warnings,
  };
  const bump = (map: Record<string, number>, provider: string): void => {
    map[provider] = (map[provider] ?? 0) + 1;
  };
  const clustersTouched = new Set<string>();

  for (const vacancy of vacancies) {
    summary.fetchedByProvider[vacancy.sourceProvider] =
      (summary.fetchedByProvider[vacancy.sourceProvider] ?? 0) + 1;
    const source = await sourceFor(vacancy);
    // Idempotency: same source URL already ingested for this tenant.
    if (vacancy.sourceUrl) {
      const already = existingJobs.find(
        (j) => j.sourceUrl != null && j.sourceUrl === vacancy.sourceUrl,
      );
      if (already) {
        // Re-discovered: bump freshness (discoveredAt stays first-discovery).
        await db
          .update(jobsTable)
          .set({ lastSeenAt: now })
          .where(eq(jobsTable.id, already.id));
        summary.refreshedExisting += 1;
        bump(summary.refreshedByProvider, vacancy.sourceProvider);
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
      bump(summary.insertedByProvider, vacancy.sourceProvider);
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
      bump(summary.insertedByProvider, vacancy.sourceProvider);
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
      bump(summary.insertedByProvider, vacancy.sourceProvider);
    }
  }

  summary.clustersTouched = clustersTouched.size;

  for (const [providerKey, touched] of sourceCache.entries()) {
    await db
      .update(jobSourcesTable)
      .set({
        lastSyncAt: now,
        healthStatus: "healthy",
        lastFetchCount: summary.fetchedByProvider[providerKey] ?? 0,
        lastNewCount: summary.insertedByProvider[providerKey] ?? 0,
        lastRefreshedCount: summary.refreshedByProvider[providerKey] ?? 0,
      })
      .where(eq(jobSourcesTable.id, touched.id));
  }

  logger.info(
    {
      event: "vacancy_ingestion",
      runId: summary.runId,
      tenantId,
      sourceType: summary.sourceType,
      sourceProvider: summary.sourceProvider,
      fetched: summary.fetched,
      stored: summary.insertedCanonical + summary.insertedDuplicates,
      insertedCanonical: summary.insertedCanonical,
      insertedDuplicates: summary.insertedDuplicates,
      canonicalSwaps: summary.canonicalSwaps,
      refreshedExisting: summary.refreshedExisting,
      clustersTouched: summary.clustersTouched,
      fetchedByProvider: summary.fetchedByProvider,
      warningCount: warnings.length,
    },
    "vacancy ingestion run completed",
  );

  if (summary.insertedCanonical > 0) {
    void runPostIngestionMatches(tenantId).catch((err) => {
      logger.warn(
        { err, tenantId, insertedCanonical: summary.insertedCanonical },
        "Post-ingestion match trigger failed",
      );
    });
  }

  return summary;
}

export interface SourceFunnelRow {
  sourceProvider: string;
  total: number;
  active: number;
  inactive: number;
  canonicalActive: number;
  duplicates: number;
}

/**
 * Source-aware canonicalisation/active funnel: for each source provider,
 * how many stored jobs remain, how many are inactive/expired, how many were
 * merged as duplicates, and how many survive as canonical + active (the set
 * recruiters actually see). Logged so ingestion loss is visible per source.
 */
export async function logCanonicalFunnel(tenantId: string): Promise<SourceFunnelRow[]> {
  const rows = await db
    .select({
      sourceProvider: sql<string>`coalesce(${jobsTable.sourceProvider}, 'legacy_manual')`,
      total: count(),
      active: count(sql`case when ${jobsTable.status} = 'active' then 1 end`),
      inactive: count(sql`case when ${jobsTable.status} <> 'active' then 1 end`),
      canonicalActive: count(
        sql`case when ${jobsTable.status} = 'active' and ${jobsTable.isCanonical} then 1 end`,
      ),
      duplicates: count(sql`case when not ${jobsTable.isCanonical} then 1 end`),
    })
    .from(jobsTable)
    .where(eq(jobsTable.tenantId, tenantId))
    .groupBy(sql`coalesce(${jobsTable.sourceProvider}, 'legacy_manual')`);

  const funnel: SourceFunnelRow[] = rows.map((r) => ({
    sourceProvider: r.sourceProvider,
    total: Number(r.total),
    active: Number(r.active),
    inactive: Number(r.inactive),
    canonicalActive: Number(r.canonicalActive),
    duplicates: Number(r.duplicates),
  }));

  logger.info(
    { event: "vacancy_canonical_funnel", tenantId, funnel },
    "vacancy canonicalisation funnel snapshot",
  );

  return funnel;
}
