# Journal Entry Integrity Audit

Run: `npm run audit:forensic -- --module journals` • Data: local DB (QA dataset, 5 tenants,
19 Transactions / 39 TransactionLines / 6 JournalEntries / 8 JournalEntryLines) @ commit `5b59a68`.
Re-run against a production copy before Phase 2 sizing. Artifacts: `artifacts/accounting-audit/findings-latest.csv`.

## Results on the current database

| Check | Result |
|---|---|
| Transactions with debits ≠ credits (JRN-001) | **0** |
| Transactions with 0 or 1 line (JRN-002) | **0** |
| Lines with both debit and credit / neither / negative (JRN-003/004) | **0** |
| Duplicate posted sources — Transaction ledger (JRN-006) | **0** |
| Posted transactions missing posting date (JRN-007) | 0 |
| Posted transactions missing sourceType (JRN-005) | 0 |
| **Legacy header-amount JournalEntry rows (JRN-009)** | **2** (`QA-S19-LEGACY` D 5,000 / `QA-S19-LEGACY-CR` C 5,000) |
| JournalEntry duplicate source | 1 group (`manual_journal:QA-manual-journal` × 3 — two Drafts + one Posted) |
| NULL-tenant journals | 0 (structurally possible — `JournalEntry.tenantId` nullable) |

## Structural defects proven by code inspection (independent of current data)

1. **Two ledger shapes coexist.** `JournalEntry` carries `debit`/`credit` `Float` columns on the
   header with nullable `accountId` and rows with zero lines. Line-based reporting
   (`lib/trialBalanceReport.js`, `lib/accountBalanceService.js#recalculateAccountBalance`)
   ignores these rows, while the stored `Account.balance` may include them (they were applied
   at posting time). Verified concretely: account `3102` and `1110` diverge by exactly the legacy
   header amounts (see `GENERAL_LEDGER_AUDIT.md`).

2. **Duplicate prevention is application-level only.** `assertNoDuplicatePostedSource`
   (`lib/accountingMappingRules.js:320`) counts existing posted rows before insert — a
   check-then-act race. No DB unique constraint on `(tenantId, sourceType, sourceId)` exists,
   so concurrent submissions (double click + two server workers) can both pass the check.
   Additionally the check is **skipped entirely** when `sourceType`/`sourceId` are absent, and
   callers may pass `skipDuplicateCheck: true`.

3. **`sourceId` is not required to be the source row's primary key.** `postGlEntry` accepts any
   caller-supplied string and falls back to the generated reference. Observed in data: the GL
   entry for sale `QA-S02-SALE` carries `sourceId='QA-pos-mobile-money'`, so the sale cannot be
   joined to its journal by id — source→journal traceability relies on caller discipline.

4. **Journal mutability after posting is unaudited (JRN-008).** No row-version history exists
   for `Transaction`/`TransactionLine`; `updatedAt` is the only signal. Cannot be detected from
   data — recorded as schema weakness W11.

5. **Posted-status casing is inconsistent** — code matches `['posted','Posted','POSTED']`
   defensively in some services but exactly `'posted'` (Transaction) / `'Posted'` (JournalEntry)
   in others (e.g. `lib/trialBalanceReport.js`). A row with unexpected casing would silently drop
   out of some reports and not others.

## Unbalanced-journal inventory

None on current data (`artifacts/accounting-audit/findings-latest.csv` contains the full detail
of what was found). The `unbalanced-journals` artifact will be non-empty only when run against
production data; the engine computes total debit, total credit, difference, source, date, tenant
and status for each.
