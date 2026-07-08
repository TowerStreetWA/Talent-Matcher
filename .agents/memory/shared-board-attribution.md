---
name: Shared careers-board attribution
description: Why an ingestion source can show "N fetched" but 0 stored jobs — first-provider-wins by sourceUrl across shared employer boards.
---

# Shared careers-board attribution

Rule: ingestion is idempotent by exact `sourceUrl`; the first source to store a job owns it forever. Employers that share a group-wide careers board (subsidiary → parent-group ATS) will fetch jobs that already belong to another source, producing "fetched N, stored 0" runs.

**Why:** London-market example — DUAL Group's careers page resolves to the Howden/Hyperion group Workday board (already owned by the broker segment), Markel International shares Markel Syndicate's board, Hiscox coverholder shares `ats_workday`. The MGA segment showed 0 jobs in prod despite "40 fetched", which looked like a bug but was correct dedupe.

**How to apply:** when a source shows fetches but no jobs, first check whether its employers' resolved boards are owned by another provider (`SELECT source_provider FROM jobs WHERE source_url ILIKE '%<board-host>%'`). The persisted per-source funnel (`last_new_count`, `last_refreshed_count`) now surfaces this in the Sources UI ("already tracked"). Also note the sweep's cross-segment shared-board dedupe removes such employers from scheduled batches entirely — manual segment-scoped runs do include them.
