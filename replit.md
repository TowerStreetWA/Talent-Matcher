# VacancyMatch AI

Multi-tenant SaaS for recruiters: upload a CV, AI-parse it into a candidate profile, and match it against live jobs with explainable weighted scoring.

## Run & Operate

- Workflows: `artifacts/api-server: API Server` (port 8080, path `/api`) and `artifacts/vacancymatch: web` (port 18259, path `/`)
- `pnpm run typecheck` — full typecheck across all packages (run `typecheck:libs` first after lib changes)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`; AI parsing uses `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` (Replit AI integration, billed to credits)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5; Frontend: React + Vite (`artifacts/vacancymatch`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`; API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the API contract (paths are root-level, e.g. `/audit-logs`, no `/admin` prefix)
- `lib/db/src/schema/` — Drizzle schemas: candidates, jobSources, jobs, matchRuns, matches, alertRules, crmSyncEvents, auditLogs (uuid PKs, `tenantId` default `"demo"`)
- `artifacts/api-server/src/lib/` — matching.ts (weighted scoring + explanations), matchRunner.ts (shared match-run executor), cvParser.ts (OpenAI CV parse, Zod-validated), seed.ts (demo data, runs when job_sources is empty), audit.ts, dto.ts
- `artifacts/api-server/src/routes/` — candidates, matches, jobs, jobSources, alertRules, dashboard, admin
- `artifacts/vacancymatch/src/pages/` — dashboard, upload, candidates, candidate detail, matches, jobs, sources, alerts, compliance

## Architecture decisions

- Explainable weighted scoring: skills 35%, title 20%, industry 15%, location 15%, comp 10%, recency 5%; every match stores a per-factor breakdown + human-readable explanation lines
- Match runs only consider active jobs from active sources, keep scores ≥ 30, top 25; candidate `lastMatchedAt`/`bestMatchScore`/`matchCount` updated per run
- CV upload auto-triggers a match run (`triggerType: "cv_upload"`) via `runMatchForCandidate` in matchRunner.ts
- Error responses use `{ message }` shape (ApiMessage)
- Multi-tenancy is schema-ready (`tenantId` columns) but not enforced yet; auth and Stripe billing are deferred fast-follows

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
