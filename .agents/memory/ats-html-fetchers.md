---
name: ATS HTML fetcher quirks
description: Lessons from scraping server-rendered ATS portals (iCIMS, SuccessFactors RMK) from Node.
---

# ATS HTML fetcher quirks

## iCIMS rejects Chrome-claiming UAs from Node (HTTP 405)
iCIMS portals fingerprint the TLS client against the claimed browser: any `Chrome/...` user-agent sent from Node/undici gets HTTP 405 (curl with the same headers gets 200, which makes it look header-unrelated). A Firefox UA passes.
**Why:** WAF-style JA3/UA consistency check — the block is on the UA/TLS mismatch, not the method or encoding.
**How to apply:** when a scraper 405s/403s in Node but works in curl, test UA variants from Node itself (curl results don't transfer); prefer a Firefox UA and pin `accept-encoding` explicitly.

## Parse portal HTML per-card, not anchor-to-anchor
iCIMS renders each posting as `<li class="iCIMS_JobCardItem">` with the "Job Locations" label + value BEFORE the title anchor. Chunking "between anchor i and anchor i+1" silently attaches metadata to the wrong job (or none), and a location filter then drops every row with zero warnings.
**How to apply:** split on the card container element and extract all fields within one card; verify field order against a saved real page before trusting a filter's 0-result.

## Global ATS boards + location filters need a search bias
SuccessFactors RMK sites like jobs.sap.com sort newest-first worldwide; the first N pages can contain zero UK rows, so a locationIncludes filter legitimately yields 0 fetched with no error. Fix: bias the fetch with the site's full-text `q=` param (config `searchQuery`) rather than paging deeper.
**How to apply:** whenever a fetcher pages a global board and filters locally, confirm the unfiltered pages actually contain matching rows; if not, push the filter upstream via a query param.
