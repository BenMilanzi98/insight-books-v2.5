### Task 2: Wave 2 — Contact roles + products + commercial + probability + close dates

**Depends on:** Wave 1 CrmOpportunity + Pipeline (WORKING_TREE).

**Files (create / extend):**
- `lib/admin/crm/opportunities/contacts.js` — Opportunity Contact roles (PRIMARY, DECISION_MAKER, ECONOMIC_BUYER, …); history; no platform permission grant
- `lib/admin/crm/opportunities/products.js` — Opportunity Products referencing Phase 9 plan/feature codes where available; quantities; non-binding estimates
- `lib/admin/crm/opportunities/commercial.js` — amount basis, currency (ISO), recurring/one-time summaries, amount history; **never** post Revenue/Subscription
- `lib/admin/crm/opportunities/probability.js` — stage default; manual override + reason + optional approval stub; confidence; history; **not ML**; never label as Revenue certainty
- `lib/admin/crm/opportunities/closeDate.js` — expected close date + source + confidence; history; no silent invent
- Weighted Pipeline helper: `computeIndicativeWeightedAmount` exists but `WEIGHTED_PIPELINE_UI_ENABLED = false` (Phase 16)
- Prisma + SQL `scripts/sql/crm-pipeline-phase12-wave2.sql`
- APIs for roles/products/commercial/probability/close-date on opportunity
- Tests: roles, products, commercial currency, probability override, close-date history, weighted flag off

**Do NOT:** board UI, win/loss close, import/reports, EXPANSION Pipeline, enable weighted UI, Tenant provision.

## Rules

- Currency required for any amount; no silent FX; multi-currency totals stay separated or UNAVAILABLE
- Amount basis required (e.g. FIRST_YEAR_TOTAL, RECURRING_ANNUAL, …)
- Probability 0–100; override needs permission + reason; history immutable
- Close date confidence: CUSTOMER_CONFIRMED | PROCUREMENT_CONFIRMED | INTERNALLY_ESTIMATED | LOW_CONFIDENCE | UNKNOWN — UNKNOWN ≠ forecast date for metrics
- Contact roles Opportunity-specific; one primary Contact where required for stage entry (wire into transition if Wave 1 left hooks)
- Products do not create entitlements/Subscription lines

## Global Constraints

Phase 12 plan. **Do not git commit.** WORKING_TREE. SQL + guards if EPERM.

## Acceptance

- [ ] Non-binding products; amount basis + currency; amount history
- [ ] Stage default probability + override + confidence; not ML
- [ ] Close date source + confidence + history
- [ ] Weighted helper dark (UI flag false)
- [ ] Vitest PASS (+ Wave 1 suites green)
