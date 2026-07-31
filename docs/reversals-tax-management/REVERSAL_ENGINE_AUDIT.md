# Reversal Engine Audit

## What exists
1. **V2 reverseJournal** — opposite posted journal, bidirectional link, preview, triple idempotency. KEEP.
2. **reverseSourceJournals** — finds Posted journals by source module/id (+ suffix expansion). KEEP/EXTEND.
3. **transactionReversalService** — eligibility, reason, period lock, create*Reversal, impact calc. EXTEND into façade.

## Missing vs master prompt
| Capability | Status |
|------------|--------|
| TransactionReversal aggregate | Absent |
| request/approve/execute SoD | Absent (immediate execute) |
| Unique DB constraint per original | Absent on docs |
| Engine-grade impact = execute path | Partial (heuristic impact; V2 preview separate) |
| Coherent RBAC | Split journalEntries.* vs journal.reverse |
| Original marked reversed | Often not updated — details lookup wrong direction |

## Target façade (`lib/reversals/`)
- requestTransactionReversal
- approveTransactionReversal
- executeTransactionReversal → always reverseSourceJournals/reverseJournal
- eligibility wrapping validateReversalEligibility
- period policy REVERSE_IN_CURRENT_OPEN_PERIOD + disclosure
