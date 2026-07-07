---
name: stripe-replit-sync quirks
description: Non-obvious failure modes of the stripe-replit-sync package and Replit Stripe connector
---

- **Bundling breaks migrations silently.** `runMigrations()` resolves its SQL migrations directory relative to its own `__dirname`. If the package is bundled (esbuild), the dir doesn't exist and it logs "not found, skipping" only through an optional logger — so with no logger passed it silently creates zero tables, and later calls fail with `relation "stripe.accounts" does not exist`.
  **How to apply:** always add `stripe-replit-sync` to the esbuild `external` list for any bundled server.
- **`syncBackfill()` with no args syncs nothing.** The default `object` param is a broken function reference that matches no switch case; it still resolves "complete". Call `syncBackfill({ object: "all" })`.
- **Connector settings shape:** the Replit Stripe connector exposes `settings.secret` and `settings.publishable` (not `secret_key`). No `webhook_secret` is present; the managed webhook flow stores its own secret in `stripe._managed_webhooks` and signature verification still works.
- **Effective-subscription selection:** a customer can have an older active sub plus a newer incomplete/abandoned one. Selecting `ORDER BY created DESC` picks the wrong one and can wrongly lock out a paying tenant — order by status precedence (active > trialing > past_due > rest), then created DESC.
