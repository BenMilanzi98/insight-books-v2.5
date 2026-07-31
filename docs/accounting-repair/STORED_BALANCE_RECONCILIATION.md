# Stored Balance Reconciliation

## Stored balance surfaces located

`Account.balance`, `Account.openingBalance` (Chart of Accounts), plus module
caches: customer/supplier balance fields and legacy report caches. The canonical
ledger (Phase 5 authority rules) reads **only** posted journal lines; stored
fields are already non-authoritative there.

## Detection

`P6-BAL-*` (via Phase 5 `runLedgerReconciliation`, rule GL-111): stored
`Account.balance` compared to the canonical journal-derived balance per account,
per business, in minor units. Differences are `STORED_BALANCE_DIFFERENCE`
anomalies, CONFIRMED (measured), with the exact delta as evidence.
`P6-OPEN-001` covers the stored-opening-plus-journal case.

## Classification and treatment

| Class | Treatment |
|---|---|
| Exact match | No action; field may be kept as a rebuildable cache. |
| Stale cache | Rebuild from canonical journals (`PROJECTION_REBUILD` semantics); never the reverse. |
| Duplicate source (stored + journal both counted) | Exclude the field from authoritative reporting (`REPORT_ONLY_REPAIR`); keep as legacy metadata. |
| Unsupported opening/manual value | Evidence → `MISSING_JOURNAL_REPAIR`; no evidence → exception. Never silently included. |
| Business/period/currency scope error | Fix the query scope (`REPORT_ONLY_REPAIR`). |

Hard rules (all enforced): canonical journals stay authoritative; journals are
never created or modified to match a cache; independent stored financial fields
are deprecated for authoritative use but preserved for audit.

## Dev-dataset result

Two `STORED_BALANCE_DIFFERENCE` anomalies (QA-Accounting: equity `3102` and
account `1110`), both explained by header-only legacy journals / stored values
without line support — feeding the capital discrepancy resolution. All other
accounts reconcile exactly.
