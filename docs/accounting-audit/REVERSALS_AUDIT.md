# Reversals Audit

Run: `npm run audit:forensic -- --module reversals` • Source:
`lib/accountingEngine/reverseGlEntry.js`, `lib/transactionReversalService.js`,
`lib/reversalValidation.js`, `lib/financialReversalHelpers.js`.

## How reversals actually work (verified)

- A reversal creates a **new** `Transaction` with `isReversal=true`,
  `reversedTransactionId` → original, swapped debit/credit lines, and posts through
  `postGlEntry` (period check + balance update apply). Originals are preserved. Correct pattern.
- Reversal reasons and reversed-by are stored on the reversal row; the original also receives
  `reversedAt/reversedById/reversalReason` metadata on operational rows (Invoice/Sale/Expense
  carry their own reversal flags).
- Reports include both original and reversal as posted entries → economic impact **nets to
  zero** (verified with `QA-S03-REV`, `QA-S06-GL-REV`: sale and invoice reversals net exactly).
- The Reversals UI/module drives `transactionReversalService` which validates
  (`reversalValidation.js`) reversibility and blocks double reversal **at the application level**.

## Data findings (current DB)

| Check | Result |
|---|---|
| Reversals without original link (REV-001) | 0 |
| Originals with multiple active reversals (REV-002) | 0 |
| Reversal totals ≠ original (REV-003) | 0 |
| Reversal lines to accounts absent from original | 0 |
| Cross-tenant reversals | 0 |
| Reversals into closed periods | 0 (engine period check applies) |

2 reversal transactions exist; both mirror their originals exactly.

## Structural defects

1. **No DB constraint prevents repeated reversals** — `reversedTransactionId` is indexed but not
   unique (schema W7). The application check is race-prone like the duplicate-posting check.
2. **Dual status representation**: reversal state lives on `Transaction.isReversal` +
   `reversedTransactionId`, *and* on operational rows (`Invoice.isReversal`, etc.), *and* the
   secondary `JournalEntry` ledger has its own manual-journal reversal path
   (`createReversalEntry` in `postManualJournalEntry.js`, observed row `QA-S11-JE-REV` with
   `sourceType='manual_journal_reversal'`). Nothing reconciles the three.
3. **`ReversalAudit` table is unmapped** (`@@ignore`) — the intended audit trail is invisible to
   the application (0 rows).
4. Reports that filter `isReversal=false` (some dashboards do, to show "activity") while others
   net original+reversal — inconsistent exclusion semantics across reports; a report filtering
   only originals out (but not reversals) double-counts the reversal side. Flagged for the
   lineage matrix.
