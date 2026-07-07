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

## Firecrawl research (Phase 6)

- `artifacts/api-server/src/lib/firecrawl.ts` — raw-fetch wrapper for Firecrawl v2 `/scrape` (no SDK, avoids esbuild-external issues); uses `FIRECRAWL_API_KEY`; 60s request + 30s page timeouts; `FirecrawlError` kinds config/blocked_url/upstream/timeout; `validateResearchUrl` is SSRF-safe (http/https only, blocks credentials, localhost, dotless hosts, private/link-local IPv4+IPv6, *.local/*.internal)
- `routes/research.ts`: POST `/research/scrape-url` (markdown + metadata + 600-char preview) and POST `/research/extract-job` (structured job fields via Firecrawl json format with explicit schema, per-field zod `.catch()` resilience). Errors: 400 blocked, 502 upstream/timeout, 503 unconfigured. Mounted behind auth + viewer-write block + billing gate; both actions audit-logged (url truncated, lengths/counts only — never scraped content in logs)
- UI: "Research URL" dialog on Jobs page (`components/research-url-dialog.tsx`) — extract job card + page preview; PostHog research_* events
- Unit tests for URL validation in `src/lib/firecrawl.test.ts`

## Companies House enrichment (Phase 7)

- `artifacts/api-server/src/lib/companiesHouse.ts` — raw-fetch wrapper (Basic auth base64(key+":"), base api.company-information.service.gov.uk, 15s timeout, key trimmed); `CompaniesHouseError` kinds config/invalid_input/not_found/rate_limited/upstream/timeout → 503/400/404/429/502/502; `describeSicCode()` maps SIC codes to recruiter-readable labels (curated 5-digit map + 2-digit division fallback + dormant/non-trading specials)
- Routes in `routes/research.ts`: GET `/research/company?query=` (top 5 name matches) and GET `/research/company/{companyNumber}` (profile: status, type, jurisdiction, incorporation date, SIC codes with descriptions, registered locality, last accounts). Display-only — never writes to jobs/tenants. Behind auth + viewer-write block + billing gate; audit actions `research.company_search` / `research.company_profile` (query truncated + counts only)
- UI: "UK company check" section inside the Research URL dialog (`research-url-dialog.tsx`) — search input, result list, profile card with SIC badges; PostHog events research_company_search / research_company_profile_viewed
- Env: `COMPANIES_HOUSE_API_KEY`. Unit tests for SIC mapping + company-number normalizer in `companiesHouse.test.ts`

## AI provider fallback (Phase 8)

- `artifacts/api-server/src/lib/aiClient.ts` — `chatCompletion()` wrapper: Replit AI integration proxy is primary by default; direct `OPENAI_API_KEY` client is an automatic fallback on retryable failures only (429/408/5xx/network/timeout via `isRetryableAiError`); non-retryable errors rethrow immediately. `AI_PROVIDER=direct` env flips routing order; `OPENAI_DIRECT_MODEL` (optional, blank = unset) overrides model on the direct path only. Failover + fallback-success logged via `logger` with provider names
- `cvParser.ts` (only OpenAI call site) routes through the wrapper; behavior unchanged when the integration is healthy
- api-server must NOT depend on `openai` directly — pnpm peer-splits it into two identities and breaks `instanceof OpenAI.APIError` across the integration lib. Instead `lib/integrations-openai-ai-server` exports `createDirectOpenAIClient()` + the `OpenAI` class; import those
- Unit tests for provider order + retryable classifier in `aiClient.test.ts`

## Activation & trial conversion (Phase 9)

- `artifacts/vacancymatch/src/lib/billing-gate.tsx` — BillingGateProvider: global trial-prompt dialog. 402s from ANY mutation are intercepted via a react-query `MutationCache.onError` (App.tsx) → `notifyApiError()`; dialog shows the server message + Starter trial CTA (admin/owner) or ask-an-admin note. `ApiError` is exported from `lib/api-client-react` for status checks (`isBillingGateError`)
- Return-path: before checkout/View-plans the current wouter location is stored in sessionStorage `vm_checkout_return`; billing.tsx consumes it on `?checkout=success` once `canUseCoreProduct` is true (validated `startsWith("/")`, cleared on cancel) and navigates back
- `components/getting-started.tsx` — dashboard "Get set up" panel: 4 steps (trial → source → CV → shortlist) derived from existing subscription + dashboard-summary queries; only the first incomplete step gets an action button (single primary action); dismissible per tenant via localStorage; auto-hides when complete. Zero-value dashboard metric cards render CTA links
- upload-cv.tsx suppresses its own 402 toasts (dialog handles them); other pages had no onError handlers. PostHog events: trial_prompt_shown, trial_prompt_checkout_started

## Search quality (Phase 5)

- `artifacts/api-server/src/lib/search/` — dictionaries.ts (explicit ABBREVIATIONS/SYNONYM_GROUPS/STOP_WORDS; extend these to teach search new shorthand), normalize.ts (`normalizeQuery` → phrases/tokens/variants; quoted phrases preserved verbatim), rank.ts (explicit weighted components: exactTitle 100 > phraseInTitle 70 > variantInTitle 55 > titleTokens ≤40 > name > company 25/12 > taxonomy ≤30 > fuzzy 5; recency tiebreak)
- Candidates/jobs GET: variants broaden ILIKE across name/title/company/location/skills/titles/industries (arrays via `array_to_string`), then in-memory rank when `search` present; date order otherwise. Every search is logged via `req.log` (event `search`: truncated raw/normalized query, filters, resultCount, zeroResults)
- GET /search/suggestions?scope=jobs|candidates&q= (min 2 chars) — tenant-scoped titles/companies/skills, prefix>word>substring ranked, max 8
- Frontend: `components/search-box.tsx` (debounced suggestions dropdown, keyboard nav), `hooks/use-debounce.ts`; candidates/jobs/matches pages have filter chips + clear-all + result counts + zero-result recovery buttons; PostHog events: search_performed, search_zero_results, suggestion_selected, search_result_clicked
- Unit tests: `pnpm --filter @workspace/api-server run test` (vitest, search lib)

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
