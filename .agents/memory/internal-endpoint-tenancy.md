---
name: Internal endpoint tenancy
description: Admin-gated "internal" API routes are reachable by any tenant's admin, not just platform operators
---

The `/internal/*` routes in this app are gated by role (admin+) only — every tenant has admins, so these are NOT operator-only endpoints.

**Why:** A manual sweep endpoint that called a global (unscoped) mutation let any tenant admin mutate other tenants' rows — flagged as a cross-tenant access-control violation in review.

**How to apply:** Any HTTP-triggered mutation must be scoped with `tenantOf(req)`, even on "internal" routes. Global (all-tenant) operations belong only in server-side schedulers/boot code, never behind a tenant-reachable route.
