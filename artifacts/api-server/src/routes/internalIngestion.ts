import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { recordAudit } from "../lib/audit";
import { tenantOf, auditActor } from "../middlewares/auth";
import { employerSiteProvider } from "../lib/vacancies/employerSiteProvider";
import { googleJobsProvider } from "../lib/vacancies/googleJobsProvider";
import { runVacancyIngestion, type IngestionSummary } from "../lib/vacancies/ingestionRunner";
import { IngestionError } from "../lib/vacancies/types";

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

export default router;
