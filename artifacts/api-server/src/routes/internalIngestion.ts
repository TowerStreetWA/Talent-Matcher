import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { recordAudit } from "../lib/audit";
import { tenantOf, auditActor } from "../middlewares/auth";
import { employerSiteProvider } from "../lib/vacancies/employerSiteProvider";
import { googleJobsProvider } from "../lib/vacancies/googleJobsProvider";
import {
  logCanonicalFunnel,
  runVacancyIngestion,
  type IngestionSummary,
} from "../lib/vacancies/ingestionRunner";
import { IngestionError, type VacancyProvider } from "../lib/vacancies/types";
import { sweepStaleJobs } from "../lib/vacancies/expirySweep";
import { GOOGLE_JOBS_PATTERNS, resolvePatternCap } from "../config/ingestionPatterns";
import { ATS_PLATFORMS, makeAtsProvider } from "../lib/vacancies/ats";
import { reedProvider } from "../lib/vacancies/reedProvider";
import { adzunaProvider } from "../lib/vacancies/adzunaProvider";
import type { AtsPlatform } from "../config/atsEmployers";
import {
  boardPatternsFor,
  resolveBoardPatternCap,
  type JobBoardProviderKey,
} from "../config/jobBoardPatterns";
import { LONDON_SEGMENTS } from "../lib/vacancies/londonDirectory";
import {
  CAREERS_DIRECTORY_KEYS,
  directoryByKey,
  LONDON_INSURANCE_DIRECTORY,
} from "../config/careersDirectories";
import {
  makeDirectoryEmployerProvider,
  selectDirectoryEmployers,
  type CareersDirectoryConfig,
} from "../lib/directory/engine";
import { resolveCareersBoard } from "../lib/directory/resolveCareersBoard";
import type { LondonMarketSegment } from "../config/londonInsuranceEmployers";

/**
 * Internal-only ingestion entrypoints (Phase 10). Deliberately NOT part of the
 * public OpenAPI contract — these are operator/dev endpoints, mounted admin+
 * only, for running vacancy discovery jobs. No recruiter-facing UI calls them.
 */
const router: IRouter = Router();

function statusForIngestionError(err: IngestionError): number {
  switch (err.kind) {
    case "config":
      return 503;
    case "rate_limited":
      return 429;
    case "timeout":
    case "upstream":
      return 502;
  }
}

function handleIngestionError(req: Request, res: Response, err: unknown): void {
  if (err instanceof IngestionError) {
    req.log.warn({ event: "vacancy_ingestion_failed", kind: err.kind }, err.message);
    res.status(statusForIngestionError(err)).json({ message: err.message });
    return;
  }
  throw err;
}

const employerSitesBodySchema = z
  .object({
    companies: z.array(z.string().min(1)).max(20).optional(),
  })
  .optional();

router.post("/internal/ingestion/employer-sites", async (req, res) => {
  const parsedBody = employerSitesBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res
      .status(400)
      .json({ message: "companies must be an array of up to 20 non-empty strings" });
    return;
  }
  const body = parsedBody.data;
  const tenantId = tenantOf(req);
  try {
    const summary: IngestionSummary = await runVacancyIngestion({
      tenantId,
      provider: employerSiteProvider,
      input: { companies: body?.companies },
    });
    await recordAudit({
      action: "ingestion.employer_sites",
      entityType: "job",
      metadata: JSON.stringify({
        fetched: summary.fetched,
        insertedCanonical: summary.insertedCanonical,
        insertedDuplicates: summary.insertedDuplicates,
        canonicalSwaps: summary.canonicalSwaps,
        warningCount: summary.warnings.length,
      }),
      ...auditActor(req),
    });
    res.json(summary);
  } catch (err) {
    handleIngestionError(req, res, err);
  }
});

const googleJobsBodySchema = z.object({
  query: z.string().min(2).max(200),
  location: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
});

router.post("/internal/ingestion/google-jobs", async (req, res) => {
  const parsed = googleJobsBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "A search query (2-200 chars) is required" });
    return;
  }
  const tenantId = tenantOf(req);
  try {
    const summary: IngestionSummary = await runVacancyIngestion({
      tenantId,
      provider: googleJobsProvider,
      input: {
        query: parsed.data.query,
        location: parsed.data.location ?? null,
        company: parsed.data.company ?? null,
      },
    });
    await recordAudit({
      action: "ingestion.google_jobs",
      entityType: "job",
      metadata: JSON.stringify({
        queryLength: parsed.data.query.length,
        fetched: summary.fetched,
        insertedCanonical: summary.insertedCanonical,
        insertedDuplicates: summary.insertedDuplicates,
        canonicalSwaps: summary.canonicalSwaps,
        warningCount: summary.warnings.length,
      }),
      ...auditActor(req),
    });
    res.json(summary);
  } catch (err) {
    handleIngestionError(req, res, err);
  }
});

const runPatternsBodySchema = z
  .object({
    /** Restrict to specific configured pattern names (default: all). */
    patterns: z.array(z.string().min(1)).max(20).optional(),
  })
  .optional();

/**
 * Run all (or selected) configured Google Jobs search patterns sequentially,
 * then return per-pattern summaries plus a source-aware canonicalisation
 * funnel snapshot. Config lives in src/config/ingestionPatterns.ts.
 */
router.post("/internal/ingestion/run-patterns", async (req, res) => {
  const parsed = runPatternsBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "patterns must be an array of up to 20 pattern names" });
    return;
  }
  const requested = parsed.data?.patterns;
  const selected = requested?.length
    ? GOOGLE_JOBS_PATTERNS.filter((p) => requested.includes(p.name))
    : GOOGLE_JOBS_PATTERNS;
  if (selected.length === 0) {
    res.status(400).json({
      message: `No matching patterns. Configured: ${GOOGLE_JOBS_PATTERNS.map((p) => p.name).join(", ")}`,
    });
    return;
  }

  const tenantId = tenantOf(req);
  const runs: Array<{ pattern: string; summary?: IngestionSummary; error?: string }> = [];

  for (const pattern of selected) {
    try {
      const summary = await runVacancyIngestion({
        tenantId,
        provider: googleJobsProvider,
        input: {
          query: pattern.keywords,
          location: pattern.location,
          maxResults: resolvePatternCap(pattern),
          sectorTag: pattern.sectorTag,
        },
      });
      runs.push({ pattern: pattern.name, summary });
    } catch (err) {
      if (err instanceof IngestionError) {
        req.log.warn(
          { event: "vacancy_ingestion_failed", pattern: pattern.name, kind: err.kind },
          err.message,
        );
        runs.push({ pattern: pattern.name, error: err.message });
        // Config errors (missing key) will fail every pattern — stop early.
        if (err.kind === "config") break;
        continue;
      }
      throw err;
    }
  }

  const funnel = await logCanonicalFunnel(tenantId);

  await recordAudit({
    action: "ingestion.run_patterns",
    entityType: "job",
    metadata: JSON.stringify({
      patterns: runs.map((r) => r.pattern),
      totals: runs.reduce(
        (acc, r) => {
          if (!r.summary) return acc;
          acc.fetched += r.summary.fetched;
          acc.insertedCanonical += r.summary.insertedCanonical;
          acc.insertedDuplicates += r.summary.insertedDuplicates;
          acc.refreshedExisting += r.summary.refreshedExisting;
          return acc;
        },
        { fetched: 0, insertedCanonical: 0, insertedDuplicates: 0, refreshedExisting: 0 },
      ),
      errorCount: runs.filter((r) => r.error).length,
    }),
    ...auditActor(req),
  });

  res.json({ runs, funnel });
});

const atsBodySchema = z
  .object({
    /** Restrict to specific ATS platforms (default: all). */
    platforms: z.array(z.enum(ATS_PLATFORMS as [AtsPlatform, ...AtsPlatform[]])).max(10).optional(),
    /** Restrict to specific configured companies (default: all). */
    companies: z.array(z.string().min(1)).max(20).optional(),
  })
  .optional();

/**
 * Run ATS job-board ingestion (Lever/Ashby/Workable/SmartRecruiters/
 * Recruitee/Teamtailor/Workday) for configured employers — one
 * runVacancyIngestion per platform so each ATS shows up as its own source.
 * Employer config lives in src/config/atsEmployers.ts.
 */
router.post("/internal/ingestion/ats", async (req, res) => {
  const parsed = atsBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      message: `platforms must be a subset of: ${ATS_PLATFORMS.join(", ")}; companies up to 20 non-empty strings`,
    });
    return;
  }
  const platforms = parsed.data?.platforms?.length ? parsed.data.platforms : ATS_PLATFORMS;
  const companies = parsed.data?.companies;
  const tenantId = tenantOf(req);
  const runs: Array<{ platform: string; summary?: IngestionSummary; error?: string }> = [];

  for (const platform of platforms) {
    try {
      const summary = await runVacancyIngestion({
        tenantId,
        provider: makeAtsProvider(platform),
        input: { companies },
      });
      runs.push({ platform, summary });
    } catch (err) {
      if (err instanceof IngestionError) {
        req.log.warn(
          { event: "vacancy_ingestion_failed", platform, kind: err.kind },
          err.message,
        );
        runs.push({ platform, error: err.message });
        continue;
      }
      throw err;
    }
  }

  const funnel = await logCanonicalFunnel(tenantId);

  await recordAudit({
    action: "ingestion.ats",
    entityType: "job",
    metadata: JSON.stringify({
      platforms: runs.map((r) => r.platform),
      totals: runs.reduce(
        (acc, r) => {
          if (!r.summary) return acc;
          acc.fetched += r.summary.fetched;
          acc.insertedCanonical += r.summary.insertedCanonical;
          acc.insertedDuplicates += r.summary.insertedDuplicates;
          acc.refreshedExisting += r.summary.refreshedExisting;
          return acc;
        },
        { fetched: 0, insertedCanonical: 0, insertedDuplicates: 0, refreshedExisting: 0 },
      ),
      errorCount: runs.filter((r) => r.error).length,
    }),
    ...auditActor(req),
  });

  res.json({ runs, funnel });
});

const boardBodySchema = z
  .object({
    /** Ad-hoc single query (mutually exclusive with patterns). */
    query: z.string().min(2).max(200).optional(),
    location: z.string().max(120).optional(),
    maxResults: z.number().int().min(1).max(200).optional(),
    /** Run configured patterns by name (default when no query: all patterns). */
    patterns: z.array(z.string().min(1)).max(20).optional(),
  })
  .optional();

const BOARD_PROVIDERS: Record<JobBoardProviderKey, VacancyProvider> = {
  reed: reedProvider,
  adzuna: adzunaProvider,
};

/**
 * Shared handler for job-board ingestion (Reed, Adzuna). Two modes:
 * ad-hoc single query (body.query) or config-driven patterns
 * (src/config/jobBoardPatterns.ts) — the default when no query is given.
 */
function makeBoardHandler(providerKey: JobBoardProviderKey) {
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = boardBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        message:
          "Provide either query (2-200 chars, optional location/maxResults) or patterns (array of configured pattern names)",
      });
      return;
    }
    const body = parsed.data;
    const provider = BOARD_PROVIDERS[providerKey];
    const tenantId = tenantOf(req);
    const runs: Array<{ pattern: string; summary?: IngestionSummary; error?: string }> = [];

    try {
      if (body?.query) {
        const summary = await runVacancyIngestion({
          tenantId,
          provider,
          input: {
            query: body.query,
            location: body.location ?? null,
            maxResults: body.maxResults ?? null,
          },
        });
        runs.push({ pattern: "ad_hoc", summary });
      } else {
        const configured = boardPatternsFor(providerKey);
        const requested = body?.patterns;
        const selected = requested?.length
          ? configured.filter((p) => requested.includes(p.name))
          : configured;
        if (selected.length === 0) {
          res.status(400).json({
            message: `No matching patterns. Configured: ${configured.map((p) => p.name).join(", ")}`,
          });
          return;
        }
        for (const pattern of selected) {
          try {
            const summary = await runVacancyIngestion({
              tenantId,
              provider,
              input: {
                query: pattern.keywords,
                location: pattern.location,
                maxResults: resolveBoardPatternCap(pattern),
                sectorTag: pattern.sectorTag,
              },
            });
            runs.push({ pattern: pattern.name, summary });
          } catch (err) {
            if (err instanceof IngestionError) {
              req.log.warn(
                { event: "vacancy_ingestion_failed", pattern: pattern.name, kind: err.kind },
                err.message,
              );
              runs.push({ pattern: pattern.name, error: err.message });
              // Config errors (missing key) will fail every pattern — stop early.
              if (err.kind === "config") break;
              continue;
            }
            throw err;
          }
        }
      }
    } catch (err) {
      handleIngestionError(req, res, err);
      return;
    }

    const funnel = await logCanonicalFunnel(tenantId);

    await recordAudit({
      action: `ingestion.${providerKey}`,
      entityType: "job",
      metadata: JSON.stringify({
        patterns: runs.map((r) => r.pattern),
        totals: runs.reduce(
          (acc, r) => {
            if (!r.summary) return acc;
            acc.fetched += r.summary.fetched;
            acc.insertedCanonical += r.summary.insertedCanonical;
            acc.insertedDuplicates += r.summary.insertedDuplicates;
            acc.refreshedExisting += r.summary.refreshedExisting;
            return acc;
          },
          { fetched: 0, insertedCanonical: 0, insertedDuplicates: 0, refreshedExisting: 0 },
        ),
        errorCount: runs.filter((r) => r.error).length,
      }),
      ...auditActor(req),
    });

    res.json({ runs, funnel });
  };
}

router.post("/internal/ingestion/reed", makeBoardHandler("reed"));
router.post("/internal/ingestion/adzuna", makeBoardHandler("adzuna"));

const directoryFilterSchema = z
  .object({
    /** Restrict to specific directory segments (default: all). */
    segments: z.array(z.string().min(1)).max(10).optional(),
    /** Restrict to specific employer names from the directory config. */
    employers: z.array(z.string().min(1)).max(25).optional(),
    /** Batch paging over the (deduped) employer list. */
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(25).optional(),
  })
  .optional();

const careersDirectoryBodySchema = z.object({
  /** Directory key from config/careersDirectories.ts. */
  directory: z.string().min(1),
  segments: z.array(z.string().min(1)).max(10).optional(),
  employers: z.array(z.string().min(1)).max(25).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

/** Default batch size — generic careers pages go through Firecrawl, so a
 * full-directory HTTP run would exceed safe request duration. Page with
 * offset/limit; the hourly sweep covers the rest automatically. */
const DIRECTORY_DEFAULT_LIMIT = 5;

interface DirectoryRunFilters {
  segments?: string[];
  employers?: string[];
  offset?: number;
  limit?: number;
}

/**
 * Shared careers-directory batch ingestion: bounded batch of employers from
 * one registered directory, one runVacancyIngestion per employer so the
 * response carries a per-employer funnel; failures are recorded per
 * employer and never sink the batch.
 */
async function runCareersDirectoryBatch(
  req: Request,
  res: Response,
  directory: CareersDirectoryConfig,
  filters: DirectoryRunFilters,
  auditAction: string,
): Promise<void> {
  const invalidSegments = filters.segments?.filter((s) => !directory.segments.includes(s));
  if (invalidSegments?.length) {
    res.status(400).json({
      message: `Unknown segment(s) ${invalidSegments.join(", ")} for directory ${directory.key}. Valid: ${directory.segments.join(", ")}`,
    });
    return;
  }
  const selection = selectDirectoryEmployers(directory, {
    segments: filters.segments,
    employers: filters.employers,
    offset: filters.offset ?? 0,
    limit: filters.limit ?? DIRECTORY_DEFAULT_LIMIT,
  });
  if (selection.employers.length === 0) {
    res.status(400).json({
      message: `No directory employers match the requested filter (${selection.totalMatching} total after board dedupe)`,
    });
    return;
  }

  const tenantId = tenantOf(req);
  const runs: Array<{
    employer: string;
    segment: string;
    platformHint: string;
    summary?: IngestionSummary;
    error?: string;
  }> = [];

  for (const employer of selection.employers) {
    try {
      const summary = await runVacancyIngestion({
        tenantId,
        provider: makeDirectoryEmployerProvider(directory, employer),
        input: {},
      });
      runs.push({
        employer: employer.name,
        segment: employer.segment,
        platformHint: employer.platformHint,
        summary,
      });
    } catch (err) {
      // Per-employer failures (Firecrawl upstream errors, dead careers URLs,
      // rotted board tokens) must never sink the rest of the batch — record
      // and continue.
      const message = err instanceof Error ? err.message : String(err);
      req.log.warn(
        {
          event: "vacancy_ingestion_failed",
          directory: directory.key,
          employer: employer.name,
          kind: err instanceof IngestionError ? err.kind : "unexpected",
        },
        message,
      );
      runs.push({
        employer: employer.name,
        segment: employer.segment,
        platformHint: employer.platformHint,
        error: message,
      });
      // Config errors (e.g. missing Firecrawl key) fail every generic
      // careers page — stop early instead of burning the whole batch.
      if (err instanceof IngestionError && err.kind === "config") break;
    }
  }

  const funnel = await logCanonicalFunnel(tenantId);

  await recordAudit({
    action: auditAction,
    entityType: "job",
    metadata: JSON.stringify({
      directory: directory.key,
      employers: runs.map((r) => r.employer),
      totalMatching: selection.totalMatching,
      sharedBoardSkips: selection.sharedBoardSkips.length,
      totals: runs.reduce(
        (acc, r) => {
          if (!r.summary) return acc;
          acc.fetched += r.summary.fetched;
          acc.insertedCanonical += r.summary.insertedCanonical;
          acc.insertedDuplicates += r.summary.insertedDuplicates;
          acc.refreshedExisting += r.summary.refreshedExisting;
          return acc;
        },
        { fetched: 0, insertedCanonical: 0, insertedDuplicates: 0, refreshedExisting: 0 },
      ),
      errorCount: runs.filter((r) => r.error).length,
    }),
    ...auditActor(req),
  });

  res.json({
    directory: directory.key,
    runs,
    totalMatching: selection.totalMatching,
    sharedBoardSkips: selection.sharedBoardSkips,
    funnel,
  });
}

/**
 * Generic careers-directory ingestion for any registered directory
 * (config/careersDirectories.ts): insurance, banking, pensions,
 * asset_management, accountancy_finance, it_tech.
 */
router.post("/internal/ingestion/careers-directory", async (req, res) => {
  const parsed = careersDirectoryBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      message: `Provide directory (one of: ${CAREERS_DIRECTORY_KEYS.join(", ")}); optional segments, employers (<=25), offset, limit 1-25`,
    });
    return;
  }
  const directory = directoryByKey(parsed.data.directory);
  if (!directory) {
    res.status(400).json({
      message: `Unknown directory "${parsed.data.directory}". Registered: ${CAREERS_DIRECTORY_KEYS.join(", ")}`,
    });
    return;
  }
  await runCareersDirectoryBatch(req, res, directory, parsed.data, "ingestion.careers_directory");
});

/**
 * Legacy London Insurance Market endpoint — kept as a delegate to the
 * generic careers-directory handler (same behavior, provider keys, and
 * audit action as before the generalisation).
 */
router.post("/internal/ingestion/london-insurance-directory", async (req, res) => {
  const parsed = directoryFilterSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      message: `segments must be a subset of: ${LONDON_SEGMENTS.join(", ")}; employers up to 25 names; offset >= 0; limit 1-25`,
    });
    return;
  }
  await runCareersDirectoryBatch(
    req,
    res,
    LONDON_INSURANCE_DIRECTORY,
    parsed.data ?? {},
    "ingestion.london_insurance_directory",
  );
});

const resolveBodySchema = z.union([
  z.object({
    /** Probe employers from a registered directory. */
    directory: z.string().min(1),
    segments: z.array(z.string().min(1)).max(10).optional(),
    employers: z.array(z.string().min(1)).max(10).optional(),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(10).optional(),
  }),
  z.object({
    /** Ad-hoc discovery: probe arbitrary careers URLs (not persisted). */
    urls: z.array(z.string().url()).min(1).max(10),
  }),
]);

const RESOLVE_DEFAULT_LIMIT = 5;

/** Normalized company record returned by the resolution/discovery endpoint. */
interface CompanyRecord {
  name: string;
  industry: string | null;
  segment: string | null;
  careersUrl: string;
  platformHint: string | null;
  outcome: string;
  platform: string | null;
  resolvedBoardUrl: string | null;
  finalUrl: string | null;
  unsupportedAts: string | null;
  lastCheckedAt: string;
}

/**
 * Careers→board resolution probe (no ingestion): reports, per employer or
 * ad-hoc URL, whether the careers page is/leads to a structured ATS board
 * the engine can fetch. Use it to diagnose zero-job directory employers and
 * to vet new employers before adding them to the seed.
 */
router.post("/internal/ingestion/careers-directory/resolve", async (req, res) => {
  const parsed = resolveBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      message: `Provide {directory (one of: ${CAREERS_DIRECTORY_KEYS.join(", ")}), segments?, employers?, offset?, limit 1-10} or {urls: [up to 10 URLs]}`,
    });
    return;
  }

  const targets: Array<{
    name: string;
    careersUrl: string;
    industry: string | null;
    segment: string | null;
    platformHint: string | null;
    sectorTag: string | null;
  }> = [];

  if ("urls" in parsed.data) {
    for (const url of parsed.data.urls) {
      targets.push({
        name: new URL(url).hostname,
        careersUrl: url,
        industry: null,
        segment: null,
        platformHint: null,
        sectorTag: null,
      });
    }
  } else {
    const directory = directoryByKey(parsed.data.directory);
    if (!directory) {
      res.status(400).json({
        message: `Unknown directory "${parsed.data.directory}". Registered: ${CAREERS_DIRECTORY_KEYS.join(", ")}`,
      });
      return;
    }
    const invalidSegments = parsed.data.segments?.filter(
      (s) => !directory.segments.includes(s),
    );
    if (invalidSegments?.length) {
      res.status(400).json({
        message: `Unknown segment(s) ${invalidSegments.join(", ")} for directory ${directory.key}. Valid: ${directory.segments.join(", ")}`,
      });
      return;
    }
    const selection = selectDirectoryEmployers(directory, {
      segments: parsed.data.segments,
      employers: parsed.data.employers,
      offset: parsed.data.offset ?? 0,
      limit: parsed.data.limit ?? RESOLVE_DEFAULT_LIMIT,
    });
    for (const e of selection.employers) {
      targets.push({
        name: e.name,
        careersUrl: e.careersUrl,
        industry: directory.industry,
        segment: e.segment,
        platformHint: e.platformHint,
        sectorTag: e.sectorTag,
      });
    }
  }

  if (targets.length === 0) {
    res.status(400).json({ message: "No employers match the requested filter" });
    return;
  }

  const records: CompanyRecord[] = [];
  for (const target of targets) {
    const resolution = await resolveCareersBoard(target.careersUrl, {
      company: target.name,
      sectorTag: target.sectorTag,
    });
    records.push({
      name: target.name,
      industry: target.industry,
      segment: target.segment,
      careersUrl: target.careersUrl,
      platformHint: target.platformHint,
      outcome: resolution.outcome,
      platform: resolution.entry?.platform ?? null,
      resolvedBoardUrl: resolution.boardUrl,
      finalUrl: resolution.finalUrl,
      unsupportedAts: resolution.unsupportedAts,
      lastCheckedAt: resolution.checkedAt.toISOString(),
    });
  }

  res.json({ records });
});

/**
 * Manually trigger the stale-job expiry sweep (also runs periodically —
 * see lib/vacancies/expirySweep.ts). Marks ingestion-backed jobs "expired"
 * when they have not been re-discovered within their freshness threshold.
 */
router.post("/internal/ingestion/expire-stale", async (req, res) => {
  // Tenant-scoped: an admin can only expire their own tenant's stale jobs.
  const result = await sweepStaleJobs({ tenantId: tenantOf(req) });
  if (result === null) {
    res.status(409).json({ message: "Expiry sweep already running — try again shortly" });
    return;
  }
  await recordAudit({
    action: "ingestion.expire_stale",
    entityType: "job",
    metadata: JSON.stringify({ expired: result.expired, bySource: result.bySource }),
    ...auditActor(req),
  });
  res.json(result);
});

export default router;
