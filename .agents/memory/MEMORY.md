# Memory Index

- [Orval codegen quirks](orval-codegen-quirks.md) — Zod value exports are named by operationId; component names are type-only, and hooks may need explicit queryKey.
- [Express router mounting](express-router-mounting.md) — `router.use(path, subRouter)` strips the prefix; guard paths with middleware separately when sub-routers use full paths.
- [stripe-replit-sync quirks](stripe-replit-sync-quirks.md) — must be esbuild-external, syncBackfill needs {object:"all"}, connector key is `secret`, pick effective sub by status precedence
- [pnpm peer splits](otel-peer-split.md) — otel SDKs split drizzle-orm; importing `openai` directly splits it vs the integration lib (breaks instanceof). Share one identity via lib exports.
- [Connector credential quirks](connector-credential-quirks.md) — user-filled connector settings may not match their schema (Sentry field holds a DSN); Resend is sandbox-limited.
- [PostHog region routing](posthog-region-routing.md) — phc_ keys don't encode region; wrong ingestion host fails silently as 404s. Verify with /array/<key>/config.js per host.
- [Secrets hygiene](secrets-hygiene.md) — user-pasted secrets can contain stray whitespace; trim keys in code, and restart workflows after a secret's value changes.
- [Design subagent scope](design-subagent-scope.md) — restyle briefs may be only partially executed; diff against the brief's scope list and finish gaps directly.
- [Long-running HTTP ingestion](long-running-ingestion.md) — Node drops request connections at ~5 min and detached bash curls die with the shell; keep scrape runs under ~2 min via limited concurrency, retry once after upstream cache warm-up.
- [Careers-page URL staleness](careers-url-staleness.md) — curated employer career-site URLs 404 over time; curl-probe the URL before debugging extraction logic.
- [ATS board token discovery](ats-board-discovery.md) — don't guess tenant tokens (200-with-empty lies); `site:` searches on ATS job domains reveal real token/instance/site from live URLs.
- [Stripe pricing/currency lessons](stripe-pricing-lessons.md) — Stripe blocks cross-currency checkout for existing customers; catch → 400 + portal; never name a state setter `setInterval`.
- [Screenshots behind login](screenshot-auth.md) — temp dev-only session-redirect route (removed after use) is how to capture authenticated app-preview screenshots.
- [Background sweep jobs](background-sweeps.md) — "new since last run" sweeps need a bounded (since, windowEnd] window + pg advisory xact lock; process-local flags don't survive autoscale.
- [Typed errors in transport try blocks](typed-errors-in-transport-try.md) — config checks inside a fetch try/catch get remapped to generic upstream errors; hoist them before the I/O.
- [Internal endpoint tenancy](internal-endpoint-tenancy.md) — /internal admin routes are reachable by every tenant's admin; HTTP-triggered mutations must be tenant-scoped, global ops belong in schedulers only.
- [SSRF guards for server fetches](ssrf-server-fetches.md) — redirect:"follow" bypasses URL validation; validate the initial URL AND every redirect hop manually before fetching config/admin-supplied URLs.
