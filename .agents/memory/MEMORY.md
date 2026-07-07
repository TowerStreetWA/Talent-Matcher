# Memory Index

- [Orval codegen quirks](orval-codegen-quirks.md) — Zod value exports are named by operationId; component names are type-only, and hooks may need explicit queryKey.
- [Express router mounting](express-router-mounting.md) — `router.use(path, subRouter)` strips the prefix; guard paths with middleware separately when sub-routers use full paths.
- [stripe-replit-sync quirks](stripe-replit-sync-quirks.md) — must be esbuild-external, syncBackfill needs {object:"all"}, connector key is `secret`, pick effective sub by status precedence
- [OpenTelemetry peer split](otel-peer-split.md) — adding otel-dependent SDKs (Sentry) splits drizzle-orm types and breaks esbuild externals; align peers + add transitive externals as direct deps.
- [Connector credential quirks](connector-credential-quirks.md) — user-filled connector settings may not match their schema (Sentry field holds a DSN); Resend is sandbox-limited.
- [PostHog region routing](posthog-region-routing.md) — phc_ keys don't encode region; wrong ingestion host fails silently as 404s. Verify with /array/<key>/config.js per host.
- [Secrets hygiene](secrets-hygiene.md) — user-pasted secrets can contain stray whitespace; trim keys in code, and restart workflows after a secret's value changes.
