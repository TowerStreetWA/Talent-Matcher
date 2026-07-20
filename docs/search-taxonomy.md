# Search, FS taxonomy, recruiter filtering & job search — detailed reference

## Core search

- `lib/search/`: dictionaries.ts (ABBREVIATIONS/SYNONYM_GROUPS/STOP_WORDS — extend to teach shorthand), normalize.ts, rank.ts (explicit weighted components; recency tiebreak). Candidates/jobs GET: ILIKE broadening + in-memory rank when `search` present; every search logged (`search` event). GET /search/suggestions (tenant-scoped, max 8). Frontend `components/search-box.tsx`.

## FS taxonomy (config-only)

- `finTaxonomy.ts` — SECTOR_TERMS (insurance/banking/pensions/asset_management/accountancy_finance/it_tech), FUNCTION_TERMS, EMPLOYER_TYPE_RULES; extend dictionaries here, no logic.
- `finClassify.ts` — deterministic classification (`classifyVacancy` title 3x weight; strong terms qualify, contextual corroborate); tags computed at search/match time, NOT persisted (taxonomy tuning needs no migrations).
- rank.ts FS boosts apply ONLY when the query has FS intent — non-FS queries are bit-identical. `matching.ts` industryScore checks FS sector alignment first (1.0 match / 0.2 cross-FS gap), legacy free-text fallback unchanged. `debug=1` on GET /jobs|/candidates adds `searchDebug`.

## Curated titles

- `config/curatedTitles/` — 7 industry files spread into index.ts: insurance (~113), banking (~134), pensions (~78), fundManagers (~90), assetManagementRealAssets (~60, same `asset_management` industry), accountancyFinance (~92, sector `accountancy_finance`), itTech (~140, sector `it_tech`, 15 tech FinFunctions e.g. software_engineering/devops_sre/cyber_security). Entry: industry (FinSector), family (FinFunction — union uses `client_service`/`investments`, NOT `distribution`/`investment`), canonicalTitle, variants, optional seniority + free-form `tags` (spec's finer families, config-only; consumed by display families).
- Collision rules: bare finance titles (CFO, Financial Controller, Management Accountant, Treasury Analyst, Internal Auditor, FP&A Analyst, Head of Treasury) → accountancy_finance; sector files claim them only with qualifiers ("(Banking)", "(Asset Management)") — exact match beats contained so qualified forms win. FM↔AM-real-assets shared titles defined once in fundManagers.ts with merged variants. Bare "Business Partner" and bare "Business Analyst" deliberately not curated (cross-sector collisions; "IT Business Analyst" etc. are).
- Loader `lib/search/curatedTitles.ts`: exact-then-longest-contained match (single-word variants exact-only); overrides classifyVacancy + feeds query expansion. Run `curatedTitles.test.ts` (global no-duplicate-variant guard) after any taxonomy edit.

## Classification tags & display families

- `lib/search/classification.ts` — SECTOR_LABELS (single source of human-friendly sector labels) + `classifyJobForDisplay`/`classifyCandidateForDisplay`/`classificationFromTags`; Job DTO has `classification` (Classification schema: sector/sectorLabel/families/familyLabels, null when unclassified), Match DTO has `candidateClassification`, /jobs/search results carry sectorLabel/families/familyLabels. Frontend `components/classification-tags.tsx` (1 sector + ≤3 family chips + "+N more"; renders nothing on null); family chips on /job-search cards apply the family filter.
- Display families (config-only): `config/curatedTitles/displayFamilies.ts` — per-sector recruiter-facing family filters; each maps to FinFunction families and/or curated-title tags (OR semantics, `matchesDisplayFamily`). Keys may repeat across sectors (e.g. `leadership`) — unscoped resolution uses `resolveDisplayFamilies` (all sectors), never first-match. `displayFamilies.test.ts` enforces every curated title reachable via some display family of its sector — run after taxonomy edits.

## Recruiter filtering (company kind)

- `jobs.company_kind` (direct_employer/recruitment_firm/job_board/unknown, NULL = legacy unclassified) set at ingestion (`ingestionRunner`) via `lib/search/companyKind.ts`; config-only dictionaries in `config/recruiterFirms.ts` (registry ~65 firms + JOB_BOARD_COMPANIES + name patterns + text signals) and `config/recruiterOverrides.ts` (force_direct e.g. Reed Smith / force_recruiter). Precedence: overrides → registry (normalized-name equality + domain suffix) → job-board names → name patterns → text signals (1 strong or 2 weak).
- Aliases are equality-only ("Reed" must not swallow "Reed Smith"); reed.co.uk domain deliberately excluded. Recruiter brand divisions ("Hays Construction and Property", "Michael Page Legal") need explicit aliases — check leaks with a `company_kind='direct_employer' AND company_name ILIKE` probe after registry edits.
- /jobs/search excludes `recruitment_firm` by default (`IS DISTINCT FROM` — NULL rows always kept); `includeRecruiters=true|1` includes them; saved searches persist `includeRecruiters` (alerts honor it). Jobs are never deleted, only filtered. UI: toggle + "Recruitment firm" amber badge + filter chip on /job-search.
- Backfill: POST /internal/maintenance/reclassify-company-kinds (admin+, tenant-scoped, idempotent — rerun after registry edits; restart server first, registry is imported at boot). Diagnostics: sector-scorecards `company_kinds` block (totals + per-industry recruiter_share_pct). Tests: `companyKind.test.ts`, `jobsSearchRecruiterFilter.integration.test.ts`.

## Recruiter job search (GET /jobs/search)

- Params: q, location, sector, source, families CSV, page ≤50/page — tenant-scoped active+canonical jobs; registered BEFORE /jobs/:id; 400 on unknown sector/source/family key. Fetch window is TOTAL_CAP=200 newest rows; when `sector` is set a SQL pre-filter (`sector_tag = sector OR sector_tag IS NULL`) keeps the window from being consumed by other sectors. Sector inferred from `q` alone gets no pre-filter (known cap). Regression tests in `jobsSearchCap.integration.test.ts`.
- Sector semantics: `jobs.sector_tag` (ingestion pattern/provider) is authoritative for a job's market sector — `scoreJobSearch` uses effectiveSector = valid sectorTag ?? title classification, so finance/tech roles at insurers stay under Insurance (family = function stays title-based).
- GET /jobs/search/families (?sector=) returns the display-family catalog for chips. Config dictionaries in `lib/search/jobSearchFilters.ts` (SECTOR_INPUT_ALIASES incl. technology/IT → it_tech, LOCATION_GROUPS); boosts in `jobSearchRank.ts` (also returns fn+curatedTags for family filtering); sector tags computed at query time.
- UI `pages/job-search.tsx` at `/job-search`: sector chips (+ IT & Tech), family chips per selected sector (sector change clears families), filter chips, badges, pagination, URL-param init (q/location/sector/source/families).
- Saved searches: `saved_job_searches` per-user CRUD at `/job-searches` (incl. `families` jsonb, validated on create, default []); data-level alerts via `lib/savedSearchAlerts.ts` 15-min sweep → `saved_search_alert_events` (families honored; unknown keys silently dropped); search analytics in `search_events` (page-1 only, insert failures never break search). Integration test `routes/jobsSearch.integration.test.ts` (real dev DB).
