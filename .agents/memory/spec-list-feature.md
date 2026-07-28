---
name: Create Spec List feature
description: Job-centric spec list system with Apollo.io contact enrichment — tables, routes, frontend page.
---

## What was built

4 new DB tables:
- `job_spec_folders` — team/personal folders per tenant
- `job_spec_folder_items` — jobs added to a folder (with note, status, sortOrder)
- `job_spec_contacts` — contacts per folder item (name, title, email, phone, LinkedIn, contactType, source, confidence)
- `job_spec_search_config` — per-sector or per-title-keyword Apollo title config

Backend: `artifacts/api-server/src/routes/specFolders.ts` — all CRUD routes + async enrichment.

Apollo service: `artifacts/api-server/src/lib/apolloEnrichment.ts`
- Uses `APOLLO_API_KEY` env var (no-ops with a warning if missing)
- POST https://api.apollo.io/api/v1/mixed_people/search
- Enriches on item add (fire-and-forget) and on explicit re-run

Frontend:
- `artifacts/vacancymatch/src/pages/spec-list.tsx` — full spec list page (tab: Team/My Lists/Settings)
- `artifacts/vacancymatch/src/components/send-to-spec-list-dialog.tsx` — reusable dialog
- "Spec list" button added to job-search.tsx and matches.tsx job/match cards

## Key patterns / pitfalls

- `auditActor(req)` returns `{ actorName, tenantId }` — must spread `...actor` into `recordAudit({})`, NOT pass as `actorName: actor`
- `ensureTeamFolder()` auto-creates the default team folder when listing — idempotent
- `useListSpecFolderItems` requires a folderId; only mount FolderPanel when effectiveFolderId is non-null
- Apollo enrichment fires fire-and-forget on item add; UI shows "no contacts yet" message while it runs

## Outstanding
- `APOLLO_API_KEY` secret not yet set — user needs to add it for enrichment to actually fetch contacts
