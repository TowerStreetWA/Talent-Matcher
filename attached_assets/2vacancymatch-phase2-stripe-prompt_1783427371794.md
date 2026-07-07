# VacancyMatch AI - Replit Agent Script for Phase 2 Stripe Billing + 7-Day Trial

## Message for Replit Agent

VacancyMatch AI is now through Phase 1 authentication and that phase is complete and verified.

Current verified state:
- Custom email/password authentication is live.
- Password hashing is implemented using scrypt.
- httpOnly cookie sessions are in place with hashed server-side session tokens.
- `/auth/login`, `/auth/logout`, and `/auth/me` exist and work.
- All data APIs require login and are tenant-scoped.
- Roles are enforced.
- Compliance endpoints are restricted to admin/owner.
- Audit logs record login/logout/failed-login events.
- Existing product functionality still works behind auth.
- Typechecks pass.

Now build **Phase 2: Stripe billing and 7-day trial flow** so VacancyMatch AI can move from a secure SaaS app to a monetisable SaaS app.[cite:50][cite:5][cite:8]

This phase should follow the established product direction:
- self-serve SaaS onboarding
- Stripe Checkout for subscription signup
- 7-day free trial on the Starter plan
- tenant-linked subscription state in the app database
- billing-driven access control after the trial ends.[cite:5][cite:8][cite:54][cite:56]

## Main goal

Implement a production-minded Stripe subscription billing flow for VacancyMatch AI using:
- Stripe Checkout
- Stripe webhooks
- local subscription state in the app DB
- 7-day Starter trial
- billing page in the app
- Stripe Customer Portal for self-serve billing management.[cite:39][cite:58][cite:67][cite:74][cite:77]

## Important design rules

- Keep the current auth and tenant model intact.
- Do not build billing as a detached side-system.
- Billing must be tenant-level, not user-level.
- Stripe should be the payment processor and billing source of truth, but the app must maintain local subscription state for authorization and product gating.
- Do not query Stripe on every request to decide access.
- Use verified webhook events to update local billing/subscription state.[cite:39][cite:62][cite:77][cite:87]

## Commercial model to implement

Use this v1 billing model:

### Starter trial
- New tenant can start on **Starter - 7-day free trial**.[cite:8][cite:74]
- During trial, core product access is available.
- At trial end, require upgrade/payment to continue normal usage.
- Messaging should support the clean SaaS framing already preferred in similar products: “Start your 7-day free trial”, “No card required” if feasible in the chosen implementation, and “Cancel anytime.”[cite:8][cite:55]

### Suggested access logic after trial
Implement one of these clearly in code and UI:
- **Preferred:** read-only or upgrade-gated experience after expiry, rather than deleting access entirely.
- The tenant should still be able to log in and reach billing/upgrade, but premium and mutable actions should be blocked if subscription is not active/trialing.[cite:8][cite:55]

## What to build

### 1. Billing data model

Add or extend the DB schema to support tenant-level billing.

Recommended tables/fields:

#### subscriptions
- id
- tenant_id
- stripe_customer_id
- stripe_subscription_id
- stripe_price_id
- plan_key
- status
- billing_interval
- trial_started_at
- trial_ends_at
- current_period_start
- current_period_end
- cancel_at_period_end
- canceled_at
- ended_at
- last_webhook_event_id
- created_at
- updated_at

#### billing_events or webhook_events
- id
- tenant_id nullable
- stripe_event_id unique
- stripe_event_type
- payload_json
- processed_at
- status
- error_text nullable
- created_at

#### optional tenant fields
If useful, add cached fields on `tenants` such as:
- billing_status
- current_plan
- stripe_customer_id
- trial_ends_at

But keep the normalized subscription table as the real internal billing record.

## 2. Pricing configuration

Implement a plan catalogue in code for v1.

Suggested plans:
- starter
- team
- pro_ai
- enterprise placeholder

At minimum, wire one or two real Stripe recurring prices for testing.

The app should not hardcode raw business logic all over the place. Create a centralized pricing/plan config module.

Example shape:

```ts
export const plans = {
  starter: {
    key: 'starter',
    label: 'Starter',
    monthlyPriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
    trialDays: 7,
    features: ['Core vacancy matching', 'CV parsing', 'Core recruiter workflow'],
  },
  team: {
    key: 'team',
    label: 'Team',
    monthlyPriceId: process.env.STRIPE_PRICE_TEAM_MONTHLY!,
    trialDays: 0,
    features: ['Everything in Starter', 'More users', 'Alerts', 'CRM sync'],
  },
};
```

## 3. Checkout session creation

Add a backend endpoint that creates a Stripe Checkout session for the authenticated tenant.

Requirements:
- tenant must be authenticated
- map tenant to Stripe customer
- create customer if missing
- attach tenant metadata to customer and/or checkout session
- use subscription mode
- use correct price ID
- set trial settings for Starter
- set success URL and cancel URL
- return checkout URL or session info to frontend.[cite:39][cite:74][cite:76]

Suggested endpoints:
- `POST /api/billing/create-checkout-session`
- `POST /api/billing/create-portal-session`
- `GET /api/billing/subscription`
- `POST /api/billing/refresh` optional if useful

## 4. Webhook handler

Implement a proper Stripe webhook endpoint.

Requirements:
- verify Stripe signature
- store raw event metadata
- dedupe on Stripe event ID
- update local subscription state only from verified webhook events
- be idempotent
- fail safely and visibly if processing breaks.[cite:62][cite:77][cite:83][cite:87]

Handle at least these event types:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.paid`
- `invoice.payment_failed`.[cite:77][cite:79][cite:84]

Webhook logic should update local status fields such as:
- `trialing`
- `active`
- `past_due`
- `canceled`
- `incomplete`
- `incomplete_expired`
- `unpaid`
- `expired`

You do not need to mirror every Stripe nuance in the UI, but the app must behave correctly based on meaningful billing states.[cite:75][cite:84]

## 5. Billing access/gating middleware

Add centralized billing guards so the app can decide what a tenant may do based on subscription state.

Suggested product access model:
- `trialing` -> full normal app access
- `active` -> full normal app access
- `past_due` -> warning state, optionally limited grace period
- `canceled` or `expired` -> login allowed, but write actions blocked and upgrade/billing page accessible
- `unpaid` -> similar gated state

At minimum, centralize something like:

```ts
export function canUseCoreProduct(status: string) {
  return status === 'trialing' || status === 'active';
}

export function isBillingRestricted(status: string) {
  return ['canceled', 'expired', 'unpaid', 'incomplete_expired'].includes(status);
}
```

Then apply this consistently in APIs and UI.

## 6. Billing page in the app

Add a Billing page visible to the right roles.

It should show:
- current plan
- billing status
- trial end date if trialing
- next renewal date if active
- CTA to start trial or upgrade
- CTA to manage billing in Stripe Customer Portal
- payment-failure or expired-state messaging if relevant.[cite:58][cite:60][cite:67]

If there is no active subscription yet, the page should make the next action obvious.

## 7. Customer Portal integration

Use Stripe Customer Portal for self-serve account management rather than building everything custom.

Requirements:
- backend endpoint creates a portal session for the tenant’s Stripe customer
- app has a “Manage billing” button
- portal should allow payment method updates and subscription management.

This is explicitly supported by Stripe and is the preferred fast path for early SaaS products.[cite:58][cite:60][cite:67]

## 8. Trial messaging and compliance handling

Stripe documents specific compliance considerations around trial offers and trial ending reminders. Build the app so trial state is visible and users are not surprised.[cite:79]

Minimum requirements:
- clearly show trial end date in the app
- clearly show billing status
- make cancellation/billing management reachable
- if using Stripe emails/portal, configure them properly
- if not, leave clear TODO notes for trial reminder communication

## 9. Audit and observability

Add audit/billing logging for:
- checkout session creation
- portal session creation
- subscription activation
- trial started
- trial ending warning if handled internally
- payment failure
- cancellation
- webhook processing failures

Do not make billing a black box.

## 10. Dev/test support

Make local and staging testing practical.

Include support for:
- Stripe test mode
- env vars for prices and webhook secret
- easy seed/test path for a dev tenant
- if practical, leave notes for using Stripe test clocks to validate trial transitions.[cite:79][cite:85]

## Recommended environment variables

Add only what is needed, but likely something like:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_TEAM_MONTHLY=
STRIPE_PORTAL_CONFIGURATION_ID=
APP_URL=
```

If customer portal config ID is not strictly needed in your integration style, omit it.

## Important implementation details

- Billing belongs to the tenant, not an individual user.
- The first owner/admin is the one who usually triggers checkout, but access state must apply to the whole tenant.
- Use metadata consistently so Stripe customer/subscription objects can be mapped back to tenant IDs.
- Do not grant app access purely because checkout returned success; rely on webhook-confirmed local subscription state.[cite:39][cite:77][cite:87]
- Keep the implementation idempotent.
- Keep centralized JSON error handling.
- Keep typecheck clean.

## Suggested implementation order

1. Inspect current auth/tenant schema and app structure.
2. Add billing/subscription tables and migrations.
3. Add centralized plan config.
4. Add Stripe service wrapper.
5. Add checkout-session endpoint.
6. Add webhook endpoint and persistence.
7. Add local subscription-state sync logic.
8. Add billing status helpers and access guards.
9. Add billing page in UI.
10. Add customer portal session endpoint and button.
11. Add audit/billing events.
12. Run end-to-end tests in Stripe test mode.

## Acceptance criteria

Phase 2 is complete when all of the following are true:

1. An authenticated tenant can start a Stripe Checkout subscription flow.
2. Starter can be created with a 7-day trial.
3. Stripe webhook events update local subscription state reliably.
4. Billing state is stored in the app DB and tied to the correct tenant.
5. The app does not rely only on checkout success redirects for access.
6. Billing page shows current status correctly.
7. Manage billing opens Stripe Customer Portal.
8. Trialing and active tenants can use the app normally.
9. Expired/canceled/unpaid tenants are gated consistently but can still reach billing.
10. Billing/audit events are logged.
11. Typecheck passes.
12. Existing auth and core product functions continue to work.

## Deliverables expected back from Replit Agent

When complete, report back with:
- files changed
- schema changes
- new env vars required
- new billing routes/endpoints
- Stripe objects/config expected in dashboard
- webhook events handled
- billing state model used locally
- gating behavior after trial end
- what was tested in Stripe test mode
- confirmation that typecheck passes

---

## Shorter prompt version

```txt
VacancyMatch AI has completed Phase 1 auth and is now ready for Phase 2 billing.

Build Stripe subscription billing and 7-day trial flow for the existing multi-tenant SaaS app.

Requirements:
- Stripe Checkout for subscription signup
- Tenant-level billing, not user-level
- Starter plan with 7-day free trial
- Local subscription table/state in app DB
- Stripe webhook endpoint with signature verification and idempotent event handling
- Handle at least: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, customer.subscription.trial_will_end, invoice.paid, invoice.payment_failed
- Billing page in app showing plan, status, trial end, renewal date, upgrade/manage billing actions
- Stripe Customer Portal integration
- Centralized access gating based on local billing state
- Trialing/active = full app access
- Expired/canceled/unpaid = login allowed, billing accessible, product actions gated
- Audit/billing logs for key events
- Keep existing auth, tenant scoping, centralized JSON error handling, and typecheck clean

Use the current codebase patterns. First inspect current schema, tenant model, auth model, routing, and audit utilities, then integrate billing natively into the existing architecture.

Return a summary of files changed, schema changes, env vars, routes, webhook events handled, billing state logic, trial gating behavior, test coverage, and confirm typecheck passes.
```
