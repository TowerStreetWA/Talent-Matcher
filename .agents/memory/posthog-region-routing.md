---
name: PostHog region routing
description: How to detect and fix PostHog US vs EU cloud host mismatches
---

PostHog project keys (`phc_...`) do not encode the cloud region. posthog-js defaults to the US ingestion host; if the account is on EU cloud, initialization fails silently — the only symptom is 404s on config/flags requests in the browser console, and events are dropped.

**Why:** `/capture/` returns 200 `{"status":"Ok"}` on BOTH hosts regardless of key validity, so a capture test cannot detect the wrong region.

**How to apply:** Verify the region with `curl -o /dev/null -w "%{http_code}" https://{us,eu}.i.posthog.com/array/<key>/config.js` — the correct host returns 200, the wrong one 404. Set the host env var (this project: `VITE_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com`) and restart the Vite dev server (env vars are inlined at startup).
