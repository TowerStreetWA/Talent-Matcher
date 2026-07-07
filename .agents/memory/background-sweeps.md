---
name: Background sweep jobs
description: Correctness rules for periodic DB sweep jobs (alerts, digests) in this stack
---

Periodic sweep jobs that emit "new since last run" events must use a bounded window and a cross-instance lock.

**Why:** An unbounded `> lastRunAt` query with `lastRunAt = sweepStart` double-counts rows created mid-sweep, and a process-local `sweeping` flag doesn't help on autoscale (multiple instances). Architect review flagged exactly this on the saved-search alert sweep.

**How to apply:** Capture `windowEnd = now` per item, query `(since, windowEnd]` on `coalesce(postedAt, createdAt)`, persist `lastRunAt = windowEnd`, and wrap the sweep in `db.transaction` + `pg_try_advisory_xact_lock(key)` (skip if not acquired; lock auto-releases at tx end). With the node-postgres drizzle driver, `tx.execute()` returns a QueryResult — read `.rows[0]`, don't destructure the result directly.
