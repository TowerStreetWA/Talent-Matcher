---
name: Prod SQL silent errors
description: Production read-only SQL queries swallow errors — empty output looks like an empty result set.
---

# Prod SQL silent errors

Rule: read-only queries against the production database return `success: true` with output of just `START TRANSACTION / ROLLBACK` when the query actually errored (bad column name, syntax error). An empty result set and a failed query look identical.

**Why:** repeated mis-diagnoses — queries against `job_sources.source_provider` / `last_synced_at` (real columns: `provider`, `last_sync_at`) silently "returned nothing", which looked like missing data.

**How to apply:** before trusting an empty prod result, verify the table's column names via `information_schema.columns`, or re-run a trivially-true variant of the query (e.g. `count(*)`) to confirm the query shape executes at all.
