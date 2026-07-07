# VacancyMatch AI - Replit Script + Phase 1 Auth Prompt

## Message for Replit Agent

VacancyMatch AI is now built and verified end to end as a working recruitment SaaS product core.

Current verified functionality:
- CV upload and parsing works.
- Candidate profile extraction works.
- Vacancy auto-matching works.
- Explainable scoring works, including per-factor scoring and plain-English reasons.
- Recruiter actions work, including shortlist, dismiss, and push-to-CRM.
- CRM sync events and audit log entries are being recorded.
- Dashboard KPIs, seeded jobs, source health, alert rules, and compliance/audit trail are in place.
- Multi-step DB writes have been hardened into atomic transactions.
- Centralized API error handling has been added.
- Typechecks pass across all packages.[cite:50]

However, there is currently no authentication or user access control. That means anyone with the URL could view or modify candidate data, recruiter actions, and CRM-linked records. Before this app is made live for real users, authentication must be added first, and Stripe billing should come after authentication rather than before.[cite:50][cite:5][cite:8][cite:51]

This order matters because:
- Candidate CVs and parsed data are sensitive and must not be exposed publicly.
- Multi-tenant SaaS needs tenant-aware access boundaries from day one.
- Billing/trials only make sense once users and tenants can be securely identified.
- The intended product direction is a proper SaaS system with self-serve signup, tenant ownership, and subscription billing.[cite:5][cite:8]

Your task now is to build **Phase 1: Authentication and Access Control** for VacancyMatch AI, in a way that fits a multi-tenant SaaS architecture and is ready for Stripe billing in the next phase.

## Phase 1 goal

Add secure authentication, tenant-aware access control, and the base user-management layer so VacancyMatch AI can move from an internally testable app to a safely publishable SaaS system.

## Implementation rules

- Keep the existing app and functionality intact.
- Do not remove or rewrite the matching engine, scoring logic, CRM actions, audit logging, or dashboards unless required for auth integration.
- Build auth in a way that supports a shared multi-tenant SaaS app.
- Scope all tenant-owned data by tenant ID.
- Protect both frontend routes and backend API routes.
- Return clean JSON errors through the existing centralized error handler.
- Keep typecheck clean.
- Keep changes production-minded, not demo-only.

## Desired auth model

Use a simple but solid v1 model:
- Email/password login.
- Tenant-based users.
- Roles per user.
- Cookie-based server sessions.
- Protected routes and APIs.
- Basic invite-ready team model, even if full invites are not finished in this phase.

### User roles for v1
- owner
- admin
- recruiter
- viewer

### High-level access expectations
- owner: full tenant access including settings and billing placeholder areas.
- admin: operational admin access within tenant.
- recruiter: standard day-to-day recruiter access.
- viewer: read-only access where appropriate.

## What to build in Phase 1

### 1. Database/auth tables

Add or update the core auth tables required for multi-tenant access.

Minimum required tables or fields:
- tenants
- tenant_users
- user_sessions
- password_reset_tokens (if you want to future-proof now)
- audit log support for auth events

If `tenants` and `tenant_users` already exist, extend them rather than duplicating them.

Recommended fields:

#### tenants
- id
- name
- slug
- plan
- status
- created_at

#### tenant_users
- id
- tenant_id
- email
- password_hash
- full_name
- role
- status
- last_login_at
- created_at
- updated_at

#### user_sessions
- id
- tenant_user_id
- session_token_hash or secure session identifier
- expires_at
- created_at
- revoked_at
- ip_address if useful
- user_agent if useful

Use secure hashing for passwords. Use a proper password hash, not plain text, reversible encryption, or weak homegrown logic.

### 2. Session/auth backend

Implement:
- login endpoint
- logout endpoint
- current-session/me endpoint
- auth middleware
- tenant-scoped user resolution
- role-aware authorization helpers

Requirements:
- session cookies should be HttpOnly
- secure cookie settings in production
- same-site protection enabled
- rotate or renew session on login
- invalid sessions should be rejected cleanly
- disabled users should not be allowed in
- tenant mismatch should be blocked

### 3. Frontend auth screens

Add:
- login page
- logged-out redirect behavior
- auth loading state
- unauthorized screen or message

Behavior:
- unauthenticated users trying to access app screens should be redirected to login
- authenticated users should land on the main dashboard
- session expiry should gracefully send users back to login

### 4. Route protection

Protect all sensitive app pages and APIs, especially:
- candidate pages
- CV upload
- match results
- recruiter actions
- CRM push actions
- audit/compliance pages
- job source management
- alerts
- settings/admin pages

### 5. Role-aware permissions

At minimum implement reusable permission helpers so that:
- only owner/admin can access admin settings
- recruiter can perform recruiter workflows
- viewer cannot modify records

This can be lightweight in v1 but should be centralized so it scales later.

### 6. Auth event logging

Add audit log entries for:
- successful login
- failed login
- logout
- role change if implemented
- account disablement if implemented

### 7. Seed/dev support

Add a safe dev seed flow so local development/testing remains easy.

For example:
- one seeded tenant
- one owner user
- one recruiter user
- optional demo password in dev only

Do not make production insecure just to simplify dev setup.

## Important architectural guidance

This app is intended to become a proper SaaS system. Build auth so it naturally supports:
- one shared app
- multiple tenants
- future Stripe subscription gating
- future team invites
- future password reset
- future SSO if ever needed

Do not build auth as a fake single-user layer glued on top. It needs to respect tenant ownership and user roles from now on.[cite:5]

## Stripe note for later

Do not build Stripe in this phase unless there is a tiny placeholder field or hook needed for the auth model.

Stripe is Phase 2, after auth.

When Stripe is added later, it should support:
- self-serve signup
- tenant subscription state
- 7-day trial logic
- active / trialing / past_due / cancelled states
- upgrade gating after trial expiry

That is not the main task right now. The main task now is to secure access first.[cite:8]

## Acceptance criteria

Phase 1 is complete when all of the following are true:

1. Users cannot access app pages or APIs without logging in.
2. Users only see data for their own tenant.
3. Passwords are securely hashed.
4. Sessions are stored and validated securely.
5. Login/logout works end to end.
6. Protected routes redirect or reject correctly.
7. Role-based restrictions work for at least admin vs recruiter vs viewer.
8. Auth events appear in audit logs.
9. Existing core VacancyMatch functionality still works once logged in.
10. Typecheck passes.
11. Existing centralized JSON error handling still works.
12. The app is in a state where Stripe billing can be layered in next.

## Suggested implementation order

1. Review current schema and app structure.
2. Add/extend auth tables and migrations.
3. Add password hashing and login logic.
4. Add session storage and cookie/session middleware.
5. Add `/me` endpoint and frontend auth state.
6. Protect APIs.
7. Protect frontend routes.
8. Add roles and authorization helpers.
9. Add audit logging for auth events.
10. Seed dev users and smoke test.
11. Run full typecheck and regression test the matching flow.

## Specific instruction to Replit Agent

Please inspect the existing codebase first and adapt to the current project conventions rather than creating a disconnected parallel auth system.

Before coding:
- identify the existing backend framework pattern
- identify current DB migration style
- identify current audit log utilities
- identify where tenant_id is already used
- identify current API error handler integration points
- identify current frontend routing and layout pattern

Then implement the auth layer in the most native way possible for this codebase.

## Deliverables expected back

When done, report back with:
- files changed
- schema changes
- new routes/endpoints
- how login/session works
- what pages are now protected
- what roles were implemented
- any TODOs intentionally left for Phase 2 Stripe
- confirmation that typecheck passes
- any publish/runtime env vars needed

---

## Shorter prompt version

If you want a tighter Replit Agent prompt, use this:

```txt
VacancyMatch AI is already working end to end: CV upload, parsing, auto-matching, explainable scoring, recruiter actions, CRM sync events, dashboard KPIs, job source health, alerts, compliance/audit trail, atomic DB transactions, centralized API error handling, and clean typechecks.

But it has no authentication yet. Before this can go live as a SaaS app, add Phase 1 auth first, then Stripe later.

Build secure multi-tenant authentication and access control for the existing app.

Requirements:
- Email/password login
- Tenant-based users
- Roles: owner, admin, recruiter, viewer
- Secure password hashing
- Cookie-based server sessions
- /login, /logout, /me endpoints
- Auth middleware for APIs
- Protected frontend routes
- Tenant-scoped data access
- Role-based authorization helpers
- Audit log entries for login/logout/failed login
- Dev seed users/tenant
- Keep existing app behavior intact once logged in
- Keep centralized JSON error handling
- Keep typecheck clean

Protect all sensitive pages and APIs including candidates, uploads, matches, CRM push, alerts, job sources, audit pages, and settings.

Use the current codebase patterns; do not build a parallel auth system. First inspect current schema, routing, migrations, tenant usage, audit log utilities, and error handling, then integrate auth cleanly into the existing architecture.

Return a summary of files changed, schema changes, routes added, role model, env vars needed, and confirm typecheck passes.
```
