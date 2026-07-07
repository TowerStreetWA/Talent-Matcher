---
name: Careers-page URL staleness
description: External employer career-site URLs rot; verify before debugging extraction
---

Rule: when a scraping provider returns "no links found" or empty results for a configured external URL, curl-probe the URL first — the page is often a 404/"board no longer active" shell, not an extraction bug.

**Why:** Greenhouse/Lever board URLs change subdomains (e.g. job-boards.eu.greenhouse.io → job-boards.greenhouse.io) and companies migrate ATS vendors; a Firecrawl JSON extraction on a 404 page "succeeds" with zero results.

**How to apply:** `curl -s -o /dev/null -w "%{http_code}" -L <url>` on the configured careers URLs (see api-server's employer sites config) before touching extraction prompts or schemas. Keep the curated employer list small and expect to refresh URLs over time.
