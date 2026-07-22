---
name: Orval TS2308 barrel conflict
description: How Orval's operationId-based body naming causes TS2308 in api-zod barrel exports, and how to avoid it.
---

## The rule

Never name an OpenAPI component schema `{OperationId}Body` (e.g. `createSpecList` → `CreateSpecListBody`).

## Why

Orval generates two things for request bodies:
1. A **zod const** in `generated/api.ts` auto-named `{OperationId}Body` from the operationId.
2. A **TypeScript interface** in `generated/types/` for every named component schema.

When a component schema is named exactly `{OperationId}Body`, both the zod const (value) and the TypeScript interface (type) share the same identifier. TypeScript's `export *` in the barrel (`lib/api-zod/src/index.ts`) then fires **TS2308** — "Module has already exported a member named X."

Switching the barrel to `export type * from "./generated/types"` does NOT fix it in TS 5.9 — TS2308 triggers regardless of type vs value namespace.

## How to apply

Name component schemas used as request bodies with a different suffix:
- ✅ `SpecListCreateInput`, `SpecListItemAddInput`, `SpecListItemUpdateInput`
- ❌ `CreateSpecListBody`, `AddSpecListItemBody`, `UpdateSpecListItemBody`

The auto-generated zod const names (`CreateSpecListBody` etc.) are still emitted from the operationId and remain importable from `@workspace/api-zod` — no route code changes needed.

Response schemas (`SpecList`, `SpecListDetail`, etc.) are fine with any name because Orval does NOT generate a separate zod const for them in api.ts.
