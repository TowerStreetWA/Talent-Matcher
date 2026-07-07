---
name: Secrets hygiene
description: Handling user-pasted API keys that contain whitespace or invalid values, and secret-change propagation.
---

Rule: always `.trim()` API keys read from env before using them, and validate the shape early so a bad key surfaces as a clear typed "config" error instead of a confusing upstream 4xx.

**Why:** A user-pasted secret once contained internal spaces (27 chars with 3 spaces — not a valid key at all). The upstream API returned a generic 400 "Invalid Authorization header", which looked like a code bug. Diagnosis technique that worked without exposing the value: print only length / whitespace positions / charset booleans via node, and test the upstream API directly with `curl -u "$KEY:"`.

**How to apply:**
- Wrap key access in a helper that trims and throws a typed config error when empty.
- If an upstream rejects auth, first inspect the secret's shape (length, whitespace) before touching code.
- Secret value changes do NOT propagate to running workflows — restart the workflow after the user updates a secret.
