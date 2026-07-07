---
name: Connector credential quirks
description: Non-obvious shapes of user-entered connector settings (Sentry, Stripe, Resend) in this project.
---

- **Sentry:** the user pasted a DSN into the connection form: `settings.hostname` is the literal string `"SENTRY_DSN"` and `settings.api_key` holds the DSN itself. The connector proxy therefore fails ("fetch failed"); do not use it. The DSN was copied into `SENTRY_DSN` / `VITE_SENTRY_DSN` shared env vars — use those. A DSN is a publishable client key, safe in env vars and frontend bundles.
- **Resend:** account is in sandbox mode — emails deliver only to the account owner's address until a domain is verified at resend.com/domains. The email wrapper logs the 403 gracefully; this is expected, not a bug.
- **Stripe:** settings keys are `secret` / `publishable` (not `secret_key`).

**Why:** connection forms are user-filled; field names don't guarantee field contents. Always inspect `Object.keys(settings)` and validate the value format before wiring integrations.
**How to apply:** when a connector proxy call fails oddly, check whether the stored settings are actually what the schema claims.
