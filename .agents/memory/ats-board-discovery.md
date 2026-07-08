---
name: ATS board token discovery
description: How to find real public ATS board tokens (Workday sites especially) when guessing fails
---

# ATS board token discovery

**Rule:** Don't guess ATS tenant tokens. Guessed tokens usually return 200-with-empty (Workable widget returns `{"jobs":[]}` for wrong/retired accounts; SmartRecruiters returns `totalFound: 0`) — indistinguishable from a real empty board. Instead, run `site:` web searches on the ATS hosting domain (e.g. `site:myworkdayjobs.com underwriter London`) and read the token + site name straight out of live job URLs: `https://{token}.{wdN}.myworkdayjobs.com/{site}/job/...`.

**Why:** A whole probing session of guessed Workday/SmartRecruiters/Lever tokens for UK insurers yielded almost nothing, while one round of `site:` searches surfaced five real tenants (correct instance shard wdN and exact site path segment, which are unguessable — e.g. `Hiscox_External_Site` on wd3, not `External` on wd1).

**How to apply:** When expanding `atsEmployers.ts` (or any ATS-source config), search `site:<ats-domain> <role> <location>` first, extract token/instance/site from result URLs, then verify with one curl (Workday: POST `/wday/cxs/{token}/{site}/jobs` with `{"appliedFacets":{},"limit":1,"offset":0,"searchText":""}`). Treat 200-with-zero-jobs as "wrong token" until proven otherwise.
