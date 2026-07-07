---
name: Long-running HTTP ingestion runs
description: Timeout behavior for slow scraping/ingestion endpoints in this environment
---

Rule: keep synchronous ingestion/scraping HTTP requests under ~2 minutes; parallelize per-page work with limited concurrency (e.g. 3) instead of sequential loops.

**Why:** Node's default server requestTimeout severs the client connection at ~5 minutes even though the handler keeps running server-side (the response is silently lost). Separately, `nohup ... &` background processes started from the agent bash tool are killed when the bash session exits — use `setsid ... & disown` if a detached process is truly needed, but prefer making the request fast enough to run inline.

**How to apply:** When an ingestion run scrapes N pages via Firecrawl (or similar), run detail extractions concurrently. First uncached upstream calls (SerpApi, Firecrawl) can time out at 30–60s; a single retry usually hits the upstream cache and succeeds quickly. Poll DB/logs (pino logs on request completion) rather than assuming a dead curl means a dead run.
