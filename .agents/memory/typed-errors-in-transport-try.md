---
name: Typed errors inside transport try blocks
description: Config/validation errors thrown inside a fetch try/catch get remapped to generic upstream errors
---

Rule: never call config validation (missing API key, bad settings) inside the same `try` block that wraps a network `fetch` and maps failures to a generic "upstream/unreachable" error — the typed config error gets caught and re-thrown with the wrong kind.

**Why:** A provider's missing-API-key check ran inside the fetch `try` while building the Authorization header; the catch remapped its `config` error to `upstream`, breaking error-kind assertions and hiding the real cause from operators.

**How to apply:** Hoist credential/config resolution to the top of the public entrypoint (before any transport code), and keep transport try/catch blocks limited to the actual I/O call.
