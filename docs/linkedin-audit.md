# LinkedIn & Google Jobs ingestion audit (Phase 14)

Date: 2026-07-08 · Tenant audited: `demo`

## Part 1 — LinkedIn "crawler" audit findings

**There is no LinkedIn crawler in this codebase.** The "LinkedIn Jobs Crawler"
entry in the Sources panel is a **seeded demo `job_sources` row** created by
`src/lib/seed.ts` (name: "LinkedIn Jobs Crawler", baseUrl
`https://www.linkedin.com/jobs`, sourceType `crawler`). Its 7 active jobs are
static demo seed data — no code ever fetched anything from LinkedIn.

That fully explains "LinkedIn shows 99+ results but we have 7": the 7 were
never search results in the first place.

### Why we did not build a direct LinkedIn scraper

- LinkedIn's User Agreement prohibits automated scraping/crawling of its
  pages, and the site enforces this aggressively (authwall, bot detection).
- The task constraints explicitly rule out crawling that violates provider
  TOS.

### Compliant approach taken instead

LinkedIn-hosted listings already surface through Google Jobs: many results
carry an `apply_options` link pointing at `linkedin.com`. We now detect those
and attribute them to a dedicated **"LinkedIn Jobs (via Google)"** source
(`source_provider = "linkedin_via_google_jobs"`, sourceType stays
`google_jobs` so dedupe preference ranks are unchanged). This grows LinkedIn
coverage materially with zero TOS exposure.

## Part 2/3 — Google Jobs audit findings & expansion

Before this phase:

- One ad-hoc query per run via `POST /internal/ingestion/google-jobs`.
- **Hard cap of 10 results per run** (single SerpApi page, no pagination).
- No sector/location pattern config; no recurring query set.
- 90 stored jobs total, all from manual one-off runs.

Changes:

- **Pagination**: `googleJobsProvider` now follows SerpApi's
  `next_page_token` until the per-query cap is reached (safety ceiling of 20
  pages/query). SerpApi has no reliable date filter for google_jobs, so no
  recency restriction is applied at fetch time — expiry stays the job of the
  canonicalisation/expiry layer, as specified.
- **Config-driven patterns** in `src/config/ingestionPatterns.ts`:

  | name | keywords | location | sectorTag | cap |
  |---|---|---|---|---|
  | insurance_london | insurance jobs | London, United Kingdom | insurance | 60 (default) |
  | banking_london | banking jobs | London, United Kingdom | banking | 60 |
  | pensions_london | pensions jobs | London, United Kingdom | pensions | 60 |
  | asset_management_london | asset management jobs | London, United Kingdom | asset_management | 60 |

  Per-pattern `maxResults` is configurable (clamped to a ceiling of 200).
  Add/remove patterns here — no crawler logic changes needed.
- **Sector tags**: every ingested job now stores the pattern's `sectorTag`
  (new nullable `jobs.sector_tag` column) for later ranking/filtering.
  Query-time classification (`classifyVacancy`) remains the fallback for
  untagged rows.
- **Batch entrypoint**: `POST /internal/ingestion/run-patterns`
  (`{"patterns": ["insurance_london"]}` optional filter; admin+, audit-logged,
  internal-only). Returns per-pattern summaries plus the canonicalisation
  funnel snapshot.

## Part 4 — Ingestion & canonicalisation metrics

- Every ingestion run logs `event: "vacancy_ingestion"` with `runId`,
  `fetched`, `stored`, `insertedCanonical`, `insertedDuplicates`,
  `canonicalSwaps`, `refreshedExisting`, `clustersTouched`, and
  `fetchedByProvider` (e.g. how many of a Google Jobs run were
  LinkedIn-hosted).
- `logCanonicalFunnel(tenantId)` logs `event: "vacancy_canonical_funnel"` —
  per source provider: total, active, inactive/expired, duplicates, and
  canonical-active (the set recruiters actually see). Called after every
  batch run and returned in the endpoint response.

## Before / after metrics (tenant `demo`)

| Source | Before (total / canonical-active) | After (total / canonical-active) |
|---|---|---|
| Google Jobs | 90 / 90 | 295 / 293 |
| LinkedIn Jobs (via Google) | — | 34 / 34 |
| LinkedIn Jobs Crawler (seed demo) | 7 / 7 | 7 / 7 (unchanged, static seed) |
| Company career sites | 12 / 12 | 12 / 12 |

Run-level numbers (60 fetched per pattern, 240 total): 237 inserted canonical,
2 inserted duplicates, 1 refreshed existing. LinkedIn-hosted share of fetched
results: 35/240 (~15%).

Sector tags now stored: insurance 59, banking 60, pensions 60,
asset_management 60 (120 older rows remain untagged → query-time
classification).

## Canonicalisation/expiry observations

- Dedupe loss is currently tiny (2 duplicates + 1 refresh across 240 fetched)
  because sector queries barely overlap. The funnel log will make any future
  loss visible per source.
- **No expiry sweep exists yet**: every ingested job stays `active` forever
  (`inactive: 0` across all sources). Discovered jobs will accumulate; a
  staleness sweep (e.g. mark inactive when not re-discovered within N days,
  using `discoveredAt`) is the natural next phase.
- The 7 seeded "LinkedIn Jobs Crawler" demo jobs (and other seeded feed
  sources) are indistinguishable from real ingested jobs in the UI. Consider
  retiring the seeded discovery sources in production tenants.
