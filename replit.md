# VacancyMatch AI

Multi-tenant SaaS for recruiters: upload a CV, AI-parse it into a candidate profile, and match it against live jobs with explainable weighted scoring.

## Run & Operate

- Workflows: `artifacts/api-server: API Server` (port 8080, path `/api`) and `artifacts/vacancymatch: web` (port 18259, path `/`)
- `pnpm run typecheck` — full typecheck across all packages (run `typecheck:libs` first after lib changes)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`; AI parsing uses `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` (Replit AI integration, billed to credits)
- Dev seed logins (tenant "demo", password `demo1234`, override via `SEED_DEMO_PASSWORD`): owner@demo.test, admin@demo.test, recruiter@demo.test, viewer@demo.test — seeded by `ensureAuthSeed()` (skipped in production unless `SEED_DEMO_PASSWORD` is set)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5; Frontend: React + Vite (`artifacts/vacancymatch`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`; API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the API contract (paths are root-level, e.g. `/audit-logs`, no `/admin` prefix)
- `lib/db/src/schema/` — Drizzle schemas: candidates, jobSources, jobs, matchRuns, matches, alertRules, crmSyncEvents, auditLogs, tenants, tenantUsers, userSessions (uuid PKs, `tenantId` default `"demo"`)
- `artifacts/api-server/src/lib/auth.ts` — scrypt password hashing, sha256-hashed session tokens, cookie helpers; `src/middlewares/auth.ts` — requireAuth / requireRole / blockViewerWrites + `tenantOf(req)` / `auditActor(req)`
- `artifacts/vacancymatch/src/lib/auth.tsx` — AuthProvider/useAuth (wraps `/auth/me`); `src/pages/login.tsx` — login page
- `artifacts/api-server/src/lib/` — matching.ts (weighted scoring + explanations), matchRunner.ts (shared match-run executor), cvParser.ts (OpenAI CV parse, Zod-validated), seed.ts (demo data, runs when job_sources is empty), audit.ts, dto.ts
- `artifacts/api-server/src/routes/` — candidates, matches, jobs, jobSources, alertRules, dashboard, admin
- `artifacts/vacancymatch/src/pages/` — dashboard, upload, candidates, candidate detail, matches, jobs, sources, alerts, compliance

## Architecture decisions

- Explainable weighted scoring: skills 35%, title 20%, industry 15%, location 15%, comp 10%, recency 5%; every match stores a per-factor breakdown + human-readable explanation lines
- Match runs only consider active jobs from active sources, keep scores ≥ 30, top 25; candidate `lastMatchedAt`/`bestMatchScore`/`matchCount` updated per run
- CV upload auto-triggers a match run (`triggerType: "cv_upload"`) via `runMatchForCandidate` in matchRunner.ts
- Error responses use `{ message }` shape (ApiMessage)
- Auth: custom email/password (NOT Clerk/Replit Auth, per spec). Cookie sessions (`vm_session`, httpOnly, 7-day TTL, sha256 token hash stored in `user_sessions`); roles owner/admin/recruiter/viewer; viewers are read-only (`blockViewerWrites`); `/crm-sync-events` + `/audit-logs` are admin+ only; login/logout/auth failures are audit-logged
- Tenant scoping is enforced on all data routes: `tenantId` on data rows is the tenant **slug** (matches legacy `"demo"` text data), while `tenant_users.tenantId` is the tenants uuid PK; `tenantOf(req)` returns the slug
- Stripe billing (Phase 2, DONE): Replit Stripe integration (`stripe` + `stripe-replit-sync`, credentials via connector API in `src/lib/stripeClient.ts` — NOT env vars). Managed webhook at `/api/stripe/webhook` (raw body, registered in app.ts BEFORE express.json). Webhook-synced Stripe data lives in the `stripe` DB schema (read-only; never write to it). `tenant_billing` caches per-tenant state (tenantId = slug), refreshed from `stripe.subscriptions` on GET /billing/subscription — never from checkout redirects. Plans: Starter $49/mo (7-day trial, no card via `payment_method_collection: if_required`), Team $149/mo; price IDs resolved from `stripe.prices` via product `metadata.plan_key`. Access gate (`middlewares/billing.ts`): trialing/active/past_due → full access; none/canceled/etc → reads OK, writes 402; billing + auth routes always reachable. Checkout/portal are admin+ only. Billing events are audit-logged. Scripts: `pnpm --filter @workspace/scripts exec tsx src/seedStripeProducts.ts` (idempotent) and `src/devStartTrial.ts` (dev trial for demo tenant)

## Signup & Team (Phase 4)

- Self-serve signup: POST /auth/signup creates tenant + owner in one txn; slug auto-generated from company name (`uniqueSlug()` with `-2` suffixes + unique-violation retry); dup email 409. Pages: `/signup`, `/accept-invite` (public routes rendered by AuthGate when logged out)
- Invites: `lib/db/src/schema/invites.ts` (sha256 tokenHash, 7-day expiry, acceptedAt/revokedAt); `/team` routes (list/PATCH members, invites CRUD) mounted admin+ only after billing gate; accept binds email to the invite row (client email ignored) with atomic UPDATE...RETURNING claim; invite emails via Resend + copyable inviteUrl shown on Team page (sandbox fallback)
- Guards: cannot modify owners or self; disabling a member kills their sessions; new tenants hit the existing billing 402 write gate until a trial/subscription starts
- All signup/invite/member events are audit-logged

## Integrations (Phase 3)

- CV file upload: Replit App Storage presigned uploads (`routes/storage.ts`, 10MB, pdf/docx/doc/txt); text extraction in `lib/extractCvText.ts` (unpdf/mammoth); `cvFileKey` on candidates + tenant-scoped download route
- Resend email: `lib/email.ts` wrapper via connector proxy (never throws); alert-rule match notifications (matchRunner) + checkout-started emails. Sandbox mode: delivers only to the account owner's email until a domain is verified at resend.com/domains; FROM is onboarding@resend.dev
- Sentry: DSN in `SENTRY_DSN` / `VITE_SENTRY_DSN` env vars (shared). Server: `lib/sentry.ts` (env-gated init, PII scrubbing in beforeSend, tenant/user/role tags via middleware, `Sentry.setupExpressErrorHandler`); `index.ts` is a bootstrap that inits Sentry then dynamically imports `start.ts` (ESM import hoisting would otherwise load Express first). Dev-only `/api/debug-sentry` route throws to verify capture. Client: init + ErrorBoundary in `main.tsx`. Both no-op when DSN unset
- PostHog: client-side `src/lib/analytics.ts` (env-gated on `VITE_PUBLIC_POSTHOG_KEY` secret; `VITE_PUBLIC_POSTHOG_HOST` is set to https://eu.i.posthog.com — the account is on EU cloud; default would be US); identify on login (userId, tenant, role), events: login, cv_upload_started/failed, cv_parse_succeeded/failed, match_run_completed, match_status_updated, billing_page_viewed, checkout_started. No-ops when key unset

## Product

- Upload CV → AI-parsed profile → ranked, explainable job matches
- Recruiter actions: shortlist / dismiss / push-to-CRM (records CRM sync events + audit log)
- Job sources with health status, live jobs list, alert rules, compliance/audit log view, dashboard KPIs

## User preferences

- (none recorded yet)

## Gotchas

- No `console.log` in server code — use `req.log` / `logger`
- After changing `lib/*` packages, run `pnpm run typecheck:libs` before artifact typechecks (stale declarations cause phantom TS2305 errors)
- Workflow names are prefixed: `artifacts/api-server: API Server`, `artifacts/vacancymatch: web`
- Seed only runs when `job_sources` table is empty
- `stripe-replit-sync` must stay in esbuild `external` (build.mjs) — it reads its migrations dir from its own `__dirname` and silently skips migrations if bundled
- `syncBackfill()` must be called with `{ object: "all" }` — no args syncs nothing
- Stripe connector settings keys are `secret` / `publishable` (not `secret_key`)
- api-server esbuild externals include `@opentelemetry/*` — any external package's transitive deps must be direct deps of api-server (pnpm strict node_modules), hence the @opentelemetry/* entries in its package.json
- Adding a package that depends on `@opentelemetry/api` (e.g. @sentry/node) can split drizzle-orm into two peer-resolved type identities — fix by adding `@opentelemetry/api` to lib/db deps too

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
