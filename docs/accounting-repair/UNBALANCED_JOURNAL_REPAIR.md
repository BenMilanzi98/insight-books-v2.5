# Unbalanced Journal Repair

Detection: JRN-102 (line debits ≠ credits within a posted journal) and GL-112
(business-wide debit/credit inequality), both `CRITICAL` and measured
(`CONFIRMED` findings with the exact difference in minor units).

## Root-cause analysis before any repair

For each unbalanced journal record: total debit, total credit, difference,
lines, accounts, source, status, business, period, affected reports, source
totals, audit and import history. Determine the cause: missing line, duplicate
line, wrong amount, failed partial transaction, float residue, deleted line,
manual/import/migration error, cross-business line, currency conversion error,
or projection-only error.

**A balancing line is never added without knowing the missing accounting
treatment.** Suspense-forcing is prohibited.

## Permitted treatments (per catalogue)

- Proven missing line → correcting journal (`MISSING_JOURNAL_REPAIR` for the
  missing effect).
- Invalid journal → `REVERSAL_REPAIR` + correct repost.
- Known difference → `AMOUNT_ADJUSTMENT_REPAIR` for exactly the difference.
- Projection-only error → `PROJECTION_REBUILD`, no journal.
- Immaterial rounding residue → `AMOUNT_ADJUSTMENT_REPAIR` under the documented
  rounding policy (`ROUNDING_DIFFERENCE`, LOW severity) or `REPORT_ONLY_REPAIR`.

Anything unresolved remains an exception (visible to Phase 7 reports). New V2
journals cannot be unbalanced by construction (engine validation), so the
population is closed: it can only shrink.
