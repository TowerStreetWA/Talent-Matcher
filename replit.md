# VacancyMatch AI

Multi-tenant SaaS for recruiters: upload a CV, AI-parse it into a candidate profile, and match it against live jobs with explainable weighted scoring. Recruiter actions: shortlist / dismiss / push-to-CRM; plus job sources with health status, saved searches + alerts, compliance/audit views, dashboard KPIs. Public branding is "Talent Matcher" (landing/pricing); in-app is VacancyMatch.

Deep-dive references (keep in sync when changing those areas):
- `docs/billing.md` — Stripe integration, access gate, pricing/plans details
- `docs/search-taxonomy.md` — search, FS taxonomy, curated titles, recruiter filtering, /jobs/search
- `docs/ingestion.md` — vacancy providers, ATS, careers directories, sweeps, internal endpoints

## Run & Operate

- Workflows: `artifacts/api-server: API Server` (port 8080, path `/api`) and `artifacts/vacancymatch: web` (port 18259, path `/`)
- `pnpm run typecheck` — full typecheck (run `typecheck:libs` first after lib changes)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod schemas from OpenAPI
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run test` — vitest unit + integration tests
- Required env: `DATABASE_URL`; AI parsing uses the Replit OpenAI integration env vars
- Dev seed logins (tenant "demo", password `demo1234`): owner@/admin@/recruiter@/viewer@demo.test — via `ensureAuthSeed()`; demo data seeds only when `job_sources` is empty

## Stack & layout

- pnpm workspaces, Node 24, TS 5.9; Express 5 API; React + Vite frontend; PostgreSQL + Drizzle; Zod (`zod/v4`); Orval codegen from `lib/api-spec/openapi.yaml` (source of truth, root-level paths — no `/admin` prefix)
- `lib/db/src/schema/` — Drizzle schemas; `artifacts/api-server/src/{lib,routes,config}/`; `artifacts/vacancymatch/src/{pages,components,lib}/`
- Mobile: desktop sidebar is `hidden md:flex`; below md, nav is a Sheet drawer + hamburger in `components/layout/app-layout.tsx` (drawer holds user info + logout for <sm). Keep both in sync when adding nav items
- Error responses use `{ message }` (ApiMessage). See the `pnpm-workspace` skill for workspace conventions
- Routing (`App.tsx`): unauthed switch (Landing at `/`, /signup, /pricing, fallback Login) vs authed switch (Dashboard at `/`, app pages, /login + /signup redirect to `/`, fallback NotFound)

## Auth, tenancy, signup & team

- Custom email/password auth (NOT Clerk/Replit Auth, per spec): scrypt hashes, cookie sessions (`vm_session`, httpOnly, 7-day TTL, sha256 token hash in `user_sessions`); roles owner/admin/recruiter/viewer; viewers read-only (`blockViewerWrites`); `/crm-sync-events` + `/audit-logs` admin+ only; auth/signup/invite/member/billing events are audit-logged
- Tenant scoping on all data routes: `tenantId` on data rows is the tenant **slug** (legacy `"demo"` text data), while `tenant_users.tenantId` is the tenants uuid PK; `tenantOf(req)` returns the slug
- Self-serve signup (POST /auth/signup: tenant + owner in one txn, auto slug with retry); invites (sha256 tokenHash, 7-day expiry, atomic UPDATE...RETURNING claim, email bound server-side); cannot modify owners/self; disabling a member kills their sessions

## Billing (Stripe) — details in docs/billing.md

- Credentials via connector API in `lib/stripeClient.ts` (NOT env vars); managed webhook `/api/stripe/webhook` (raw body, before express.json); synced data in read-only `stripe` DB schema; `tenant_billing` cache refreshed from `stripe.subscriptions` on GET /billing/subscription — never from checkout redirects
- Pricing source of truth `lib/billing/plans.ts` (GBP, 7-day no-card trials): Core £120, Professional £220 /user/mo self-serve; Business `contactOnly` (price IDs/amounts redacted from public API); annual = 10× monthly
- Access gate `middlewares/billing.ts`: trialing/active/past_due → full, else reads OK / writes 402; frontend `billing-gate.tsx` global trial-prompt on 402
- GET /billing/plans is public; `/pricing` + landing (`pages/landing.tsx`, unauthed `/`) are public; shared UI `components/plan-cards.tsx`

## Search & taxonomy — details in docs/search-taxonomy.md

- `lib/search/`: dictionaries/normalize/rank; config-only FS taxonomy (`finTaxonomy.ts`, `finClassify.ts`) for 6 sectors; tags computed at query time, never persisted
- Curated titles in `config/curatedTitles/` (7 industry files, ~700 titles); display families in `displayFamilies.ts`. After ANY taxonomy edit run `curatedTitles.test.ts` + `displayFamilies.test.ts`
- Company-kind recruiter filtering: `jobs.company_kind` set at ingestion via `lib/search/companyKind.ts`; dictionaries in `config/recruiterFirms.ts` + `config/recruiterOverrides.ts`; /jobs/search excludes recruitment firms by default (`includeRecruiters=true` to include); backfill via POST /internal/maintenance/reclassify-company-kinds
- GET /jobs/search: 200-row fetch window, sector SQL pre-filter, `sector_tag` authoritative for market sector; UI `pages/job-search.tsx`; saved searches + 15-min alert sweep (`lib/savedSearchAlerts.ts`)

## Matching

- Explainable weighted scoring (matching.ts): skills 35%, title 20%, industry 15%, location 15%, comp 10%, recency 5%; per-factor breakdown + explanation lines stored per match
- Match runs: active jobs from active sources only, `isCanonical=true` only, scores ≥ 30, top 25; CV upload auto-triggers a run via `runMatchForCandidate` (matchRunner.ts)

## Vacancy ingestion — details in docs/ingestion.md

- Providers in `lib/vacancies/`: Firecrawl employer sites, Google Jobs (SerpApi), 7 ATS platforms (`ats/`), Reed + Adzuna job boards; careers-directory engine in `lib/directory/` (london_insurance + 5 sector directories, config in `config/careersDirectories.ts`, generated seed files — never hand-edit)
- Dedupe first-provider-wins by sourceUrl (a source can legitimately show "N fetched, 0 jobs" when boards are shared); dedupe preference direct_employer > … > agency; ingestion idempotent by sourceUrl
- **No LinkedIn crawler** — "LinkedIn Jobs Crawler" is a seeded demo source; linkedin.com apply links via Google are `linkedin_via_google_jobs`
- Careers URLs and ATS board tokens rot — curl-probe before debugging extraction
- Internal admin+ ingestion endpoints (NOT in OpenAPI): POST `/internal/ingestion/*` — run one pattern per call. Expiry sweep every 6h; directory sweep hourly (opt-in per tenant)

## Integrations

- CV files: App Storage presigned uploads (`routes/storage.ts`, 10MB, pdf/docx/doc/txt); text extraction `lib/extractCvText.ts` (unpdf/mammoth)
- Resend: `lib/email.ts` via connector proxy (never throws). Sandbox mode: delivers only to account owner until a domain is verified; FROM onboarding@resend.dev
- Sentry: `SENTRY_DSN` / `VITE_SENTRY_DSN`; init in `lib/sentry.ts` with PII scrubbing; `index.ts` bootstraps Sentry before dynamically importing `start.ts`. No-ops when DSN unset
- PostHog: `src/lib/analytics.ts`, gated on `VITE_PUBLIC_POSTHOG_KEY`; host https://eu.i.posthog.com (EU account — US default silently fails)
- AI: `lib/aiClient.ts` `chatCompletion()` — Replit integration primary, `OPENAI_API_KEY` fallback; api-server must NOT depend on `openai` directly — import from `lib/integrations-openai-ai-server`
- Firecrawl: `lib/firecrawl.ts` (`FIRECRAWL_API_KEY`); SSRF-safe `validateResearchUrl`; routes in `routes/research.ts`. **Currently disabled to save credits**: `FIRECRAWL_DISABLED=true` (shared env, July 2026) — hard gate in `firecrawlScrape` blocks all callers; delete the env var + republish to re-enable
- Companies House: `lib/companiesHouse.ts` (`COMPANIES_HOUSE_API_KEY`, Basic auth, key trimmed); GET `/research/company`; display-only. UI in `components/research-url-dialog.tsx` (Jobs page)

## Production go-live

- Seed guardrails: in production `ensureAuthSeed()` seeds nothing unless `SEED_DEMO_PASSWORD` is set; `seedIfEmpty()` nothing unless `SEED_DEMO_DATA=true` — keep both unset; real tenants via /signup
- CORS is dev-only; prod serves the SPA same-origin behind the shared proxy. Cookie secure in prod
- Autoscale deploy: api-server esbuild → `node dist/index.mjs` with /api/healthz check; vacancymatch static from dist/public with SPA rewrite. Prod DB schema applied by Replit Publish — never hand-migrate prod
- Go-live externals (user actions): Stripe connector TEST → live keys + rerun seedStripeProducts.ts; Resend sandbox → verify a domain and update FROM in lib/email.ts
- Prod job data via /internal/ingestion endpoints against the published domain with an admin session (prod DB separate; dev ingestion never reaches prod). Deployment env can lag workspace secrets — probe provider keys in prod after publishing

## User preferences

- (none recorded yet)

## Gotchas

- No `console.log` in server code — use `req.log` / `logger`
- Audit-log `metadata` is raw JSON for compliance views only — never surface to end users. Dashboard activity descriptions from `lib/activityDescription.ts` (`describeActivity`); add new audit actions to its STATIC_ACTIONS map
- After changing `lib/*`, run `pnpm run typecheck:libs` before artifact typechecks (stale declarations cause phantom TS2305)
- `stripe-replit-sync` must stay in esbuild `external` (build.mjs) — bundling silently skips its migrations; `syncBackfill()` needs `{ object: "all" }`; connector settings keys are `secret` / `publishable`
- api-server esbuild externals include `@opentelemetry/*` — external packages' transitive deps must be direct deps of api-server (pnpm strict node_modules)
- Packages depending on `@opentelemetry/api` (e.g. @sentry/node) can split drizzle-orm type identities — add `@opentelemetry/api` to lib/db deps too
