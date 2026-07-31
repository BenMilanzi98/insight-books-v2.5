# Public Landing Page Audit

**Date:** 2026-07-28

## Inventory

| Surface | Classification |
|---------|----------------|
| `app/page.js` + `LandingPageClient.js` `#pricing` | KEEP / EXTEND |
| Dedicated `/pricing`, `/mra-eis`, `/mra-eis/pricing` | GAP — missing |
| Prices | Hardcoded via `PUBLIC_SUBSCRIPTION_PLANS` — **excludes EIS** |
| Feature list on cards | Hardcoded locally in PricingSection — DISCONNECTED from plan.features |
| JSON-LD offers `price: "0"` USD | INCORRECT / STALE vs MWK plans |

## Classification

| Item | Tag |
|------|-----|
| Landing shell / responsive hero | KEEP |
| Pricing section for core plans | KEEP / EXTEND → DB-driven |
| Public EIS plans | INTENTIONAL GAP today; required by master prompt |
| Nav link to `#pricing` | EXTEND (discoverability) |

## Required for program

Database-driven published MRA EIS plans only; hide draft/suspended; CTA preserves selected plan through auth; no false zero for custom/enterprise.
