# Task 3 Review — API write enforcement (re-review after Important fix)

**Feature:** Tax Activation (Active-only)  
**Sources:** `task-3-brief.md`, `task-3-report.md` (incl. Important review fix), working-tree `app/api/**` + `lib/taxManagement/assertActiveTaxTypes.js`  
**Method:** Grep `assertActiveTaxTypeIds` / `allowInactiveIds`; Read helper + PUT/POST call sites; confirm unit tests cover allow-list

## Verdicts

1. **Spec compliance:** ✅  
2. **Task quality:** **Approved**

## Critical

None.

## Important

None remaining.

### Resolved (prior Important)

**PUT grandfathering of historical Inactive tax lines** — fixed.

- `lib/taxManagement/assertActiveTaxTypes.js` — optional 4th arg `allowInactiveIds`; IDs must still exist for tenant; Active check skipped only for allow-listed IDs; unknown still `UNKNOWN_TAX`.
- `app/api/quotations/[id]/route.js` — loads existing `quotationItemTax.taxTypeId`s (tenant-scoped via quotation), passes as `allowInactiveIds` before item recreate.
- `app/api/invoices/[id]/route.js` — same for `invoiceItemTax` / `normalizedItems`.
- POST create paths remain strict (no 4th arg):
  - `app/api/quotations/route.js`
  - `app/api/invoices/route.js`
  - `app/api/sales/route.js`
- Unit tests: Inactive in allow list passes; Inactive not in allow list still `INACTIVE_TAX` (6 tests per report).

## Minor (non-blocking)

1. **No authenticated HTTP POST smoke** — Step 4 verified via shared try/catch + Prisma helper against a temp Inactive type, not a live `POST /api/quotations` with session cookies. Pattern match is sound; full route smoke still recommended.
2. **Sales rate-match fallback** — items with tax amount but empty `taxBreakdown` are not asserted (no client-supplied id). Fallback already selects `status: 'Active'` only; residual risk is limited and was correctly called out in the report.

## Spec checklist

| Requirement | Status |
|-------------|--------|
| Quotations POST assert before `itemTaxes` create | ✅ ~280–290; strict (no allow list) |
| Quotations `[id]` PUT assert before item recreate | ✅ ~178–202; `allowInactiveIds` from existing lines |
| Invoices POST assert before create | ✅ ~402–413; strict |
| Invoices `[id]` PUT assert before tax write | ✅ ~253–277; `allowInactiveIds` from existing lines |
| Sales POST assert covering `taxBreakdown` | ✅ ~588–598; collector includes `taxBreakdown`; strict |
| 400 JSON `{ error, code }` for Inactive / unknown | ✅ Consistent try/catch mapping |
| GET / read paths untouched | ✅ No assert on GET handlers |
| No commit | ✅ Per report |

## Call-site audit (placement)

| File | Assert location | Persist follows? | Strict vs allow |
|------|-----------------|------------------|-----------------|
| `app/api/quotations/route.js` | After item field validation | Yes — `$transaction` / nested `itemTaxes.create` | Strict |
| `app/api/quotations/[id]/route.js` | After totals calc + load existing taxes | Yes — delete items then recreate with taxes | `allowInactiveIds` |
| `app/api/invoices/route.js` | After item validation | Yes — create path afterward | Strict |
| `app/api/invoices/[id]/route.js` | After `normalizedItems` validation + load existing | Yes — delete/recreate via `buildInvoiceItemCreateData` | `allowInactiveIds` |
| `app/api/sales/route.js` | After item validation | Yes — sale + `saleItemTax.create` later | Strict |

All five target files import and invoke the helper **before** tax row persistence. Only PUT exists on quotation/invoice `[id]` (no separate PATCH).

## Strengths

- Shared collector correctly covers `itemTaxes` / `taxes` / `taxBreakdown`.
- Error mapping matches Task 1 helper contract (`status` / `INACTIVE_TAX` / `UNKNOWN_TAX`).
- PUT allow-list is tenant-scoped and limited to IDs already on the document; newly selected Inactive IDs still reject.
- Create/POS paths stay Active-only.
- Intentionally left duplicate/convert and GET paths alone.

## Residual risk

Low. Historical quotation/invoice edit/save with existing Inactive lines should succeed; attaching a newly selected Inactive tax on update still 400s. Recommend a quick authenticated POST/PUT smoke when logged in.
