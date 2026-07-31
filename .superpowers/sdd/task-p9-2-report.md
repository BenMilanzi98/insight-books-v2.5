# Task P9-2 Report — Wave 2 First-value / activation / adoption

**Status:** DONE  
**Date:** 2026-07-29  
**Rule versions:** `first-value-2026-07-29` / `repeat-value-2026-07-29` / `activation-2026-07-29` / `adoption-2026-07-29`  
**Commits:** none — commit deferred  

## Summary

Implemented Phase 9 Wave 2 engines for instrumented commerce features only: product usage fact consumer, first-value (unique per tenant+feature+ruleVersion), repeat-value (distinct source required), activation (first value required; entitlement/login never activate), adoption state machine with append-only history, and minimal evaluate/first-value/adoption APIs.

## TDD evidence

### RED (failing tests first)

1. Created `test/systemAdmin.productAnalytics.adoption.test.js` before implementation.
2. Ran `npx vitest run test/systemAdmin.productAnalytics.adoption.test.js`:
   - **FAIL** — exports missing (`recordOrLoadFirstValue` / `evaluateAdoptionState` / … not functions); 10 failed.
3. Required behaviours encoded up front:
   - first value unique per tenant+feature+ruleVersion
   - uninstrumented → `NOT_INSTRUMENTED` (never fake `CONSISTENTLY_ACTIVE`)
   - entitlement alone ≠ first value / adoption advance
   - repeat value needs distinct source from first value
   - commerce fact consumer idempotent; login skipped

### GREEN

1. Implemented facts / firstValue / repeatValue / activation / adoption + schema + APIs + consumer wiring.
2. Final run: **`npx vitest run test/systemAdmin.productAnalytics.adoption.test.js` → 10 passed (10)**.
3. Related: catalogue + producers + analyticsConsumers → **34 passed (34)**.

## Files created / modified

### Created — productAnalytics engines

- `lib/admin/productAnalytics/facts.js`
- `lib/admin/productAnalytics/firstValue.js`
- `lib/admin/productAnalytics/repeatValue.js`
- `lib/admin/productAnalytics/activation.js`
- `lib/admin/productAnalytics/adoption.js`

### Created — APIs

- `app/api/admin/intelligence/product-analytics/evaluate/route.js`
- `app/api/admin/intelligence/product-analytics/first-value/route.js`
- `app/api/admin/intelligence/product-analytics/adoption/route.js`

### Created — schema / SQL / tests

- Prisma models: `AnalyticsFactProductUsage`, `ProductFirstValueFact`, `ProductAdoptionStateHistory`
- `scripts/sql/product-analytics-phase09-wave2.sql`
- `test/systemAdmin.productAnalytics.adoption.test.js`

### Modified

- `lib/admin/productAnalytics/index.js` — re-exports Wave 2 modules
- `lib/admin/analytics/consumers.js` — `consumeProductUsageFacts` in `runFactConsumers`
- `prisma/schema.prisma` — Wave 2 tables

## Interfaces delivered

| Function | Behaviour |
|----------|-----------|
| `recordOrLoadFirstValue` | Unique per tenant+feature+ruleVersion; strict value events only |
| `evaluateRepeatValue` | Requires first value + ≥2 distinct sourceIds |
| `evaluateActivation` | Feature/module/customer/user/eis; first value required |
| `evaluateAdoptionState` | ADOPTION_MATRIX states; append history on change |
| `consumeProductUsageFacts` | Idempotent facts for 3 commerce event codes |

## Self-review

- [x] First value from AnalyticsEvent/facts only (strict events)
- [x] Retries/reprints already excluded at producers
- [x] Page views/login never advance past discovery / never first value
- [x] Historical adoption states append-only (no silent overwrite)
- [x] Definition/rule version strings required
- [x] Uninstrumented → `NOT_INSTRUMENTED` / `UNKNOWN` — never fake `CONSISTENTLY_ACTIVE`
- [x] Entitlement ≠ value / adoption advance to FIRST_VALUE
- [x] Vitest PASS
- [x] No git commit

## Concerns / follow-ups

1. Apply `scripts/sql/product-analytics-phase09-wave2.sql` (or prisma migrate) before live evaluate APIs hit DB.
2. Discovery/config events still uninstrumented — entitled tenants without value stay `AVAILABLE_NOT_DISCOVERED`.
3. `CONSISTENTLY_ACTIVE` requires repeat value + ≥3 distinct sources + cadence window — conservative by design.
4. UI / funnels deferred to Tasks 3–4.

---

## Review remediation (2026-07-29) — Critical / Important from task-p9-2-review.md

**Status:** FIXED (no git commit)

### Fixes

1. **CRITICAL — live first-value pipeline:** `consumeProductUsageFacts` now creates/loads usage facts, then calls `recordOrLoadFirstValue` (dynamic import) so the AnalyticsEvent → fact → first-value path advances without admin POST. Re-consume also heals missing first-value rows.
2. **IMPORTANT — strict source verification:** `recordOrLoadFirstValue` rejects synthetic caller payloads unless a matching `AnalyticsEvent` (by id or idempotencyKey) and/or `AnalyticsFactProductUsage` row exists for tenant/feature/eventType/sourceId.
3. **IMPORTANT — adoption GET read-only:** `GET .../adoption` persists only when `?persist=1|true`. `POST` persists only when `body.persist` is explicitly `true` / `1` / `'1'`.
4. **E2E vitest:** Added consume → first value → `FIRST_VALUE_ACHIEVED` without pre-seeded `firstValues`; plus synthetic-source rejection test. Existing uniqueness tests seed usage-fact evidence.

### Verification

```
npx vitest run test/systemAdmin.productAnalytics.adoption.test.js \
  test/systemAdmin.productAnalytics.producers.test.js \
  test/systemAdmin.productAnalytics.catalogue.test.js
→ 34 passed (34)
```

Adoption suite alone: **12 passed** (was 10).

### Files touched in remediation

- `lib/admin/productAnalytics/facts.js`
- `lib/admin/productAnalytics/firstValue.js`
- `app/api/admin/intelligence/product-analytics/adoption/route.js`
- `test/systemAdmin.productAnalytics.adoption.test.js`
- `.superpowers/sdd/task-p9-2-report.md` (this append)
