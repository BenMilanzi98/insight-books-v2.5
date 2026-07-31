# Task P15-2 Review — Wave 2 Price Books, pricing, tax/FX, discounts, approvals

**Head:** `WORKING_TREE` (base `7d9709a`; no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p15-2-review-package.diff`  
**Brief / report:** `task-p15-2-brief.md` / `task-p15-2-report.md`  
**Mode:** Read-only (spec + quality); Vitest not re-run; claimed 8/8 verified by source  
**Date:** 2026-07-31  

---

### Spec Compliance: ✅

| Criterion | Status | Notes |
|-----------|--------|-------|
| Required lib surfaces (priceBooks, productConfig, lineItems, pricing, pricingSnapshot, currencyFx, tax, discounts, exceptions, terms, clauses, approvals) | ✅ | Present under `lib/admin/crm/commercial/`; barrel + `lib/admin/crm` exports |
| Interfaces: create/approve/activate Price Book; `calculateCommercialDocument`; submit/decide approval | ✅ | `(prisma, args)` pattern; totals labels currency-explicit |
| ACTIVE Price Book immutability | ✅ | `updatePriceBookEntry` → `price_book_version_immutable`; Vitest asserts listPrice unchanged |
| Deterministic + idempotent calculate | ✅ | Snapshot by `documentVersionId`+`idempotencyKey`; retry returns same id/snapshot |
| No silent FX / no false multi-currency sum | ✅ | `assertCurrencyPricingGate` / `resolveFxContext` → `FX_CONTEXT_MISSING` / `STALE`; tests cover mix + missing |
| Tax in-platform; override needs approval; no Tenant GL / MRA EIS | ✅ | CRM tax models + stub API; override fails without `overrideApproved`; domain flags; no tenant tax alias in tax-rules route/SQL |
| Discount threshold + pending not in effective pricing | ✅ | 20% → PENDING; calc leaves netSubtotal unchanged (when status resolved from DB) |
| SoD self-approve blocked (approval step) | ✅ | `decideApprovalStep` + discount approve SoD; Vitest covers commercial step |
| Material change invalidates approvals | ✅ | `applyMaterialDocumentChange` → `INVALIDATED` for APPROVED/PENDING |
| Prisma models + SQL fallback + hasCrm*Model | ✅ | All named Wave 2 models in schema + `crm-commercial-phase15-wave2.sql`; guards present |
| Thin API/UI stubs | ✅ | price-books, discount-requests, tax-rules, commercial-approvals |
| No PDF/issue/acceptance; Opp estimates non-binding; no commit | ✅ | Domain contract flags; no Wave 3 surfaces; WORKING_TREE |
| Vitest Wave 2 PASS (claim) | ✅ | Source has **8** `it(...)` cases matching report RED→GREEN list (not re-run) |

**Spot-check (named risks):** Prisma models present (PriceBook/Version/Entry, TaxRule/RateVersion, DiscountPolicy/Request, PricingException/Snapshot, Approval*, Term, Clause). Tax API/SQL are CRM-only — **no Tenant GL tax alias / MRA EIS**.

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

1. **`resolveDiscountApplication` trusts caller `status` / skips DB when status present** — `lib/admin/crm/commercial/discounts.js`  
   Lookup runs only when `id && !status`. A caller can pass `{ percent: 20, status: 'APPROVED' }` (or id + forged `APPROVED` while DB is PENDING) and the 20% reduces `netSubtotal`, bypassing threshold + approve SoD. Server-side totals must resolve approval exclusively from `CrmDiscountRequest` (or reject unsigned statuses).

2. **Pricing exceptions can self-approve and are trusted from the calculate payload** — `exceptions.js` + `pricing.js`  
   `createPricingException` sets `APPROVED` when `args.approved === true` with the same actor (no SoD). `filterApprovedExceptions` applies any in-memory `{ status: 'APPROVED' }` / `approved: true` without loading `CrmPricingException`. Brief requires exception SoD and approved-only effective pricing.

3. **Tax-inclusive `grandTotal` double-counts tax** — `tax.js` + `pricingSnapshot.js`  
   When `inclusive: true`, `computeTaxTotal` extracts tax from an already-inclusive net, but `buildCurrencyExplicitTotals` always does `grandTotal = netSubtotal + taxTotal`. Inclusive quote of 116.5 @ 16.5% becomes ~133. Use `taxBase + tax` / `grand = net` when inclusive (or stop adding extracted tax). Untested path (`inclusive: false` only in Wave 2 suite).

#### Minor (Nice to Have)

1. **Material invalidation is opt-in** — qty/content edits via Wave 1 `updateDocumentVersionContent` do not call `applyMaterialDocumentChange`; stale APPROVED requests possible until the helper is wired or content updates fingerprint.
2. **`calculateCommercialDocument` does not resolve rate from `CrmTaxRule` / `CrmTaxRateVersion`** — relies on caller `taxContext.ratePercent`; models/API exist but are unused in the calc path.
3. **Tax `overrideApproved: true` is a bare boolean** — no approval evidence row; acceptable for Wave 2 stub if documented, but weaker than discount/approval engines.
4. **Prisma generate / db push not run** — reported; `hasCrm*Model` + SQL mitigate until regenerate.
5. **UI stub i18n keys may render raw** — reported; stubs OK.
6. **Approval policy seed / multi-year TCV** — reported concerns; non-blocking for Wave 2 spine.
7. **`quotedAnnualRecurring` ignores pure ANNUAL line amounts** — returns `monthly * 12` only; annual-billed lines affect `firstYearTotal`/`TCV` but not that label.

---

### Acceptance checklist (brief)

- [x] Vitest Wave 2 PASS (claimed 8/8; not re-run; source matches)
- [x] ACTIVE Price Book versions immutable
- [x] calculateCommercialDocument deterministic + idempotent
- [x] Currency separation + FX gate
- [~] Discount/exception SoD — approval-step + discount-approve SoD OK; **calc trusts forged discount/exception approval (Important #1–2)**
- [x] Approval invalidation on material change (explicit helper)
- [x] No tenant tax/MRA side effects; no commit

---

### Assessment

Wave 2 delivers the required surfaces, models, SQL fallback, thin stubs, and the eight TDD cases at source level. Hard FX/immutability/tax-override-fail/material-invalidate paths look sound. Quality is **not** approved until discount/exception effective pricing is server-authoritative and inclusive tax totals are correct.

**Spec:** ✅  
**Task quality:** Not approved  
**Findings:** Critical 0 · Important 3 · Minor 7  
**Review path:** `.superpowers/sdd/task-p15-2-review.md`

---

## RE-REVIEW (after Important fix wave) — 2026-07-31

**Mode:** Read-only; Vitest **not** re-run (no doubt on claim); package AFTER FIX + working-tree source verified.

### Important #1–3 disposition

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | Discount approval DB-only | **Resolved** | `resolveDiscountApplication` loads status/percent only from `CrmDiscountRequest` by id; no-id / unknown id → PENDING; caller `status` never applied. Test: forged APPROVED without DB row → net unchanged. |
| 2 | Exception SoD + DB verify | **Resolved** | `createPricingException` always `PENDING` (ignores `approved: true`); `approvePricingException` with requester≠approver SoD; `filterApprovedExceptions(prisma, …)` async, requires id + DB `APPROVED`; `calculateCommercialDocument` awaits it. Test: create stays PENDING + forged in-memory APPROVED does not alter unit price. |
| 3 | Inclusive `grandTotal` | **Resolved** | `buildCurrencyExplicitTotals({ inclusive })` → `grand = inclusive ? net : net + tax`; pricing passes `taxResolved.inclusive`. Test: inclusive 116.5 @ 16.5% → `grandTotal === netSubtotal === 116.5`. |

### Covering tests (claimed 11/11)

Source `test/systemAdmin.crm.commercialWave2.test.js` has **11** `it(...)` cases (original 8 + 3 fix-wave). Report claims `Tests 11 passed (11)` — accepted without re-run.

### Acceptance checklist (updated)

- [x] Vitest Wave 2 PASS (claimed **11/11**; not re-run; source count matches)
- [x] ACTIVE Price Book versions immutable
- [x] calculateCommercialDocument deterministic + idempotent
- [x] Currency separation + FX gate
- [x] Discount/exception SoD — calc is DB-authoritative; create/approve SoD on exceptions
- [x] Approval invalidation on material change (explicit helper)
- [x] No tenant tax/MRA side effects; no commit

### Open findings (re-review)

#### Critical
_None._

#### Important
_None_ (prior #1–3 closed).

#### Minor
Prior Minor **1–7** still open (non-blocking): opt-in material invalidation wiring, tax rate not loaded from CrmTaxRule in calc, bare `overrideApproved`, Prisma generate/db push, stub i18n, policy seed/multi-year TCV, `quotedAnnualRecurring` vs pure ANNUAL lines. No new Important/Critical defects found in fix wave.

### Verdict

**Spec:** ✅  
**Quality Approved?** Yes  
**Findings:** Critical 0 · Important 0 · Minor 7  
**Review path:** `.superpowers/sdd/task-p15-2-review.md`
