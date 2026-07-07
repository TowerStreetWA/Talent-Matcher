# Vacancy Matching SaaS Module - Replit Ready Build Spec

## Product summary

Build a multi-tenant SaaS module for recruitment agencies and in-house talent teams that lets recruiters upload a candidate CV, analyse the profile, scan multiple live job sources, rank matching vacancies, and push the best matches back into their CRM. The positioning is a decision-support tool that helps recruiters work candidates proactively across the wider live market, rather than replacing their ATS or CRM.[cite:5][cite:9][cite:11]

The system should be designed as a bolt-on product that works with existing recruitment workflows, while keeping a recruiter in the loop for review, approval, shortlist actions, and CRM syncing. UK guidance on AI in recruitment stresses transparency, explainability, fairness, governance, and human oversight, and ICO recruitment guidance requires lawful basis, data minimisation, transparency, and careful handling of profiling and special-category data.[cite:17][cite:21]

## Core proposition

**Working title:** VacancyMatch AI

**One-line proposition:** Upload a CV, scan the live market, and instantly see the most relevant open roles for that candidate.[cite:17]

**Commercial angle:**
- Works with existing CRM/ATS systems rather than replacing them.[cite:9]
- Turns old CV stock into live market opportunity.[cite:11]
- Gives recruiters a wider market view than their internal jobs database alone.[cite:11]
- Can be sold as a standalone SaaS module or later folded into TSRecruit.[cite:4][cite:11]

## SaaS model

This should be built as a proper SaaS product, not a single-tenant internal tool. Use a shared application with tenant isolation from day one, because earlier multi-tenant work already confirmed that one shared app with tenant-level separation and self-serve onboarding is the preferred commercial direction.[cite:5][cite:9][cite:31]

### Recommended tenancy approach

Use a hybrid-ready architecture:
- **Default v1:** shared Postgres database with `tenant_id` on tenant-owned tables.
- **Isolation:** enforce tenant scoping in application services and add row-level security later if desired.
- **Future enterprise option:** allow database-per-tenant for premium customers if needed.[cite:31]

### Suggested plans

| Plan | Target user | Key limits | Monthly idea |
|---|---|---|---|
| Starter | Solo recruiter / small agency | 1 user, CV uploads cap, limited live scans | Low entry plan |
| Team | Growing agency | Multiple users, alerts, CRM sync, saved searches | Core plan |
| Pro AI | Agencies needing automation | Full matching, alerts, CRM sync, advanced AI scoring, API/webhooks | Higher-value plan |
| Enterprise | Large groups / in-house teams | SSO, custom integrations, dedicated data controls, optional silo tenancy | Custom |

Use Stripe for subscription checkout and tenant activation, matching the user's preferred SaaS billing pattern.[cite:5][cite:7]

## Replit stack

Use a practical Replit-friendly stack aligned with the user's current product approach:

- Front end: React + TypeScript.
- Back end: Node.js + TypeScript.
- Database: Postgres.
- Auth: email/password initially, with role-based access.
- Billing: Stripe subscriptions.
- Email/alerts: Resend.
- File storage: object storage for CV files.
- Background jobs: scheduled workers or queue-style job runners for crawling, parsing, and re-matching.[cite:3][cite:5]

### Suggested project structure

```txt
vacancymatch-saas/
  app/
    frontend/
    backend/
  db/
    schema.sql
    migrations/
  workers/
    crawl-worker.ts
    parse-worker.ts
    rematch-worker.ts
    alert-worker.ts
  shared/
    types/
    scoring/
    utils/
  docs/
    product-spec.md
    privacy-notes.md
  .env.example
  README.md
```

## Multi-tenant data model

Use these main entities.

### Tenant and access

- `tenants`
- `tenant_users`
- `subscriptions`
- `usage_events`
- `api_keys`
- `integration_connections`

### Candidate and CV

- `candidates`
- `candidate_files`
- `candidate_profiles`
- `candidate_preferences`
- `candidate_skill_entities`
- `candidate_activity_log`

### Vacancy market data

- `job_sources`
- `job_ingestion_runs`
- `jobs_raw`
- `jobs_normalized`
- `job_skill_entities`
- `job_company_entities`

### Matching and workflow

- `match_runs`
- `candidate_job_matches`
- `saved_match_lists`
- `job_alert_rules`
- `crm_sync_events`
- `review_decisions`

### Governance and compliance

- `consent_records`
- `privacy_notices_served`
- `retention_rules`
- `audit_logs`
- `bias_test_runs`
- `model_versions`

## Postgres starter schema

Use this as a copy-and-paste starting point.

```sql
create extension if not exists "pgcrypto";

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'starter',
  status text not null default 'active',
  accent_color text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  password_hash text not null,
  full_name text,
  role text not null default 'recruiter',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  external_crm_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  current_title text,
  current_company text,
  location_text text,
  country_code text,
  summary text,
  source text not null default 'manual_upload',
  created_by uuid references tenant_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table candidate_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  storage_url text not null,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

create table candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  parser_vendor text,
  parser_version text,
  normalized_json jsonb not null,
  skills_json jsonb,
  preferences_json jsonb,
  inferred_seniority text,
  inferred_salary_min numeric,
  inferred_salary_max numeric,
  parsed_at timestamptz not null default now()
);

create table job_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  name text not null,
  source_type text not null,
  base_url text,
  auth_config_json jsonb,
  is_global boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table jobs_normalized (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  source_id uuid references job_sources(id),
  source_job_id text,
  title text not null,
  company_name text,
  location_text text,
  remote_type text,
  employment_type text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  description_text text,
  apply_url text,
  posted_at timestamptz,
  expires_at timestamptz,
  status text not null default 'open',
  normalized_json jsonb,
  dedupe_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table match_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  triggered_by_user_id uuid references tenant_users(id),
  trigger_type text not null,
  model_version text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
);

create table candidate_job_matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  match_run_id uuid not null references match_runs(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  job_id uuid not null references jobs_normalized(id) on delete cascade,
  overall_score numeric not null,
  score_breakdown_json jsonb not null,
  explanation_text text,
  recruiter_status text not null default 'new',
  pushed_to_crm boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_run_id, candidate_id, job_id)
);

create table crm_sync_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete set null,
  job_id uuid references jobs_normalized(id) on delete set null,
  direction text not null,
  crm_name text not null,
  payload_json jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_user_id uuid references tenant_users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create index idx_candidates_tenant on candidates(tenant_id);
create index idx_candidate_profiles_tenant on candidate_profiles(tenant_id);
create index idx_jobs_normalized_status on jobs_normalized(status, posted_at desc);
create index idx_jobs_normalized_source_job on jobs_normalized(source_id, source_job_id);
create index idx_candidate_job_matches_candidate on candidate_job_matches(candidate_id, overall_score desc);
create index idx_crm_sync_events_tenant on crm_sync_events(tenant_id, status);
create index idx_audit_logs_tenant on audit_logs(tenant_id, created_at desc);
```

## Main workflows

### 1. Tenant signup flow

1. User signs up.
2. Create tenant.
3. Create first admin user.
4. Start Stripe checkout.
5. On successful payment, mark subscription active.
6. Redirect into onboarding.
7. Ask which CRM they use.
8. Ask which job sources they want enabled.
9. Ask whether they want alerts enabled.
10. Land them on the upload CV screen.[cite:5]

### 2. Upload and match flow

1. Recruiter uploads CV or drags it into the interface.
2. File is saved to storage.
3. Parse worker extracts structured profile data.
4. Candidate profile is normalized into internal JSON structure.
5. Match worker searches current open jobs.
6. Scoring engine ranks jobs.
7. Recruiter sees explainable results.
8. Recruiter can save, dismiss, tag, export, or push to CRM.
9. Alert rules can keep re-checking the market for new roles.

### 3. Daily market refresh flow

1. Crawl worker checks enabled sources.
2. Normalize and deduplicate jobs.
3. Close expired roles.
4. Re-run match jobs for watched candidates.
5. Generate alerts for strong new matches.
6. Send email/in-app notifications.

## Feature modules

### Module 1 - Auth and tenancy

Build:
- Tenant signup/login.
- User roles: `owner`, `admin`, `recruiter`, `viewer`.
- Tenant branding: logo + accent colour initially, matching earlier SaaS decisions.[cite:5]
- Usage metering per plan.

### Module 2 - CV upload and parsing

Build:
- Drag-and-drop upload.
- PDF and DOC/DOCX support.
- Parsing vendor abstraction.
- Recruiter edit screen for parsed profile corrections.
- Parsed profile tabs for skills, experience, location, salary, and preferences.

Suggested vendor abstraction interface:

```ts
export interface ResumeParserService {
  parse(buffer: Buffer, filename: string): Promise<{
    rawText: string;
    normalizedProfile: Record<string, unknown>;
    skills: string[];
    titles: string[];
    locations: string[];
    salary?: { min?: number; max?: number; currency?: string };
  }>;
}
```

Resume parsing API comparisons in 2026 commonly reference Affinda, Sovren, Textkernel, RChilli, DaXtra, and HireAbility, so the code should be vendor-agnostic from day one rather than hard-wired to one parser.[cite:15][cite:16]

### Module 3 - Job source ingestion

Build:
- Source registry.
- Source adapters for APIs, XML feeds, RSS, and company careers pages.
- Deduplication logic.
- Source freshness tracking.
- Source health dashboard.

Adapter interface:

```ts
export interface JobSourceAdapter {
  fetchJobs(config: Record<string, unknown>): Promise<Array<{
    externalId: string;
    title: string;
    companyName?: string;
    locationText?: string;
    employmentType?: string;
    remoteType?: string;
    salaryMin?: number;
    salaryMax?: number;
    salaryCurrency?: string;
    descriptionText?: string;
    applyUrl?: string;
    postedAt?: string;
  }>>;
}
```

Start with cleaner and lower-risk sources before broad crawling. ICO guidance stresses being clear about purpose, minimising unnecessary processing, and only using candidate information fairly and proportionately.[cite:21]

### Module 4 - Matching engine

Build a weighted, explainable scoring engine.

Suggested scoring buckets:
- Skills match: 35%
- Title/seniority match: 20%
- Industry/context match: 15%
- Location/commute/remote fit: 15%
- Contract/salary fit: 10%
- Recency/freshness: 5%

Starter TypeScript example:

```ts
export type MatchInput = {
  candidate: {
    skills: string[];
    titles: string[];
    industries: string[];
    location: string;
    remotePreference?: string;
    desiredSalaryMin?: number;
    contractTypes?: string[];
  };
  job: {
    title: string;
    skills: string[];
    industry?: string;
    location: string;
    remoteType?: string;
    salaryMin?: number;
    employmentType?: string;
    postedAt?: string;
  };
};

export function scoreMatch(input: MatchInput) {
  const scores = {
    skills: 0,
    title: 0,
    industry: 0,
    location: 0,
    comp: 0,
    recency: 0,
  };

  const candidateSkills = new Set(input.candidate.skills.map(s => s.toLowerCase()));
  const matchedSkills = input.job.skills.filter(s => candidateSkills.has(s.toLowerCase()));
  scores.skills = input.job.skills.length
    ? matchedSkills.length / input.job.skills.length
    : 0;

  const candidateTitles = input.candidate.titles.map(t => t.toLowerCase());
  scores.title = candidateTitles.some(t => input.job.title.toLowerCase().includes(t)) ? 1 : 0.4;

  scores.industry = input.job.industry && input.candidate.industries.includes(input.job.industry) ? 1 : 0.5;
  scores.location = input.candidate.location.toLowerCase() === input.job.location.toLowerCase() ? 1 : 0.5;
  scores.comp = input.job.salaryMin && input.candidate.desiredSalaryMin
    ? (input.job.salaryMin >= input.candidate.desiredSalaryMin ? 1 : 0.4)
    : 0.6;
  scores.recency = 1;

  const overall =
    scores.skills * 0.35 +
    scores.title * 0.20 +
    scores.industry * 0.15 +
    scores.location * 0.15 +
    scores.comp * 0.10 +
    scores.recency * 0.05;

  return {
    overallScore: Number((overall * 100).toFixed(2)),
    scoreBreakdown: scores,
    explanation: [
      `Matched ${matchedSkills.length} overlapping skills`,
      `Title alignment score: ${scores.title}`,
      `Location score: ${scores.location}`,
      `Compensation score: ${scores.comp}`,
    ],
  };
}
```

UK AI recruitment guidance recommends that employees must be able to meaningfully engage with outputs, understand intended use, and have clarity on why a recommendation was made, so explanation text is not optional; it is part of the product design.[cite:17]

### Module 5 - Recruiter review UI

Build these screens:
- Dashboard.
- Upload CV screen.
- Candidate profile review screen.
- Match results list.
- Match detail drawer with score explanation.
- Save to CRM modal.
- Alerts/watchlist screen.
- Integrations screen.
- Admin compliance/settings screen.

### Module 6 - CRM integrations

Initial design should support:
- Candidate sync from CRM.
- Push match notes back to CRM.
- Create task/note/activity.
- Save external job URL against candidate record.
- Tag candidate as market-matched.

Integration strategy:
- Build one generic integration service.
- Create adapters per CRM.
- Store OAuth/API credentials per tenant.
- Log all sync attempts.

```ts
export interface CrmAdapter {
  pushCandidateMatch(input: {
    candidateExternalId: string;
    matchSummary: string;
    relatedJobUrl: string;
    score: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; externalActivityId?: string; error?: string }>;
}
```

## Compliance and governance requirements

This product must be built as **AI-assisted matching with recruiter review**, not fully automated candidate decisioning. UK guidance highlights fairness, transparency, accountability, contestability, and the need for human oversight and repeated testing in AI recruitment deployments.[cite:17]

### Compliance requirements for v1

- Add privacy notice at upload and onboarding.
- Record lawful basis and processing purpose per tenant.
- Make clear this tool supports recruiter decision-making rather than making final employment decisions.[cite:17][cite:21]
- Allow recruiter review before any CRM push or candidate action.
- Log scoring explanations and recruiter override actions.[cite:17]
- Add configurable retention periods for CVs and parsed data.[cite:21]
- Add data deletion workflow.
- Add DPIA template in internal admin docs because ICO and DSIT guidance both flag DPIA needs for AI and profiling use cases.[cite:17][cite:21]
- Avoid using irrelevant or protected-characteristic data in match scoring wherever possible.[cite:21]
- Build versioning for models/parsers/scoring weights so outcomes can be traced.[cite:17]

### Buyer-facing trust message

Use language like:
- AI-assisted recruiter workflow.
- Explainable matching.
- Human review before action.
- Audit trail and configurable retention.
- GDPR-aware controls.[cite:17][cite:21]

## API routes

Suggested REST API shape.

```txt
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/billing/create-checkout-session
POST   /api/candidates/upload-cv
GET    /api/candidates
GET    /api/candidates/:id
PATCH  /api/candidates/:id
POST   /api/candidates/:id/run-match
GET    /api/candidates/:id/matches
POST   /api/matches/:id/save-to-crm
POST   /api/matches/:id/dismiss
POST   /api/alerts
GET    /api/job-sources
POST   /api/job-sources
POST   /api/integrations/:crm/connect
POST   /api/admin/retention-rules
GET    /api/admin/audit-logs
```

## Background workers

### `parse-worker.ts`
Responsibilities:
- Pull uploaded files awaiting parse.
- Send to parser service.
- Save normalized output.
- Flag low-confidence parses for recruiter review.

### `crawl-worker.ts`
Responsibilities:
- Poll job APIs/feeds.
- Crawl approved pages.
- Normalize jobs.
- Deduplicate by hash and source ID.

### `rematch-worker.ts`
Responsibilities:
- Re-run match jobs when new vacancies arrive.
- Re-run match jobs when candidate profile changes.
- Apply alert rules.

### `alert-worker.ts`
Responsibilities:
- Send email alerts.
- Create in-app notifications.
- Optionally trigger CRM tasks.

## Dedupe logic

You will need dedupe because the same role may appear in multiple places.

Use a dedupe hash made from combinations of:
- company name
- normalized title
- normalized location
- posted date band
- apply URL or source job ID

Mark duplicates rather than deleting immediately so source lineage is preserved.

## Matching UX rules

The UI should never just show a raw score. For every match, show:
- overall score
- strengths
- weaker areas
- salary fit
- location fit
- source freshness
- source name
- action buttons

Example output text:

```txt
Match score: 84
Why it matched:
- Strong overlap in Java, Spring, microservices
- Similar previous titles: Senior Java Developer, Backend Engineer
- London hybrid aligns with candidate location
- Salary slightly below recent inferred target
```

This approach reflects the UK guidance emphasis on transparency, explainability, and meaningful user engagement with AI outputs.[cite:17]

## Replit env example

```env
NODE_ENV=development
DATABASE_URL=postgres://...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
RESEND_API_KEY=...
STORAGE_BUCKET=...
STORAGE_REGION=...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
SESSION_SECRET=...
APP_URL=https://your-replit-app-url
PARSER_PROVIDER=affinda
PARSER_API_KEY=...
OPENAI_API_KEY=...
```

## Replit build order

### Phase 1 - SaaS foundation
- Auth.
- Tenants.
- Billing.
- Basic dashboard.
- CV upload.

### Phase 2 - Candidate parsing
- Parser integration.
- Candidate review UI.
- Candidate profile storage.

### Phase 3 - Vacancy ingestion
- Source registry.
- 2 to 3 source adapters.
- Job normalization and dedupe.

### Phase 4 - Matching engine
- Weighted scoring.
- Explanation layer.
- Recruiter review actions.

### Phase 5 - CRM sync and alerts
- CRM activity logging.
- Saved searches.
- New-match alerts.

### Phase 6 - Compliance and admin
- Audit logs.
- Retention settings.
- Deletion workflows.
- DPIA/admin notes.

## MVP limits

Do not try to scan the entire web in v1. Start with:
- selected APIs
- selected job feeds
- selected company career pages
- selected public sources that are operationally manageable

This reduces legal, technical, and quality risk while proving the core recruiter value first.[cite:17][cite:21]

## Suggested onboarding copy

```txt
Find live market vacancies for any candidate in minutes.
Upload a CV, review the profile, and let VacancyMatch AI surface the most relevant open roles from across your chosen job sources.
Your recruiters stay in control with explainable scoring, CRM sync, and alerts when better matches appear.
```

## Internal product rules

- Every tenant-owned query must be scoped by tenant ID.
- Every AI recommendation must be explainable.
- No automatic outbound candidate action without human review.
- Every external sync must be logged.
- Every uploaded CV must have retention and deletion support.
- Every parser and scoring version must be traceable.

## Plain-English developer brief

```txt
Build a multi-tenant SaaS recruitment module in Replit using React, Node.js, TypeScript, Postgres, Stripe, Resend, and object storage.

Main function:
A recruiter uploads a candidate CV. The system parses and normalizes the profile, scans enabled live job sources, scores and ranks relevant open vacancies, shows explainable results, and lets the recruiter save selected matches back to their CRM.

Important product rules:
- This is a bolt-on module for existing CRMs/ATS systems.
- It must be multi-tenant from day one.
- It must support self-serve signup and Stripe billing.
- It must keep recruiters in the loop for review and action.
- It must support audit logs, retention controls, and deletion workflows.
- It must store score breakdowns and match explanations.
- It must be designed so parser vendors and CRM integrations can be swapped later.

Build phases:
1. SaaS auth, tenancy, billing.
2. CV upload and parsing.
3. Job ingestion and normalization.
4. Matching engine and explanation UI.
5. CRM sync, alerts, and admin controls.
```

## Product positioning lines

Use these in the app, landing page, or sales copy.

- Turn every CV into a live vacancy search.
- Work candidates the old-school way, with modern AI and live market data.
- See relevant open roles beyond the jobs already sitting in your CRM.
- AI-assisted vacancy matching with recruiter review and CRM sync.[cite:11][cite:17]
