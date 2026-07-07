---
name: Orval codegen quirks
description: Gotchas when consuming Orval-generated hooks and Zod schemas in this monorepo
---

- Zod **value** exports in the generated zod package are named after operationIds (e.g. `LoginBody`, `GetMeResponse`); OpenAPI component-schema names (e.g. `AuthUser`) are **type-only** exports. Importing a component-schema name as a value causes TS2693.
  - **Why:** Orval derives runtime schema names from operations, not components.
  - **How to apply:** when validating in server routes, import the operationId-named Zod values; use component names only as TS types.
- Generated `useX` query hooks with a custom `query` options object may require `queryKey` explicitly (TS2741) — pass `getXQueryKey()`.
- Avoid naming an OpenAPI component the same as an operation body schema — it caused a TS2308 duplicate-export clash (fixed by renaming the component, e.g. `LoginBody` → `LoginInput`).
