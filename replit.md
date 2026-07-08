# VacancyMatch AI

Multi-tenant SaaS for recruiters: upload a CV, AI-parse it into a candidate profile, and match it against live jobs with explainable weighted scoring. Recruiter actions: shortlist / dismiss / push-to-CRM; plus job sources with health status, saved searches + alerts, compliance/audit views, dashboard KPIs.

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
- Error responses use `{ message }` (ApiMessage). See the `pnpm-workspace` skill for workspace conventions

## Auth, tenancy, signup & team

- Custom email/password auth (NOT Clerk/Replit Auth, per spec): scrypt hashes, cookie sessions (`vm_session`, httpOnly, 7-day TTL, sha256 token hash in `user_sessions`); roles owner/admin/recruiter/viewer; viewers read-only (`blockViewerWrites`); `/crm-sync-events` + `/audit-logs` admin+ only; auth/signup/invite/member/billing events are audit-logged
- Tenant scoping on all data routes: `tenantId` on data rows is the tenant **slug** (legacy `"demo"` text data), while `tenant_users.tenantId` is the tenants uuid PK; `tenantOf(req)` returns the slug
- Self-serve signup (POST /auth/signup: tenant + owner in one txn, auto slug with retry); invites (sha256 tokenHash, 7-day expiry, atomic UPDATE...RETURNING claim, email bound server-side); cannot modify owners/self; disabling a member kills their sessions

## Billing (Stripe)

- Replit Stripe integration (`stripe` + `stripe-replit-sync`; credentials via connector API in `lib/stripeClient.ts` — NOT env vars). Managed webhook `/api/stripe/webhook` (raw body, registered BEFORE express.json). Webhook-synced data lives in the `stripe` DB schema (read-only). `tenant_billing` caches per-tenant state, refreshed from `stripe.subscriptions` on GET /billing/subscription — never from checkout redirects. Trials: `payment_method_collection: if_required` (no card)
- Access gate (`middlewares/billing.ts`): trialing/active/past_due → full; otherwise reads OK, writes 402; billing + auth routes always reachable; checkout/portal admin+ only. Frontend: `billing-gate.tsx` intercepts all mutation 402s via react-query MutationCache → global trial-prompt dialog; return-path via sessionStorage `vm_checkout_return`
- Pricing: single source of truth `lib/billing/plans.ts` — GBP per-user/month: Solo £79, Team £149, Pro Agency £229 (7-day trials), Enterprise contact-only (mailto, no checkout). Annual = 10× monthly. `softCaps`/`featureFlags` config-only (not enforced). `LEGACY_PLAN_ALIASES` maps `starter`→`solo`; demo tenant keeps its old USD subscription (plan changes via Stripe portal — cross-currency checkout is rejected → 400). Price IDs resolved from `stripe.prices` via product `metadata.plan_key` + price `metadata.billing_interval`, GBP only
- GET /billing/plans is public (mounted before requireAuth); `/pricing` page is public + in-app; shared UI in `components/plan-cards.tsx`
- Seed products: `pnpm --filter @workspace/scripts exec tsx src/seedStripeProducts.ts` (idempotent); `src/devStartTrial.ts` starts a dev trial for demo tenant

## Search & FS taxonomy

- `lib/search/`: dictionaries.ts (ABBREVIATIONS/SYNONYM_GROUPS/STOP_WORDS — extend to teach shorthand), normalize.ts, rank.ts (explicit weighted components; recency tiebreak). Candidates/jobs GET: ILIKE broadening + in-memory rank when `search` present; every search logged (`search` event). GET /search/suggestions (tenant-scoped, max 8). Frontend `components/search-box.tsx`
- FS taxonomy (config-only): `finTaxonomy.ts` — SECTOR_TERMS (insurance/banking/pensions/asset_management/accountancy_finance/it_tech), FUNCTION_TERMS, EMPLOYER_TYPE_RULES; extend dictionaries here, no logic. `finClassify.ts` — deterministic classification (`classifyVacancy` title 3x weight; strong terms qualify, contextual corroborate); tags computed at search/match time, NOT persisted (taxonomy tuning needs no migrations). rank.ts FS boosts apply ONLY when the query has FS intent — non-FS queries are bit-identical. `matching.ts` industryScore checks FS sector alignment first (1.0 match / 0.2 cross-FS gap), legacy free-text fallback unchanged. `debug=1` on GET /jobs|/candidates adds `searchDebug`
- Curated titles: `config/curatedTitles/` — 7 industry files spread into index.ts: insurance (~113), banking (~134), pensions (~78), fundManagers (~90), assetManagementRealAssets (~60, same `asset_management` industry), accountancyFinance (~92, sector `accountancy_finance`), itTech (~140, sector `it_tech`, 15 tech FinFunctions e.g. software_engineering/devops_sre/cyber_security). Entry: industry (FinSector), family (FinFunction — union uses `client_service`/`investments`, NOT `distribution`/`investment`), canonicalTitle, variants, optional seniority + free-form `tags` (spec's finer families, config-only; consumed by display families)
- Curated collision rules: bare finance titles (CFO, Financial Controller, Management Accountant, Treasury Analyst, Internal Auditor, FP&A Analyst, Head of Treasury) → accountancy_finance; sector files claim them only with qualifiers ("(Banking)", "(Asset Management)") — exact match beats contained so qualified forms win. FM↔AM-real-assets shared titles defined once in fundManagers.ts with merged variants. Bare "Business Partner" and bare "Business Analyst" deliberately not curated (cross-sector collisions; "IT Business Analyst" etc. are). Loader `lib/search/curatedTitles.ts`: exact-then-longest-contained match (single-word variants exact-only); overrides classifyVacancy + feeds query expansion. Run `curatedTitles.test.ts` (global no-duplicate-variant guard) after any taxonomy edit
- Display families (config-only): `config/curatedTitles/displayFamilies.ts` — per-sector recruiter-facing family filters; each maps to FinFunction families and/or curated-title tags (OR semantics, `matchesDisplayFamily`). Keys may repeat across sectors (e.g. `leadership`) — unscoped resolution uses `resolveDisplayFamilies` (all sectors), never first-match. `displayFamilies.test.ts` enforces every curated title reachable via some display family of its sector — run after taxonomy edits

## Recruiter job search

- GET /jobs/search (q, location, sector, source, families CSV, page ≤50/page) — tenant-scoped active+canonical jobs; registered BEFORE /jobs/:id; 400 on unknown sector/source/family key. GET /jobs/search/families (?sector=) returns the display-family catalog for chips. Config dictionaries in `lib/search/jobSearchFilters.ts` (SECTOR_INPUT_ALIASES incl. technology/IT → it_tech, LOCATION_GROUPS); boosts in `jobSearchRank.ts` (also returns fn+curatedTags for family filtering); sector tags computed at query time; fetch cap 200
- UI `pages/job-search.tsx` at `/job-search`: sector chips (+ IT & Tech), family chips per selected sector (sector change clears families), filter chips, badges, pagination, URL-param init (q/location/sector/source/families)
- Saved searches: `saved_job_searches` per-user CRUD at `/job-searches` (incl. `families` jsonb, validated on create, default []); data-level alerts via `lib/savedSearchAlerts.ts` 15-min sweep → `saved_search_alert_events` (families honored; unknown keys silently dropped); search analytics in `search_events` (page-1 only, insert failures never break search). Integration test `routes/jobsSearch.integration.test.ts` (real dev DB)

## Matching

- Explainable weighted scoring (matching.ts): skills 35%, title 20%, industry 15%, location 15%, comp 10%, recency 5%; per-factor breakdown + explanation lines stored per match
- Match runs: active jobs from active sources only, `isCanonical=true` only, scores ≥ 30, top 25; CV upload auto-triggers a run via `runMatchForCandidate` (matchRunner.ts)

## Vacancy ingestion & freshness

- `lib/vacancies/`: employerSiteProvider (Firecrawl careers-page crawl, concurrency 3), googleJobsProvider (SerpApi, `SERPAPI_API_KEY`; paginates `next_page_token` ≤20 pages; first uncached query slow — retry hits cache), dedupe.ts (cluster = normalized title+company; preference: direct_employer > legacy > google employer-domain > google aggregator > job_board > agency), ingestionRunner.ts (idempotent by sourceUrl; canonical swap transactional)
- **No LinkedIn crawler** — "LinkedIn Jobs Crawler" is a seeded demo source. Google Jobs results with linkedin.com apply links are attributed to "LinkedIn Jobs (via Google)" (`sourceProvider: linkedin_via_google_jobs`; dedupe ranks unchanged). See `docs/linkedin-audit.md`
- Config: `config/employerSites.ts` (careers URLs rot — curl-probe before debugging extraction), `config/ingestionPatterns.ts` (sector×location patterns, extend coverage there), `config/ingestionFreshness.ts` (expiry thresholds: google/linkedin 14d, company_site 21d, default 30d)
- Internal admin+ endpoints (deliberately NOT in OpenAPI): POST `/internal/ingestion/{employer-sites,google-jobs,run-patterns,expire-stale}` — run patterns one per curl call (multi-pattern HTTP runs exceed safe duration)
- Expiry sweep (`expirySweep.ts`): every 6h, advisory xact lock, expires ingestion-backed jobs past freshness thresholds; manual/demo jobs never expire. `jobs.last_seen_at` bumped on re-discovery (discoveredAt = first-seen). `job_sources` has is_demo/provider/last_fetch_count; JobSource DTO exposes the funnel (jobCount = activeJobs)
- `jobs.sector_tag` stores the ingestion pattern's sector; query-time classification is the fallback

## Integrations

- CV files: App Storage presigned uploads (`routes/storage.ts`, 10MB, pdf/docx/doc/txt); text extraction `lib/extractCvText.ts` (unpdf/mammoth)
- Resend: `lib/email.ts` via connector proxy (never throws). Sandbox mode: delivers only to account owner until a domain is verified; FROM onboarding@resend.dev
- Sentry: `SENTRY_DSN` / `VITE_SENTRY_DSN` env vars; server init in `lib/sentry.ts` with PII scrubbing; `index.ts` is a bootstrap that inits Sentry then dynamically imports `start.ts` (ESM hoisting would load Express first). No-ops when DSN unset
- PostHog: `src/lib/analytics.ts`, gated on `VITE_PUBLIC_POSTHOG_KEY`; host is https://eu.i.posthog.com (EU cloud account — US default silently fails)
- AI: `lib/aiClient.ts` `chatCompletion()` — Replit integration primary, direct `OPENAI_API_KEY` fallback on retryable failures only; `AI_PROVIDER=direct` flips order. api-server must NOT depend on `openai` directly (pnpm peer-split breaks `instanceof`); import from `lib/integrations-openai-ai-server`
- Firecrawl research: `lib/firecrawl.ts` raw-fetch wrapper (`FIRECRAWL_API_KEY`); `validateResearchUrl` is SSRF-safe; routes in `routes/research.ts` (scrape-url, extract-job); never log scraped content
- Companies House: `lib/companiesHouse.ts` (`COMPANIES_HOUSE_API_KEY`, Basic auth, key trimmed); GET `/research/company` search + profile with SIC descriptions; display-only, never writes to jobs/tenants
- Research + Companies House UI lives in `components/research-url-dialog.tsx` (Jobs page)

## Production go-live

- Seed guardrails: in production `ensureAuthSeed()` seeds nothing unless `SEED_DEMO_PASSWORD` is set; `seedIfEmpty()` nothing unless `SEED_DEMO_DATA=true` — keep both unset; real tenants via /signup
- CORS is dev-only; prod serves the SPA same-origin behind the shared proxy. Cookie secure in prod
- Autoscale deploy: api-server esbuild → `node dist/index.mjs` with /api/healthz check; vacancymatch static from dist/public with SPA rewrite. Prod DB schema applied by Replit Publish (schema diff) — never hand-migrate prod
- Go-live externals (user actions): Stripe connector in TEST mode → switch to live keys + rerun seedStripeProducts.ts (webhook re-registers on boot); Resend sandbox → verify a domain and update FROM in lib/email.ts

## User preferences

- (none recorded yet)

## Gotchas

- No `console.log` in server code — use `req.log` / `logger`
- After changing `lib/*`, run `pnpm run typecheck:libs` before artifact typechecks (stale declarations cause phantom TS2305)
- `stripe-replit-sync` must stay in esbuild `external` (build.mjs) — bundling silently skips its migrations; `syncBackfill()` needs `{ object: "all" }`; connector settings keys are `secret` / `publishable`
- api-server esbuild externals include `@opentelemetry/*` — external packages' transitive deps must be direct deps of api-server (pnpm strict node_modules)
- Packages depending on `@opentelemetry/api` (e.g. @sentry/node) can split drizzle-orm type identities — add `@opentelemetry/api` to lib/db deps too
