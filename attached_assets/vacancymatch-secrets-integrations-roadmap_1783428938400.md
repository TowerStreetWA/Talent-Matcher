# VacancyMatch AI - Replit Agent Prompt for Secrets, Integrations, and API Roadmap

## Message for Replit Agent

VacancyMatch AI is now a real SaaS product in progress, not just a prototype. The app already has working authentication, CV upload, AI parsing, auto-matching, and candidate score matching. Billing is being added as the next core SaaS layer.

I now want a structured review and implementation plan for the app's available secrets, current integrations, and recommended additional services so the product becomes commercially stronger, more operationally complete, and more SaaS-ready.

This should be handled as a practical architecture and implementation task, not a generic feature brainstorm.

## Important context

Current product direction:
- multi-tenant SaaS
- recruitment workflow product
- upload a candidate CV
- parse and structure candidate data
- scan or ingest vacancies
- match candidate to relevant open jobs
- present ranked matches to recruiters
- support alerts, CRM sync, and recruiter workflows later

Current known app state:
- auth is complete
- tenant model exists
- Phase 2 Stripe billing is underway or next
- the product should be built as a proper sellable SaaS, not a one-off internal tool

## What I want you to do

Carry out a structured **secrets and integrations roadmap** for the existing VacancyMatch AI codebase.

Your output should:
1. review what secrets are already present
2. identify which are already being used and where
3. identify which are not yet used but are valuable for this app
4. recommend which to implement now vs later
5. recommend any additional API/services worth adding
6. propose a phased implementation plan
7. if appropriate, wire in the highest-value missing integrations now

Do not add random integrations just because a key exists. Prioritize commercial value, product fit, maintainability, and speed to production.

## Available secrets to consider

The environment currently includes or may include these categories of secrets and integrations:

### Core SaaS / platform
- SESSION_SECRET
- STRIPE_SECRET_KEY
- object storage config
- SENTRY_DSN
- VITE_SENTRY_DSN

### AI / model providers
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- PERPLEXITY_API_KEY
- TAVILY_API_KEY

### Search / extraction / intelligence
- GOOGLE_CSE_API_KEY
- GOOGLE_CSE_CX
- SERP_API_KEY
- SERPAPI_API_KEY
- SERPAPI_KEY
- Firecrawl or Jina-like integrations may be added if not already present

### Enrichment / people / company data
- APOLLO_API_KEY
- HUNTER_API_KEY
- PDL_API_KEY
- COMPANIES_HOUSE_API_KEY
- FCA / FSA-style regulatory keys if present

### Messaging / workflow
- RESEND_API_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- GMAIL_APP_PASSWORD
- GOOGLE_OAUTH_CLIENT_SECRET

### Other optional media / non-core tools
- ELEVENLABS_API_KEY
- FAL_API_KEY
- JSON2VIDEO_API_KEY

## Primary question to answer

For VacancyMatch AI specifically, which integrations belong in:
- **must use now**
- **high value next phase**
- **nice to have later**
- **not worth adding to this app right now**

## Recommended evaluation lens

Please evaluate each integration against:
- fit for a recruitment SaaS
- fit for candidate-to-job matching workflows
- value for recruiters using the platform daily
- value for onboarding/conversion/retention
- operational value for debugging and support
- complexity of implementation
- likely noise versus real product leverage

## My own current thinking

I believe the likely strongest immediate integrations are:
- Stripe for billing
- object storage for CV/document storage
- one main LLM provider for parsing and match explanations
- Sentry for monitoring
- Resend for transactional email and alerts
- PostHog for product analytics and funnels
- Cloudflare Turnstile for spam/bot protection

I believe likely strong next-wave integrations are:
- Perplexity or Tavily for grounded research
- Companies House for UK employer enrichment
- Apollo or PDL for enrichment
- Map/geocoding if location matching becomes important
- Firecrawl/Jina-style extraction if market/job-source scraping becomes more advanced

I believe likely later-stage integrations are:
- WorkOS for SSO/SCIM once enterprise accounts matter
- Unkey if this product exposes its own API
- Twilio if SMS alerts become a serious workflow feature

Please use this as context, but inspect the actual app before deciding what to wire.

## What I want implemented now if straightforward

If the app does not yet have them, and if they can be added cleanly without destabilising the product, prioritize:

### 1. Sentry
Implement production-grade server and client error tracking if not already wired.

Minimum requirements:
- server-side Sentry setup
- client-side Sentry setup
- environment-sensitive init
- error boundary or capture strategy
- useful context such as tenant ID, user ID, route, and request ID where possible
- avoid leaking sensitive candidate data

### 2. PostHog
If not already installed, add product analytics and event tracking.

Minimum events to track:
- signup started
- signup completed
- login
- cv upload started
- cv upload completed
- cv parse succeeded
- cv parse failed
- matching run started
- matching run completed
- recruiter opened match details
- recruiter saved match
- billing page viewed
- checkout started
- checkout completed
- trial started
- subscription activated

Also include a small core event naming strategy and identify calls for:
- funnels
- feature adoption
- drop-off analysis
- trial-to-paid conversion

### 3. Cloudflare Turnstile
If public forms exist or are about to exist, protect:
- signup
- login if appropriate
- password reset
- public lead/demo forms
- public upload or invite endpoints if any

Make sure validation is enforced server-side, not only in the client.

### 4. Object storage review
Confirm uploaded CVs and related artifacts are being stored in the correct way for a SaaS app.

Review:
- whether files are currently on local disk or object storage
- tenant isolation approach
- private vs public storage handling
- signed URL or proxy approach if needed
- naming conventions and cleanup lifecycle

## Additional services to recommend

As part of the review, recommend whether the app should add:
- PostHog
- Cloudflare Turnstile
- Firecrawl or Jina Reader
- Mapbox or geocoding
- WorkOS
- Unkey
- Resend if not already in use
- Perplexity or Tavily if grounded research is product-relevant

If recommending one, explain:
- why it helps this specific app
- whether it belongs now or later
- what secret/env vars would be needed
- what user-visible feature or operational benefit it unlocks

## Important implementation principles

- Keep the app multi-tenant aware.
- Any integration that stores, logs, or exports data must avoid cross-tenant leakage.
- Do not log raw CVs, sensitive personal data, or full secrets.
- Prefer centralized service wrappers instead of provider calls scattered throughout the app.
- Prefer one primary provider and one optional fallback rather than integrating three overlapping tools doing the same job.
- Avoid overengineering.
- Preserve type safety and existing code patterns.

## Suggested categorization output

I want a final recommendation table in this format:

| Integration | Already present? | Already used? | Category | Why it matters | Recommendation |
|---|---:|---:|---|---|---|
| Stripe | Yes | Yes/No | must use now | billing and SaaS monetization | wire/keep |

Use these categories:
- must use now
- high value next phase
- nice later
- skip for now

## Suggested build order

Please propose a real implementation order such as:
1. Stripe
2. object storage hardening
3. Sentry
4. Resend
5. PostHog
6. Turnstile
7. AI provider cleanup
8. research/enrichment layer
9. maps/geocoding
10. enterprise extras

But tailor this to the actual state of the codebase.

## Specific tasks to perform

1. Inspect current env usage across the codebase.
2. Produce a list of which secrets are referenced in code.
3. Produce a list of which secrets appear unused.
4. Flag duplicate/overlapping providers.
5. Flag risky or unnecessary integrations.
6. Recommend a cleaned-up env naming strategy if needed.
7. If safe and reasonably quick, implement the highest-value missing integrations from this list:
   - Sentry
   - PostHog
   - Turnstile
   - object storage hardening
8. Add concise docs to the repo explaining the integration stack.

## Deliverables expected back

When finished, return:
- files reviewed
- files changed
- secrets currently referenced
- secrets currently unused
- duplicated or overlapping providers
- recommendation matrix
- additional API/services recommended
- implementation order
- any integrations wired immediately
- env vars added or renamed
- any migration or dashboard setup steps still required
- confirmation that typecheck passes

## Short copy-paste version

```txt
Please audit VacancyMatch AI for secrets and integrations and turn it into a structured roadmap plus implementation pass.

Tasks:
- inspect current env usage in the codebase
- identify which secrets are already referenced
- identify which are unused
- decide which integrations belong in: must use now / high value next phase / nice later / skip for now
- recommend any missing APIs/services worth adding for this recruitment SaaS
- prioritize commercial value, SaaS readiness, product analytics, observability, and low-friction onboarding

Immediate priorities if not already present and if safe to add:
- Sentry
- PostHog
- Cloudflare Turnstile
- object storage hardening/review

Context:
VacancyMatch AI is a multi-tenant recruitment SaaS with auth complete, CV upload, AI parsing, auto-matching, and candidate scoring. Stripe billing is being added next. The app should become a proper sellable SaaS product.

Deliver:
- secrets referenced vs unused
- duplicate providers
- recommendation matrix
- phased implementation plan
- any quick wins wired into the app now
- env vars needed
- dashboard setup steps remaining
- typecheck result
```
