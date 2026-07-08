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
import { IngestionError } from "../lib/vacancies/types";
import { GOOGLE_JOBS_PATTERNS, resolvePatternCap } from "../config/ingestionPatterns";

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

export default router;
