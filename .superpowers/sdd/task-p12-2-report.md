# Task P12-2 Report — Wave 2 Contact roles + products + commercial + probability + close dates

**Status:** DONE  
**Commits:** WORKING_TREE (no git commit, per brief)  
**Branch:** in-place workspace  
**Date:** 2026-07-30

## Summary

Implemented Phase 12 Wave 2 on top of Wave 1 CrmOpportunity/Pipeline: Opportunity-specific contact roles (with history; no platform permission grant), non-binding product estimate lines referencing Phase 9 catalogue codes, commercial estimates with required amount basis + ISO currency + amount history (never posts Revenue/Subscription), explainable stage-default probability with manual override + reason + optional approval stub + history (not ML; not Revenue certainty), and expected close date with source + confidence + history (UNKNOWN ≠ forecast-eligible). Weighted helper `computeIndicativeWeightedAmount` exists with `WEIGHTED_PIPELINE_UI_ENABLED = false`.

## Files created

### Library (`lib/admin/crm/opportunities/`)
| File | Role |
|------|------|
| `model.js` | Shared `hasCrmOpportunity*` guards + `serializeOpportunity` (breaks circular imports) |
| `contacts.js` | Roles PRIMARY/CHAMPION/ECONOMIC_BUYER/INFLUENCER/DECISION_MAKER/BLOCKER; seed/list/upsert/history |
| `products.js` | Non-binding catalogue/unknown product lines; quantities; no entitlements |
| `commercial.js` | Amount basis + currency + history; multi-currency summary; weighted helper (UI dark) |
| `probability.js` | Stage default apply; override + reason + confidence + approval stub; history |
| `closeDate.js` | Expected close + source + confidence + history; forecastEligible gate |

### SQL / APIs / tests
| File | Role |
|------|------|
| `scripts/sql/crm-pipeline-phase12-wave2.sql` | ALTER Opportunity + Wave 2 tables + FK `DO $$` |
| `app/api/admin/crm/opportunities/[id]/contacts/route.js` | GET/POST roles (+ `?history=1`) |
| `app/api/admin/crm/opportunities/[id]/products/route.js` | GET/POST products |
| `app/api/admin/crm/opportunities/[id]/commercial/route.js` | GET/POST commercial |
| `app/api/admin/crm/opportunities/[id]/probability/route.js` | GET/POST override |
| `app/api/admin/crm/opportunities/[id]/close-date/route.js` | GET/POST close date |
| `test/systemAdmin.crm.opportunityWave2.test.js` | Roles, products, commercial, probability, close-date, weighted flag |

## Files modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Opportunity commercial/prob/close fields + 6 Wave 2 models + Admin relations |
| `lib/admin/crm/opportunities/index.js` | Wave 2 public exports |
| `lib/admin/crm/opportunities/create.js` | Seed PRIMARY + apply stage default probability |
| `lib/admin/crm/opportunities/get.js` / `list.js` / `leads.js` | Import model helpers |
| `lib/admin/crm/pipeline/transition.js` | PRIMARY entry criterion; apply stage default probability |
| `lib/admin/crm/pipeline/definitions.js` | `primary_contact` entry on open stages after IDENTIFIED |
| `lib/admin/crm/authz.js` | `canOverrideOpportunityProbability` |
| `lib/admin/crm/foundations.js` | Wave 2 foundation contract text |
| `lib/admin/crm/index.js` | Wave 2 exports |
| `test/systemAdmin.crm.opportunities.test.js` | Create asserts stage-default probability + null commercial/close |

## Behaviour delivered

### Contact roles
- Roles attach to Opportunity (not platform User access); `platformPermissionGrant: false` always
- One PRIMARY (replaceable); seeded from handoff `contactId` on create when role model available
- Immutable role history
- Stage entry: open stages after IDENTIFIED require PRIMARY when role model present; EPERM fallback accepts `contactId`

### Products
- Catalogue `featureCode` / `moduleCode` or explicit `unknownInterest`
- Binding always `NON_BINDING_ESTIMATE`; never creates entitlement / Subscription / Invoice lines
- Unit estimate requires ISO currency

### Commercial
- `amount` + `amountBasis` (FIRST_YEAR_TOTAL | RECURRING_ANNUAL | ONE_TIME | TOTAL_CONTRACT) + ISO-4217 `currency` required
- Recurring/one-time summary fields; append-only amount history
- Multi-currency totals stay separated (`grandTotalStatus: UNAVAILABLE`); no silent FX
- Never posts Revenue/Subscription

### Probability
- Stage catalogue defaults applied on create + transition unless `MANUAL_OVERRIDE`
- Override: edit permission + reason required; confidence; optional approval stub
- History immutable; `isMl: false`, `isRevenueCertainty: false`, `isLeadFitScore: false`

### Close dates
- Source + confidence required; history on change; no invent
- Confidence enum includes UNKNOWN; `forecastEligible: false` when UNKNOWN

### Weighted
- `computeIndicativeWeightedAmount` returns indicative only
- `WEIGHTED_PIPELINE_UI_ENABLED = false` (Phase 16)

## Explicitly not implemented (per brief)

- Board / Kanban UI, win/loss close evidence, import/reports
- EXPANSION Pipeline, Tenant provision, weighted UI enablement

## Tests

```text
npx vitest run test/systemAdmin.crm.pipeline.test.js test/systemAdmin.crm.opportunities.test.js test/systemAdmin.crm.leads.test.js test/systemAdmin.crm.opportunityWave2.test.js
→ Test Files  4 passed (4)
→ Tests  45 passed (45)
```

Coverage mapped to acceptance:

1. Non-binding products; amount basis + currency; amount history  
2. Stage default probability + override + confidence; not ML  
3. Close date source + confidence + history  
4. Weighted helper dark (`WEIGHTED_PIPELINE_UI_ENABLED === false`)  
5. Wave 1 pipeline / opportunities / leads suites remain green  

## Self-review

| Check | Result |
|-------|--------|
| Acceptance checklist | Met |
| Distinctness (Lead/Customer/Support/billing/POS) | Preserved |
| No Revenue/Subscription/Invoice post from commercial | Confirmed |
| Weighted UI flag false | Confirmed |
| Prisma EPERM path | SQL + has*Model guards |
| Git commit | None (WORKING_TREE) |

## Concerns / follow-ups

1. **Prisma generate / db push** may still hit Windows EPERM — apply `scripts/sql/crm-pipeline-phase12-wave2.sql` (after Wave 1 SQL) then retry generate; app degrades via model guards until client methods exist.
2. **PRIMARY entry criterion** with role model present is stricter than Wave 1 contactId-only; create seeds PRIMARY when model available.
3. **Probability override** uses `opportunities.edit` (no separate permission key yet).
4. **Board UI / win-loss / weighted reports** remain Wave 3 / Phase 16.

## Acceptance

- [x] Non-binding products; amount basis + currency; amount history
- [x] Stage default probability + override + confidence; not ML
- [x] Close date source + confidence + history
- [x] Weighted helper dark (UI flag false)
- [x] Vitest PASS (+ Wave 1 suites green)
