---
name: Production data population
description: Prod DB is separate — ingestion must be triggered against the published domain; deployment secrets can lag workspace secrets.
---

# Production data population

**Rule:** Ingestion runs executed in dev populate only the dev DB. The published app has its own database; after publishing, job data must be populated by calling the internal ingestion endpoints against the production domain with an admin session cookie. The prod DB is read-only from the workspace (SELECT via read replica), so HTTP endpoints are the only write path.

**Why:** After a republish the user saw near-empty search results in prod while dev had thousands of jobs — all ingestion had run against dev only. Opt-in sweeps never started in prod because no directory source existed there yet.

**How to apply:**
- Login works with the seeded demo credentials on prod if the tenant was seeded before guardrails.
- One successful directory batch per directory creates the `<prefix>_%` source that opts the tenant into the hourly sweep — seed each directory once and the sweeps maintain it.
- Deployment env vars can lag workspace secrets: some provider keys (Reed/Adzuna) were missing in prod while others (SerpApi/Firecrawl) were present. Probe each keyed provider with a tiny request against prod before assuming it works; missing keys need the user to sync secrets at publish time.
- Third-party quota errors (e.g. Firecrawl "insufficient credits") are account-level and hit dev and prod alike — not a deployment config issue.

# Recency-capped search recall

**Rule:** Any "fetch newest N rows then filter in memory" pipeline silently loses recall for filtered categories as total volume grows past N — recent bulk ingestion of one category evicts older rows of another. Push at least a coarse category pre-filter into SQL (tag column OR NULL for untagged rows) and keep the precise in-memory classifier authoritative.

**Why:** /jobs/search with cap 200 returned 23 insurance jobs while the DB held 171+, right after other sectors were bulk-ingested.

**Postgres ordering trap:** `ORDER BY posted_at DESC` puts NULLs *first*, so bulk-ingested rows without a posted date consume the entire capped fetch before any dated row loads. If the window/filter predicate uses `coalesce(posted_at, created_at)`, the ORDER BY must use the same coalesce — otherwise the pipeline drops exactly the rows the predicate meant to include. Also rank-then-cap: when storing a capped list of matches (e.g. alert events), sort by relevance score before the cap, or an exact-title match gets crowded out by arbitrary newer weak matches.
