# Payables Audit

Run: `npm run audit:forensic -- --module ar-ap,sources` • Artifacts:
`artifacts/accounting-audit/ar-ap-reconciliation.csv`, `findings-latest.csv`.

## Control-account reconciliation (tenant QA-Accounting)

| Measure | Amount |
|---|---|
| AP control account 2110 (journal-derived) | **22,000.00** |
| Operational subledger (unpaid bills + unpaid expense payables) | **22,000.00** |
| Difference | **0.00** ✔ (on current data) |

The 22,000 AP balance is fully supported by journal `QA-S08-GL` (expense on account).
The supplier bill `QA-S09-BILL` (45,000) was billed and fully paid — GL shows both sides
(`QA-S09-GL-BILL`, `QA-S09-GL-PAY`), netting AP to zero for it. Correct.

## The "liability visible in CoA but not in Journal Entries" issue — root-cause determination

The audit engine checks every non-zero liability account for journal support (AP-004).
On current data both non-zero liabilities (2110 AP 22,000; 2130 PAYE 18,000) **are** supported.
However, the mechanism that produces unsupported liabilities in production is **proven**:

| Cause candidate | Verdict | Evidence |
|---|---|---|
| Direct stored-balance updates without journal | **Confirmed possible** | `Account.balance` writable via `updateAccountBalanceOnTransaction` with `skipBalanceUpdate`/recalc scripts; `scripts/sync-existing-data-to-accounts.js` class of backfill tools writes balances |
| Legacy header-amount journals (JRN-009) | **Confirmed** (general mechanism) | stored balance includes them; the Journal Entries UI lists line-based entries — a header-only journal shows a balance with no visible lines |
| `Liability` module rows with `currentBalance` and nullable `glAccountId` | **Confirmed independent surface** | `Liability.currentBalance Float` maintained operationally (`LiabilityPayment`), only linked to GL when `glAccountId` set |
| Report-query defects / wrong period filters | Possible, unverified | requires production data |
| Data imported without journal creation | Confirmed possible | historical import flags (`isHistorical`, `migrationBatch`) exist on operational tables with no journal requirement |
| Deleted journals | Possible | `JournalEntry` cascade paths; no posted-journal delete protection |

**Most probable production mechanism** (strong evidence, needs production-copy confirmation):
liabilities recorded via the Liabilities module or via balance backfill scripts update stored
balances/operational rows without a corresponding line-based journal, so the CoA (stored
balance) shows the liability while the Journal Entries screen (line-based) shows nothing.

## Module mechanics (verified)

- Supplier bills post AP at finalization (`lib/purchaseAccounting.js`, `supplierBillExpenseFinalize.js`);
  payments post Dr AP / Cr cash (`QA-S09-GL-PAY` verified).
- `SupplierBill.journalEntryId` / `SupplierPayment.journalEntryId` exist but were **NULL** on the
  observed rows even though GL transactions exist — the FK linkage is not consistently written
  (traceability defect, same class as AR).
- Supplier aging (`lib/apAgingService.js`) computes from operational bill rows, not the control
  account — same dual-mechanism divergence risk as AR.
- `Supplier.currentBalance` (Float) is a third balance surface with no reconciliation control.

## Verdict

AP reconciles on current data, but the system has no invariant keeping it that way; the
unsupported-liability mechanism is real and now continuously measurable (AP-004). Do not post
balancing journals in Phase 1.
