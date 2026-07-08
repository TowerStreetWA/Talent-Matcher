---
name: SSRF guards for server-side URL fetches
description: Any server-side fetch of a config- or admin-supplied URL needs SSRF validation on the initial URL AND every redirect hop.
---

# SSRF guards for server-side fetches

Rule: whenever server code fetches a URL that originates from config files or API input (even admin-only endpoints), validate it with the shared public-URL validator (`validateResearchUrl` in the api-server firecrawl lib), and follow redirects **manually** (`redirect: "manual"`, bounded hops) re-validating each Location target.

**Why:** `redirect: "follow"` silently bypasses any up-front URL validation — a public URL can 302 into localhost, private ranges, or cloud metadata (169.254.169.254). An architect review blocked release of the careers-directory resolver for exactly this. Multi-tenant self-serve signup means "admin-only" endpoints are reachable by any tenant's owner, so admin-supplied URLs are still untrusted.

**How to apply:** reuse the existing validator instead of writing a new one; return a distinct non-throwing outcome (e.g. `blocked_url`) so batch endpoints report per-record instead of failing whole requests. Add tests proving blocked URLs never reach `fetch` (spy call counts) and that redirect-to-private is stopped after exactly one fetch. Known accepted residual: DNS rebinding (hostname → private IP) is not covered by hostname-level validation.
