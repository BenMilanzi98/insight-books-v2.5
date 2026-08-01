# Task 5: Spec acceptance sweep — Report

**Spec:** `docs/superpowers/specs/2026-08-01-tax-activation-active-only-design.md`  
**Date:** 2026-08-01  
**Verdict:** PASS (all checklist items)  
**Code changes:** none (verification only)

## Checklist

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Quotation / Invoice / POS pickers use Active-only fetch | **PASS** | `QuotationModal.js` L13/L245, `InvoiceModal.js` L14/L374, `app/pos/page.js` L65/L298 all call `fetchActiveTaxTypes()` → `GET /api/tax-types?status=Active` (`lib/taxTypesClient.js`). Bare `/api/tax-types` calls in those files are **POST** create only, not picker GETs. |
| 2 | API asserts on quotation / invoice / sales writes | **PASS** | `assertActiveTaxTypeIds` on create: `quotations/route.js` ~L280, `invoices/route.js` ~L403, `sales/route.js` ~L588. On update: `quotations/[id]/route.js` ~L191, `invoices/[id]/route.js` ~L266 (400 on Inactive). |
| 3 | Tax Codes has Activate / Deactivate | **PASS** | `app/tax-types/page.js` ~L672–678: per-row Activate/Deactivate buttons; ~L288 toggles status via PUT. |
| 4 | GET `/api/tax-types` without status still returns all | **PASS** | `app/api/tax-types/route.js` L30–38: `status` optional; applied to `where` only when present — no default Active-only filter. |
| 5 | PUT grandfathering `allowInactiveIds` present | **PASS** | Built from existing item taxes in `quotations/[id]/route.js` L188–195 and `invoices/[id]/route.js` L263–270; passed into `assertActiveTaxTypeIds`. Helper documents allowlist in `lib/taxManagement/assertActiveTaxTypes.js`. |
| 6 | Vitest `assertActiveTaxTypes.test.js` | **PASS** | `npx vitest run tests/unit/taxManagement/assertActiveTaxTypes.test.js` → 1 file, **6/6 tests passed** (431ms). |

## Critical gaps found

None. No fixes required.

## Minor / docs-only notes

None material. Spec acceptance criteria are met by code evidence above; historical read paths remain unguarded (assert only on writes), matching design.
