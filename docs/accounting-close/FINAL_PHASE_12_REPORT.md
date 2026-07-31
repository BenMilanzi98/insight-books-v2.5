# Final Phase 12 Report — Month-End & Year-End Closing Framework

## 1. Executive summary

Phase 12 adds a **Year-End Close** framework distinct from Phase 8 period-end close. Closing Journals are generated from canonical Trial Balance / GL balances, approved with checksums, and posted through the **Posting Engine**. Continuous-ledger carry-forward avoids duplicate opening journals. Current Year Earnings uses **MODEL A** (calculated reporting line) with a single profit transfer.

## 2. Previous-phase evidence

Indexed in `PHASE_1_TO_11_EVIDENCE_INDEX.md`. No invented findings.

## 3. Existing closing defects (pre-Phase 12)

- Period close locked periods but did not close temporary accounts or transfer P/L.
- No PCTB, no Closing Journal Batch, no FY close ceremony requiring PE journals.
- Documented in `CURRENT_CLOSING_ARCHITECTURE.md`.

## 4. Target architecture

See `TARGET_CLOSING_ARCHITECTURE.md` and `CLOSING_DATA_FLOW_MAP.md`.

## 5. Database changes

Migration `20260721160000_year_end_close_v2`:

- CloseV2Configuration
- CloseV2YearEndCloseRun + StatusHistory + Tasks + Exceptions
- CloseV2ClosingJournalBatch + Lines
- CloseV2PostClosingTrialBalanceRun
- CloseV2AnnualSnapshot
- CloseV2YearReopenRequest

## 6–12. Configuration, period vs year, close run, readiness, checklist, module checks

Implemented via `configService`, Phase 8 reuse for period-end, `closeRunService`, `readinessService`, `yearEndChecklist.js`. Module checks: bank/equity automatic where feeds exist; AR/AP/inventory/payroll/assets/loans/tax as readiness warnings + manual checklist evidence until feeds deepen.

## 13–22. Exceptions, adjustments, accruals, depreciation, inventory, bad debts, loans, tax, FX

- Exceptions entity + statuses implemented.
- Year-end adjustments reuse Adjustment journals (`AUDIT_ADJUSTMENT` / existing categories) through Posting Engine; specialized accrual UIs can extend without new posting paths.
- Depreciation / inventory / bad debt / loan interest / tax provision / FX: controlled through existing modules + checklist gates; no plug journals.

## 23–24. Adjusted TB / final FS

ATB = Trial Balance after posted YE adjustments (canonical `generateTrialBalance`). Final FS remain Phase 7 reporting engines on posted lines.

## 25–41. Closing method, temps, batch, preview, posting, RE/CYE/drawings/dividends

- Methods: Income Summary→RE, Direct→RE, Owner Capital, Partner allocation, Fund balance.
- Temporary accounts from CoA category/subtype metadata.
- Preview checksum invalidates approval on data change.
- Posting: draft Adjustment → approve → `postManualJournal` → Posting Engine.
- Drawings close to capital; dividends not closed as expenses; capital not as revenue.
- MODEL A CYE: single transfer in Closing Batch.

## 42–50. PCTB, carry-forward, next year, snapshots, close pack, FY closure, closed-year controls

- PCTB validates temps/drawings zero and TB balance.
- Carry-forward: continuous GL reporting balances only.
- Next FY via Phase 8 `createFinancialYear` / `openFinancialYear` when configured.
- Snapshots: PCTB, closing batch, checklist, run summary.
- Close pack: snapshot package (PDF/Excel renderer deferred polish).
- FY → CLOSED atomically after PCTB + snapshots; period resolution already rejects closed-FY ordinary postings.

## 51–53. Reopen, impact, reversal, reclose

`reopenService`: impact analysis, SoD on approve, SUPERSEDE prior close version, new close run. Closing journal reversal is explicit (never delete originals).

## 54–59. UI, APIs, security, audit, observability, migration

- UI: `/accounting-close`
- APIs: `/api/accounting-close/**`
- Permissions: `accountingClose.*`
- Flags: `CLOSE_FLAGS`
- Audit: `closev2.*` actions
- Legacy strategy documented

## 60–67. Tests, performance, rollout, remaining exceptions, Phase 13/14, deploy/verify/rollback

- Unit tests: `test/accountingClose.domain.test.js`, `test/accountingClose.moduleAndPack.test.js`
- Module close checks wired (AR/AP/equity live; inventory/payroll/assets/loans/tax heuristics)
- Annual Close Pack JSON + Excel export
- Explicit Closing Journal reversal via Posting Engine
- Pilot close on production-like data still required before broad flag enablement
- See `PHASE_13_READINESS.md`, `PHASE_14_READINESS.md`, `ROLLBACK_STRATEGY.md`

## Confirmations

1. Closing Journals use the centralized Posting Engine.
2. Closing Journals are balanced in preview and immutable once posted (engine rules).
3. Balance Sheet accounts are not closed to zero.
4. Current Year Earnings is not duplicated (MODEL A + single transfer).
5. Retained Earnings updated once via Closing Batch transfer.
6. Capital contributions are not treated as Revenue in close.
7. Drawings and Dividends excluded from operating Expense closure.
8. No duplicate opening journal under continuous ledger.
9. No posted journal delete/modify path in close services.
10. No Suspense plug journals created.
11. Cross-business IDs rejected via tenant-scoped queries + route guard.
