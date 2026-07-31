# Journal and Ledger Integrity Rules

Machine-readable catalogue in `lib/accountingV2/ledger/integrityRules.js`
(`INTEGRITY_RULES`). Executable checks return findings with rule code,
severity, affected records and measured amounts — never silent corrections.

## Journal structure rules (JRN-1xx)

| Rule | Severity | Invariant |
| --- | --- | --- |
| JRN-101 | CRITICAL | V2 journal header totals equal the sum of its lines |
| JRN-102 | CRITICAL | Posted journal is balanced: total debits = total credits |
| JRN-103 | HIGH | Posted journal carries a resolvable posting date |
| JRN-104 | HIGH | Posted journal has at least two lines; header-amount rows are outside the ledger |
| JRN-105 | HIGH | A line never carries both a debit and a credit, and is never zero on both sides |
| JRN-106 | MEDIUM | Journal status uses the canonical vocabulary and casing |
| JRN-107 | HIGH | Reversal links to its original; reversed original links back |
| JRN-108 | MEDIUM | Source link (sourceType + sourceId) identifies a real document for operational journals |
| JRN-109 | CRITICAL | V2 posted journal carries an accounting event identity |
| JRN-110 | HIGH | Line sequence numbers within a journal are unique |

## Ledger consistency rules (GL-1xx)

| Rule | Severity | Invariant |
| --- | --- | --- |
| GL-110 | HIGH | Header/non-posting accounts carry no direct posted activity |
| GL-111 | HIGH | Stored `Account.balance` equals the canonical derived balance (cache drift) |
| GL-112 | CRITICAL | Business-wide canonical debits equal credits for any window |
| GL-113 | CRITICAL | Posted lines reference accounts that exist in the business chart |
| GL-114 | HIGH | Ledger projection rows match canonical totals (stale read model) |
| GL-115 | MEDIUM | Every screen/export surface uses the canonical query engine (surface comparison + architecture tests) |
| GL-116 | MEDIUM | Merged-away accounts accept no new postings |
| GL-117 | CRITICAL | One economic event is never counted by both ledgers (authority conflict) |
| GL-118 | HIGH | Ledger surfaces never read stored balance caches (architecture tests) |

## Execution

- `runJournalIntegrityChecks(db, context, {startDate, endDate, limit})` —
  journal-structure checks (JRN-1xx) plus header-only-journal (JRN-104) and
  authority-conflict (GL-117) detection from the canonical source module.
- `runLedgerReconciliation` — the ledger-consistency checks (see
  `LEDGER_REBUILD_AND_RECONCILIATION.md`).
- Rules GL-115/GL-118 are additionally enforced structurally by the
  architecture boundary tests in `test/accountingV2.boundaries.test.js`.

## Monitoring

The feature flag `accountingV2LedgerIntegrityMonitoring` gates scheduled
monitoring; on-demand runs are available through the reconciliation API to
holders of `ledger.reconcile` / `ledger.viewIntegrity`. Findings do not block
reads (availability), but posting-time validation blocks new violations at
the source (prevention); persisted findings inventory feeds Phase 6 repair.
