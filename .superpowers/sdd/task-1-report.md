# Task 1 Report — Failing unit tests for Unpaid-always auto bill

**Date:** 2026-08-11  
**Status:** **DONE (TDD RED)**  
**Scope:** Create failing Vitest coverage for `autoCreateBillFromReceipt` only. No production code changes (Task 2). No git commit.

## Verdict

Task 1 TDD RED phase complete. The new unit test file asserts that goods-receipt auto-bills are always **Unpaid** (including when GRNI is enabled) and that supplier balance is incremented. One test fails against current production behavior, confirming the expected RED state before Task 2 implementation.

## Brief note

The file at `.superpowers/sdd/task-1-brief.md` contained stale content (Deferred Revenue purpose task). Test code and values were taken verbatim from the authoritative plan: `docs/superpowers/plans/2026-08-11-goods-receipt-stock-unpaid-bill.md` Task 1, which matches the user task description.

## Deliverables

| Item | Result |
|------|--------|
| Create `tests/unit/purchases/autoCreateBillFromReceipt.test.js` | **DONE** |
| Mock `@/lib/purchases/grniPolicy` | **DONE** |
| Four test cases (GRNI on, GRNI off, idempotency, empty items) | **DONE** |
| Production code changes | **NONE** (by design) |
| Git commit | **NONE** (global constraint) |

## Test file summary

**Path:** `tests/unit/purchases/autoCreateBillFromReceipt.test.js`

| Test | Expected in Task 1 (RED) | Actual result |
|------|--------------------------|---------------|
| creates Unpaid bill and increments supplier balance when GRNI is enabled | **FAIL** | **FAIL** ✓ |
| creates Unpaid bill when GRNI is disabled | PASS | PASS |
| returns existing bill without creating a second one | PASS | PASS |
| returns null when receipt has no items | PASS | PASS |

**Result:** 1 failed | 3 passed (4 total) — correct RED evidence.

## TDD RED evidence

**Command:**

```bash
npx vitest run tests/unit/purchases/autoCreateBillFromReceipt.test.js
```

**Output:**

```
 RUN  v4.1.2 C:/laragon/www/insight-books-v2.5

 ❯ tests/unit/purchases/autoCreateBillFromReceipt.test.js (4 tests | 1 failed) 21ms
     × creates Unpaid bill and increments supplier balance when GRNI is enabled 16ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/unit/purchases/autoCreateBillFromReceipt.test.js > autoCreateBillFromReceipt > creates Unpaid bill and increments supplier balance when GRNI is enabled
AssertionError: expected 'Draft' to be 'Unpaid' // Object.is equality

Expected: "Unpaid"
Received: "Draft"

 ❯ tests/unit/purchases/autoCreateBillFromReceipt.test.js:72:25
     70|     const bill = await autoCreateBillFromReceipt({ tx, ...baseArgs });
     71|
     72|     expect(bill.status).toBe('Unpaid');
       |                         ^
     73|     expect(tx.supplierBill.create).toHaveBeenCalledTimes(1);
     74|     const data = tx.supplierBill.create.mock.calls[0][0].data;

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

**Root cause (current production):** In `lib/goodsReceiptFollowOn.js`, `autoCreateBillFromReceipt` sets `billStatus = grniEnabled ? 'Draft' : 'Unpaid'` and skips `supplier.update` when GRNI is enabled (lines 127–184). The failing test correctly exposes this Draft/GRNI branch.

## Self-review

| Check | Outcome |
|-------|---------|
| Test code matches plan verbatim | **PASS** |
| No production code touched | **PASS** |
| Vitest alias `@/` resolves (`vitest.config.js`) | **PASS** |
| RED failure is the GRNI-enabled case (not import/setup error) | **PASS** |
| Other three cases pass (GRNI-off already Unpaid; idempotency; empty items) | **PASS** |
| Linter clean on new file | **PASS** |
| Ready for Task 2 (always-Unpaid implementation) | **PASS** |

## Next step (Task 2)

Modify `lib/goodsReceiptFollowOn.js` → `autoCreateBillFromReceipt` to always create `status: 'Unpaid'`, always attach `journalEntryId`, always set finalize fields, and always increment supplier balance. Re-run the same vitest command; expected: **4/4 PASS**.
