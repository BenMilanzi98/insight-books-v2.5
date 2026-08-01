# Task 2 Review — Client helper + Quotation/Invoice/POS pickers

**Feature:** Tax Activation (Active-only)  
**Sources:** `task-2-brief.md`, `task-2-report.md`, working-tree files (verified via `git diff` + Grep)  
**Note:** `task-2-review-package.diff` does **not** contain Task 2 tax changes — it is unrelated onboarding (materialise/kickoff/scope) content. Review based on working tree, not that package.

## Verdicts

1. **Spec compliance:** ✅  
2. **Task quality:** **Approved**

## Critical

None.

## Important

None.

## Minor (non-blocking)

1. **Review package mismatch** — `task-2-review-package.diff` is wrong content (Phase 17 onboarding). Do not treat it as evidence for this task; working-tree audit is authoritative.
2. **Manual UI check not run** — Step 5 (Inactive tax absent from Quotation checkboxes) not executed in-session; relies on API honoring `?status=Active` (pre-existing). Call-site wiring is correct.
3. **No unit test for helper** — brief did not require one; optional fetch-mock coverage for response-shape parsing.

## Spec checklist

| Requirement | Status |
|-------------|--------|
| Create `lib/taxTypesClient.js` with `fetchActiveTaxTypes()` as specified | ✅ Matches brief verbatim |
| QuotationModal picker GET → helper; no unfiltered GET | ✅ `fetchActiveTaxTypes()` only; Grep clean |
| InvoiceModal picker GET → helper; no unfiltered GET | ✅ Same |
| POS Active list → helper | ✅ Replaces bare `fetch('/api/tax-types?status=Active')` |
| Leave POST create tax unchanged | ✅ All three files keep `method: 'POST'` to `/api/tax-types` |
| No new Prisma column | ✅ Client-only |
| Do not commit | ✅ Untracked helper + modified modals/POS in working tree |

## Call-site audit (Grep)

| File | Picker load | Create POST | Other |
|------|-------------|-------------|-------|
| `QuotationModal.js` | `fetchActiveTaxTypes()` | `POST /api/tax-types` kept | — |
| `InvoiceModal.js` | `fetchActiveTaxTypes()` | POST kept | Default-inflow fallback uses returned Active array |
| `app/pos/page.js` | `fetchActiveTaxTypes()` | POST kept | `GET /api/tax-types/accounts` unchanged (not picker list) |

No unfiltered picker `GET /api/tax-types` remains in the three target files.

## Strengths

- Helper contract matches plan/brief exactly.
- Scope limited to picker loads; create paths untouched.
- Response normalization keeps `setTaxTypes` / `setPosTaxTypes` as arrays; existing try/catch handles helper throws.
- POS already Active-filtered; helper consolidates without behavior change beyond shared parsing.

## Residual risk

Inactive exclusion depends on existing API `?status=Active` filter (out of Task 2 scope). Server assert (Task 1 / later write tasks) remains the hard backstop for stale tabs.
