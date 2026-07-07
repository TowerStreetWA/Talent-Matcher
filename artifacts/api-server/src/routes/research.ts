import { Router, type IRouter } from "express";
import {
  ScrapeResearchUrlBody,
  ScrapeResearchUrlResponse,
  ExtractResearchJobBody,
  ExtractResearchJobResponse,
} from "@workspace/api-zod";
import { auditActor } from "../middlewares/auth";
import { recordAudit } from "../lib/audit";
import {
  FirecrawlError,
  validateResearchUrl,
  scrapeResearchPage,
  extractResearchJob,
} from "../lib/firecrawl";

const router: IRouter = Router();

const PREVIEW_LENGTH = 600;

function statusFor(err: FirecrawlError): number {
  switch (err.kind) {
    case "blocked_url":
      return 400;
    case "config":
      return 503;
    case "timeout":
    case "upstream":
      return 502;
  }
}

router.post("/research/scrape-url", async (req, res): Promise<void> => {
  const parsed = ScrapeResearchUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "url is required" });
    return;
  }
  const actor = auditActor(req);
  try {
    const url = validateResearchUrl(parsed.data.url);
    const page = await scrapeResearchPage(url);
    await recordAudit({
      ...actor,
      action: "research.scrape_url",
      entityType: "research",
      metadata: JSON.stringify({
        url: url.toString().slice(0, 500),
        contentLength: page.markdown.length,
        statusCode: page.metadata.statusCode,
      }),
    });
    req.log.info(
      {
        event: "research_scrape",
        host: url.hostname,
        contentLength: page.markdown.length,
        statusCode: page.metadata.statusCode,
      },
      "research scrape completed",
    );
    res.json(
      ScrapeResearchUrlResponse.parse({
        success: true,
        metadata: page.metadata,
        markdown: page.markdown,
        contentPreview: page.markdown.slice(0, PREVIEW_LENGTH),
      }),
    );
  } catch (err) {
    if (err instanceof FirecrawlError) {
      req.log.warn(
        { event: "research_scrape_failed", kind: err.kind, message: err.message },
        "research scrape failed",
      );
      res.status(statusFor(err)).json({ message: err.message });
      return;
    }
    throw err;
  }
});

router.post("/research/extract-job", async (req, res): Promise<void> => {
  const parsed = ExtractResearchJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "url is required" });
    return;
  }
  const actor = auditActor(req);
  try {
    const url = validateResearchUrl(parsed.data.url);
    const job = await extractResearchJob(url);
    await recordAudit({
      ...actor,
      action: "research.extract_job",
      entityType: "research",
      metadata: JSON.stringify({
        url: url.toString().slice(0, 500),
        extractedTitle: job.title,
        skillCount: job.skills.length,
      }),
    });
    req.log.info(
      {
        event: "research_extract",
        host: url.hostname,
        hasTitle: job.title != null,
        skillCount: job.skills.length,
      },
      "research job extraction completed",
    );
    res.json(
      ExtractResearchJobResponse.parse({
        ...job,
        sourceUrl: url.toString(),
      }),
    );
  } catch (err) {
    if (err instanceof FirecrawlError) {
      req.log.warn(
        { event: "research_extract_failed", kind: err.kind, message: err.message },
        "research job extraction failed",
      );
      res.status(statusFor(err)).json({ message: err.message });
      return;
    }
    throw err;
  }
});

export default router;
