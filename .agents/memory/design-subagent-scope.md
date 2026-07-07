---
name: Design subagent scope verification
description: Restyle briefs to the DESIGN subagent may be only partially executed — always diff and finish the gaps.
---

A DESIGN subagent given a broad restyle brief (theme tokens + component-level polish across many pages) may complete only the global token swap and report success.

**Why:** During the Obsidian Glow refresh, the subagent changed only `index.css` tokens; match-score glow, conversion-CTA accenting, and dialog polish from the brief were untouched.

**How to apply:** After any design-subagent run, check `git diff --stat` against the brief's scope list. Small remaining items (utility classes, per-component accents) are usually faster to finish directly than to re-delegate. Verify visually with an authenticated e2e pass since the screenshot tool can't log in.
