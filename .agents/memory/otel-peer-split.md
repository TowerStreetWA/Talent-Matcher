---
name: OpenTelemetry peer split with drizzle-orm
description: Adding @sentry/node (or anything pulling @opentelemetry/api) breaks drizzle-orm types and the api-server bundle unless peers/externals are aligned.
---

Two failure modes appear when a package that depends on `@opentelemetry/api` (e.g. `@sentry/node`) is added to a workspace package that also uses drizzle-orm:

1. **Type split:** pnpm resolves drizzle-orm twice (with and without the optional `@opentelemetry/api` peer), producing two incompatible type identities (`SQL<unknown>` mismatch, "separate declarations of private property"). Fix: add `@opentelemetry/api` as a dependency of every workspace package that depends on drizzle-orm (lib/db and api-server), so both resolve the same peer set.
2. **Runtime ERR_MODULE_NOT_FOUND:** api-server's esbuild config externalizes `@opentelemetry/*`; pnpm's strict node_modules cannot resolve transitive externals at runtime. Fix: find which external imports remain in the built bundle and add each as a direct dependency of the server package.

Related: ESM import hoisting means "call init() at the top of the entrypoint" does NOT run before statically imported modules — Sentry-style SDKs need a bootstrap entry that inits first, then dynamically imports the rest (esbuild preserves lazy semantics without splitting).

**Why:** Optional peers change package identity in pnpm; externals bypass bundling but not resolution.

The same peer-split hits `openai` too: importing the `openai` package directly in api-server created a second identity (`openai@x_ws@…` vs `openai@x_zod@…`), which both failed typecheck and would have broken `instanceof OpenAI.APIError` for errors thrown by the integration lib's client. Fix: never add `openai` as a direct dep of api-server — the integration lib exports `createDirectOpenAIClient()` and the `OpenAI` class so all consumers share one identity.
**How to apply:** Whenever adding SDKs with otel deps (Sentry, dd-trace, etc.) to this repo, expect both issues; verify with full typecheck AND an actual workflow restart (build+run), not just typecheck.
