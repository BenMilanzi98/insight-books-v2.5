# Task 3 Report: API write enforcement

## Status

**DONE**

## Summary

Wired `assertActiveTaxTypeIds` + `collectTaxTypeIdsFromItems` into quotation, invoice, and sales write handlers so Inactive / unknown `taxTypeId`s are rejected with HTTP 400 `{ error, code }` before any item-tax rows are persisted. No commits.

## Files Modified

| File | Change |
|------|--------|
| `app/api/quotations/route.js` | Import assert helpers; assert on `body.items` after field validation, before `$transaction` / `itemTaxes.create` |
| `app/api/quotations/[id]/route.js` | Same on PUT, after totals calc, before item delete/recreate |
| `app/api/invoices/route.js` | Assert on `body.items` after item validation, before income-account checks / create |
| `app/api/invoices/[id]/route.js` | Assert on `normalizedItems` after item validation, before update transaction |
| `app/api/sales/route.js` | Assert on `data.items` after item validation (covers `taxBreakdown` via collector), before sale create |

## Pattern applied

```js
try {
  await assertActiveTaxTypeIds(prisma, user.tenantId, collectTaxTypeIdsFromItems(items));
} catch (e) {
  if (e?.status === 400 || e?.code === 'INACTIVE_TAX' || e?.code === 'UNKNOWN_TAX') {
    return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
  }
  throw e;
}
```

`collectTaxTypeIdsFromItems` already gathers from `itemTaxes` / `taxes` / `taxBreakdown`, so sales taxBreakdown IDs are covered without a second collector.

## Out of scope (intentionally unchanged)

- GET / read paths
- Quotation duplicate / convert routes (historical copy-from-existing)
- Sales rate-match fallback that only selects from `status: 'Active'` rows

## Verification

### Call-site audit

All five target files import and call `assertActiveTaxTypeIds` before persisting taxes. Example (quotations POST): assert at ~line 280, `$transaction` / `itemTaxes.create` afterward.

### Unit tests

```
npx vitest run tests/unit/taxManagement/assertActiveTaxTypes.test.js
→ Test Files 1 passed | Tests 4 passed
```

### Inactive reject (route-pattern + live DB)

No auth cookies available for a full HTTP `POST /api/quotations` in this session. Verified the same try/catch mapping used by the routes against Prisma with a temporary Inactive `TaxType`:

```json
{
  "status": 400,
  "body": {
    "error": "Tax \"TMP Inactive Task3 Verify\" is not active and cannot be used on new documents.",
    "code": "INACTIVE_TAX"
  }
}
```

Temp Inactive tax was deleted after the check.

## Self-Review

### Strengths

- Assert runs before any write transaction that creates item tax rows.
- Consistent 400 payload shape across all five handlers.
- Sales uses shared collector so `taxBreakdown` is covered.

### Concerns / residual risk

- Editing a saved quotation/invoice that still carries an Inactive tax line will now 400 on save until the user removes/replaces that tax (matches spec write enforcement; may surprise users who only change non-tax fields).
- Full authenticated HTTP POST smoke was not run here (empty cookie jar); recommend a quick manual POST once logged in.
- Sales items with tax amount but empty `taxBreakdown` still use the Active-by-rate fallback and are not asserted (no client-supplied Inactive id to reject).

## Commits

None (per constraint).

---

## Important review fix: PUT allowInactiveIds for historical taxes

### Problem

Quotation/invoice PUT called `assertActiveTaxTypeIds` on the full payload with no exception for taxes already on the document. Saving a historical doc that still carried Inactive tax lines returned 400.

### Fix

1. **`lib/taxManagement/assertActiveTaxTypes.js`** — optional 4th arg `allowInactiveIds` (array or Set). Those IDs must still exist for the tenant; Active check is skipped. Unknown IDs still reject. IDs not in the allow list still require Active.

2. **PUT only**
   - `app/api/quotations/[id]/route.js` — load existing `quotationItemTax.taxTypeId`s (tenant-scoped via quotation), pass as `allowInactiveIds`
   - `app/api/invoices/[id]/route.js` — same for `invoiceItemTax`

3. **Unchanged (strict)** — POST create on quotations/invoices and sales create (no allow list).

### Unit tests

```
npx vitest run tests/unit/taxManagement/assertActiveTaxTypes.test.js
→ Test Files 1 passed (1)
→ Tests 6 passed (6)
```

Added cases:
- Inactive id in `allowInactiveIds` → passes
- Inactive id not in allow list → still rejects `INACTIVE_TAX`

### Commits

None (per constraint).
