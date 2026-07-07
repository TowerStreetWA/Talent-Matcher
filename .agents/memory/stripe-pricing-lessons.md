---
name: Stripe pricing/currency lessons
description: Durable gotchas from switching a live-tenant Stripe catalog to new tiers/currency
---

- **Rule:** Stripe forbids mixing currencies on one customer — a customer with an active subscription in currency A cannot open a checkout session in currency B (`StripeInvalidRequestError`).
  **Why:** Hit this when repricing from USD to GBP; legacy trial customers 500'd on new-plan checkout until the error was caught and surfaced as a 400 pointing them to the billing portal.
  **How to apply:** When changing catalog currency, keep legacy prices active, filter the plan list to the new currency only, alias legacy plan keys for display, and route existing subscribers through the Stripe portal (not checkout) for plan changes.
- **Rule:** In React components, never name a useState setter `setInterval`/`setTimeout` — it shadows the global timer functions and breaks any timer usage in the same component with confusing overload errors.
