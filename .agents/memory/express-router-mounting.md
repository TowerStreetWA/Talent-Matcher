---
name: Express router path-prefixed mounting
description: Why mounting a sub-router with router.use(path, subRouter) breaks full-path routes
---

- `router.use("/some-path", subRouter)` strips the matched prefix from `req.url` before the sub-router runs. If the sub-router defines routes with the full path (e.g. `router.get("/audit-logs", ...)`), they will 404.
  - **Why:** Express rewrites the URL for mounted routers; this repo's route files define full paths internally.
  - **How to apply:** to guard specific paths with middleware, split it: `router.use(["/a","/b"], guardMiddleware)` then `router.use(subRouter)` (no path on the mount).
