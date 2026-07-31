# Task P12-2 Review — Wave 2 roles / products / commercial / probability / close dates

**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p12-2-review-package.diff`  
**Brief / report:** `task-p12-2-brief.md` / `task-p12-2-report.md`  
**Mode:** Read-only (spec + quality)  
**Date:** 2026-07-30  
**Vitest (re-run):** `pipeline` + `opportunities` + `leads` + `opportunityWave2` — **45/45 passed**

---

### Spec Compliance

- ✅ **Contact roles** — Opportunity-scoped PRIMARY / CHAMPION / ECONOMIC_BUYER / INFLUENCER / DECISION_MAKER / BLOCKER; history; `platformPermissionGrant: false` always; seed PRIMARY from handoff `contactId`; stage entry `primary_contact` wired in `transition.js` (role model) with `contactId` EPERM fallback.
- ✅ **Products non-binding** — API hardcodes `NON_BINDING_ESTIMATE`; serialize + responses force `createsEntitlement` / `createsSubscriptionLine` / `createsInvoiceLine` false; catalogue feature/module or `unknownInterest`; no Subscription/Invoice/entitlement side effects.
- ✅ **Commercial currency + basis** — `amount` + `amountBasis` (FIRST_YEAR_TOTAL | RECURRING_ANNUAL | ONE_TIME | TOTAL_CONTRACT) + ISO-4217 `currency` required; amount history append; recurring/one-time fields; multi-currency `summarizeAmountsByCurrency` → separated map / `grandTotalStatus: UNAVAILABLE`; `postsRevenue` / `postsSubscription` / `fxConverted` false.
- ✅ **Probability not ML** — stage defaults on create + transition; MANUAL_OVERRIDE preserves across stage moves; override requires `canOverrideOpportunityProbability` + reason + confidence; history with `isMl: false`, `isRevenueCertainty: false`, `isLeadFitScore: false`.
- ✅ **Close-date provenance** — source + confidence required; history on change; `invented: false`; confidence enum includes UNKNOWN; `isCloseDateForecastEligible` excludes UNKNOWN only.
- ✅ **Weighted UI dark** — `computeIndicativeWeightedAmount` exists; `WEIGHTED_PIPELINE_UI_ENABLED = false`; commercial GET/POST echo flag; tested.
- ✅ **Prisma + SQL EPERM path** — Wave 2 models/columns + `scripts/sql/crm-pipeline-phase12-wave2.sql` with FK `DO $$`; `hasCrmOpportunity*Model` guards.
- ✅ **Deferred correctly** — no board UI, win/loss close, import/reports, EXPANSION Pipeline, Tenant provision, weighted UI enablement.
- ✅ **No git commit** — WORKING_TREE per brief/report.
- ⚠️ **Package incomplete / polluted** — review package duplicates several Wave 2 libs (unix + Windows path hunks) and presents Wave 1 files (`create.js`, `get.js`, `leads.js`, …) as full `new file` dumps; omits hunks for `prisma/schema.prisma`, API routes, `authz.js`, `transition.js`, `definitions.js`, `foundations.js`, `lib/admin/crm/index.js` (present on WORKING_TREE; verified there).

---

### Acceptance / verify checklist

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Non-binding products | ✅ | `products.js` binding hardcode + honesty flags; route ignores client `binding`; Wave 2 product tests |
| Currency + amount basis | ✅ | `setOpportunityCommercial` rejects missing currency/basis; amount history; multi-currency UNAVAILABLE |
| Probability not ML | ✅ | Override + stage default; `isMl` / `isRevenueCertainty` false; override without reason blocked |
| Close-date provenance | ✅ | Source + confidence required; history; UNKNOWN → `forecastEligible: false` |
| Weighted UI false | ✅ | `WEIGHTED_PIPELINE_UI_ENABLED === false` in lib + commercial API + test |
| Vitest PASS (+ Wave 1) | ✅ | Re-run **45/45** |

**Global constraints:** Opportunity commercial ≠ Revenue/Subscription post; products ≠ entitlements; probability explainable not ML; close date not silently invented; weighted UI off — met for Wave 2.

---

### Strengths

- Clear module split (`contacts` / `products` / `commercial` / `probability` / `closeDate` + shared `model.js`) matching brief file list.
- Honesty flags are consistent across serialize, API JSON, and history rows (`isMl`, `postsRevenue`, `binding`, `forecastEligible`, `weightedUiEnabled`).
- PRIMARY entry criterion + create seed + override-preserving stage probability integrate Wave 2 into Wave 1 transition/create without enabling board/weighted UI.
- Tests map directly to acceptance (roles, non-binding products, currency/basis/history, probability override/ML flags, close-date UNKNOWN, weighted flag).

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None for acceptance / the five verify items._

#### Minor (Nice to Have)

1. **No DB unique for single PRIMARY** — schema/SQL unique is `(opportunityId, contactId, role)`; app replace logic enforces one PRIMARY on the happy path, but concurrent PRIMARY creates can race. Prefer a partial unique on `(opportunityId)` where `role = 'PRIMARY'` (or equivalent).

2. **Commercial write nulls omitted recurring/one-time** — `setOpportunityCommercial` writes `recurringAnnualAmount` / `oneTimeAmount` as `null` when args omit them, wiping prior summaries on amount-only updates. Preserve existing values unless explicitly cleared.

3. **Update + history not transactional** — commercial / probability / close-date update then history `create`; history failure leaves state without provenance row. Prefer `$transaction` (same class of note as Wave 1 stage history).

4. **Review package scope** — duplicate path hunks + Wave 1 full-file “new file” noise; missing prisma/API/authz/transition/definitions hunks. Isolate Wave 2 deltas before commit.

5. **Encoding artifacts in the review package** (`ΓÇö` / `Γëá`) — packaging mojibake; UTF-8 on disk for sources is fine.

6. **No HTTP-level route tests** — lib coverage is solid; five Wave 2 routes untested at HTTP layer.

7. **`canOverrideOpportunityProbability` narrower than `canEditOpportunities`** — override requires `opportunities.edit` (not `editLeads` fallback). Documented in report; intentional stricter gate is fine, but worth a one-line AuthZ comment for operators.

---

### Assessment

Wave 2 delivers the brief surface with the right honesty boundaries: non-binding product lines, required currency + amount basis with history and no silent FX, explainable probability (not ML / not Revenue certainty), close dates with source/confidence/history and UNKNOWN excluded from forecast eligibility, and a dark weighted helper (`WEIGHTED_PIPELINE_UI_ENABLED = false`). WORKING_TREE wiring (transition PRIMARY gate, create seed + stage default probability, AuthZ override flag, Prisma/SQL) matches the report even where the review package omits hunks. Vitest re-run is green (45/45). Residual items are hygiene / hardening — none block acceptance.

**Task quality:** Approved
