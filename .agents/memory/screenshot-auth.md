---
name: Screenshots behind login
description: How to capture authenticated app-preview screenshots when the app uses cookie-session auth
---

The screenshot browser is unauthenticated, so pages behind login render the login screen (or 401).

**How to apply:** Add a temporary dev-only GET redirect route (guarded by `NODE_ENV !== "production"`) that creates a session with the existing auth helpers, sets the session cookie, and redirects to `?next=<path>` (validate it startsWith "/"). Screenshot via that URL, then REMOVE the route and restart the server before finishing. Verify removal with a curl expecting 404.

**Why:** Faster and safer than seeding cookies into the screenshot browser (not possible) or weakening auth middleware. Also: adding URL-param initialization to filter/search pages makes states screenshotable and shareable.

Theme/state stored in localStorage is also invisible to the screenshot browser. Add a strict-allowlist URL param override (e.g. `?theme=dark`) to the pre-paint script — it makes both themes screenshotable and shareable without touching persisted state.
