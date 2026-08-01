# Final Review — Tax Activation (Active-Only)

**Reviewer:** Senior Code Review (read-only)  
**Date:** 2026-08-01  
**Mode:** Defect-first review of WORKING TREE (uncommitted tax-activation scope only)  
**BASE_SHA:** `f918aed627019ad3d669c92b382904d266e7bfb7`  
**Spec:** `docs/superpowers/specs/2026-08-01-tax-activation-active-only-design.md`  
**Plan:** `docs/superpowers/plans/2026-08-01-tax-activation-active-only.md`  
**SDD prior:** Tasks 1–5 complete (`.superpowers/sdd/`)

## Scope reviewed

**New:** `lib/taxManagement/assertActiveTaxTypes.js`, `lib/taxTypesClient.js`, `tests/unit/taxManagement/assertActiveTaxTypes.test.js`, design + plan docs  
**Modified:** Quotation/Invoice modals, POS page, quotations/invoices/sales write routes, tax-types page, `vitest.config.js`  
**Ignored:** Unrelated dirty tree

**Vitest (re-run this review):** `tests/unit/taxManagement/assertActiveTaxTypes.test.js` — **6/6 passed**

---

### Strengths

- Clean reuse of existing `TaxType.status` — no schema migration; management GET default remains unfiltered.
- Shared server helper + client helper keep create enforcement and picker filtering consistent and small.
- Create paths (quotation / invoice / sale) are strict Active-only; PUT paths correctly grandfather via `allowInactiveIds` loaded from existing item taxes (tenant-scoped), matching the implemented design evolution.
- Tax Codes Activate/Deactivate uses status-only PUT (API already supports partial `{ status }`), with deactivate confirm copy aligned to the spec.
- Unit tests cover empty, Active pass, Inactive reject, unknown, and allow-list pass/fail.
- POS already Active-filtered; helper migration preserves behavior and improves response-shape normalization.

---

### Issues

#### Critical (Must Fix)

None.

#### Important (Should Fix)

1. **Edit pickers hide grandfathered Inactive taxes from the checkbox list** — `components/QuotationModal.js`, `components/InvoiceModal.js`  
   After Active-only `fetchActiveTaxTypes()`, edit mode still keeps Inactive taxes on the line (`taxes` / `productTaxes`) and shows them under “Applied”, but they never appear as checked checkboxes. Users see unchecked Active options plus “Clear taxes”, which makes it easy to clear a historical tax without seeing it in the picker. Spec acceptance (“existing lines … remain visible”) is only partially met.  
   **Fix:** On edit load, union line `taxTypeId`s missing from the Active list into the picker as disabled/read-only rows (or fetch those IDs explicitly), and keep them non-selectable for *new* toggles.

2. **Spec/plan still say updates reject Inactive without documenting `allowInactiveIds`** — design + plan docs  
   Acceptance text still reads as “API rejects creating/**updating** … Inactive `taxTypeId`” with no grandfather exception. Implementation (and Task 3) correctly allow historical IDs on PUT. Undocumented drift invites a future “fix” that breaks edit/save of deactivated-tax documents.  
   **Fix:** Update spec §4 / acceptance criteria and plan Task 3 to describe create = strict, update = Active **or** `allowInactiveIds` from existing document taxes.

#### Minor (Nice to Have)

1. **Document-scoped allow-list is looser than “no new selection”** — on a single PUT, an Inactive tax already on any line can be attached to other/new lines of the same document. Prefer line-level or “intersection with submitted IDs that were already present” if product wants stricter semantics.
2. **`collectTaxTypeIdsFromItems` / dedupe / `findMany` args untested** — only assert paths covered; collector and query contract are untested.
3. **`assertActiveTaxTypes.js` formatting** — every logical line is separated by a blank line (noisy diffs / readability).
4. **No authenticated HTTP smoke** for POST 400 / PUT grandfather — unit + static wiring only (noted in prior SDD reviews).
5. **Other pickers** (purchases, expenses, stock, bulk tax) still use raw `?status=Active` rather than `fetchActiveTaxTypes` — fine per plan; optional consistency follow-up.
6. **Product-linked Inactive taxes** can still auto-apply on product select (GET `/api/products/[id]/taxes` does not filter Active). Create then 400s. Spec called this out as out-of-band; filter to Active when applying product defaults for a smoother UX.

---

### Recommendations

1. Ship the edit-picker disabled/read-only union for historical Inactive taxes before calling the UX acceptance criteria fully done.
2. Sync spec/plan language with create-vs-update grandfathering so SDD/docs match code.
3. Optionally filter product-default taxes to `status === 'Active'` in Quotation/Invoice/POS apply paths (spec risk note).
4. Add one thin route-level or helper integration case: create with Inactive → 400; update preserving existing Inactive → 200.

---

### Assessment

| Check | Result |
|-------|--------|
| Plan alignment (Tasks 1–5) | ✅ Met; update grandfathering is intentional delta from early plan wording |
| Architecture | ✅ Shared assert + client fetch; management vs picker GET split correct |
| Create vs update | ✅ Create strict; PUT `allowInactiveIds` present and tested |
| Management GET vs picker GET | ✅ Tax Codes unfiltered; transactional UIs Active-only |
| Testing | ✅ Unit 6/6; gaps are integration / collector / edit UX |
| Production readiness | ⚠️ Solid server backstop; edit UX + docs drift should be cleaned up |

**Ready to merge?** With fixes  

**Reasoning:** Core Active-only create enforcement, Tax Codes activate/deactivate, and PUT grandfathering are sound and tested, but edit-modal visibility for historical Inactive taxes and the undocumented create/update semantics should be fixed before treating the feature as acceptance-complete.
