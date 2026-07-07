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
- Stripe billing is a deferred fast-follow (Phase 2)

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

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
