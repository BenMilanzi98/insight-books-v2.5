# Reversals + Tax Management Reimplementation

**Date:** 2026-07-25  
**Status:** Wave 0 audit complete; Waves 1–6 in delivery

## Scope
Canonical Transaction Reversal Centre (`/transactions/reversals`) and Tax Management hub (`/tax-management/*`) with safe migration from `/tax-types` and `/tax-accounts`.

## Hard constraints
- CoA → V2 Posting Engine → posted journals/lines are source of truth
- Never delete/edit original journals; reversals create linked opposite journals
- Tax balances derive from posted evidence (no typed closings)
- Reuse V2 `reverseJournal` / `reverseSourceJournals` — no second GL engine

## Waves
| Wave | Deliverable |
|------|-------------|
| 0 | This forensic audit pack + FINAL_GAP_REGISTER |
| 1 | Tax Management route hub + nav + redirects |
| 2 | Reversal Engine façade + TransactionReversal + UI |
| 3 | Tax codes/mappings/subledger |
| 4 | Periods/returns/payments/refunds/credits/withholding |
| 5 | Reports/imports/reconciliation |
| 6 | Adapters + QA + FINAL_READINESS_DECISION |

## Start here
1. [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md)
2. [REIMPLEMENTATION_PLAN.md](./REIMPLEMENTATION_PLAN.md)
3. [IMPLEMENTATION_TASKS.md](./IMPLEMENTATION_TASKS.md)
