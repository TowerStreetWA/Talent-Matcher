# Memory Index

- [Orval codegen quirks](orval-codegen-quirks.md) — Zod value exports are named by operationId; component names are type-only, and hooks may need explicit queryKey.
- [Express router mounting](express-router-mounting.md) — `router.use(path, subRouter)` strips the prefix; guard paths with middleware separately when sub-routers use full paths.
- [stripe-replit-sync quirks](stripe-replit-sync-quirks.md) — must be esbuild-external, syncBackfill needs {object:"all"}, connector key is `secret`, pick effective sub by status precedence
