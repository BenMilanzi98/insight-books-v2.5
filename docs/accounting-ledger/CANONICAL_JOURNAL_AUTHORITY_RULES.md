# Canonical Journal Authority Rules

One module — `lib/accountingV2/ledger/canonicalJournalSource.js` — defines
which posted lines are authoritative. Every ledger balance, account activity
view, export and reconciliation derives from it, so the same economic event
can never be counted zero or two times depending on which screen is open.

## The union

| Class | Tables | Inclusion rule |
| --- | --- | --- |
| A. Legacy operational ledger | `Transaction` + `TransactionLine` | `Transaction.status` in posted family (`posted`/`Posted`/`POSTED` — historical casing drift tolerated on read, never written) |
| B. Journal ledger | `JournalEntry` + `JournalEntryLine` | Status in `Posted`/`posted`/`POSTED`/`Reversed`/`PartiallyReversed` **and** `transactionId IS NULL` |

Class B covers both legacy manual journals and V2 engine journals
(`architectureVersion = 'ACCOUNTING_V2'`).

## Why `transactionId IS NULL` is the mirror-exclusion rule

Several legacy flows (e.g. `purchaseAccounting.js`) write a `Transaction` and
a mirroring `JournalEntry` with `transactionId` set. Class A already counts
the transaction's lines, so mirrored journals are excluded — exactly once, by
one rule, applied identically on every surface. Before Phase 5 the GL screen
applied this rule but the GL export did not (double-counting defect P5-I01,
fixed in `app/api/general-ledger/export/route.js`).

## Deliberate consequences

- **Header-amount journals** (legacy `JournalEntry` rows with amounts on the
  header `debit`/`credit` floats and zero lines) contribute **nothing** to any
  balance. They are surfaced as JRN-104 integrity findings for Phase 6 repair,
  never silently added — adding them would change historical reports that
  excluded them.
- **Reversals** are ordinary posted entries. Original and reversal both appear
  and net to zero; nothing is hidden from the ledger (presentation-level
  pair-collapsing is a display option only).
- **Shadow journals** (`AcctV2ShadowJournal*`) are structurally excluded —
  different tables, never unioned.
- **Authority conflicts** — a journal that both mirrors a transaction *and*
  carries its own differing lines — are detected (`findAuthorityConflicts`)
  and reported as GL-117 findings; the transaction side stays authoritative.

## Date semantics

- Class A filters on `Transaction.date` (legacy semantics: economic and
  posting date are the same column).
- Class B filters on `postingDate` when present (V2), falling back to
  `entryDate` for legacy rows — explicitly, not by accident of which column a
  given surface happened to pick.

## Arithmetic

All aggregation converts Decimal values to **integer minor units**
(`parseDecimalToMinor`) before summation (ADR-006). No floats anywhere in the
canonical pipeline. DB-side `groupBy` sums are used for totals; the service
re-validates the projection against these sums before trusting it.

## What is forbidden

- Reading `Account.balance` or `AccountBalance` for any ledger figure
  (GL-118; enforced by architecture tests).
- Per-surface dedup rules, per-surface status filters, account-code-range
  heuristics.
- Falling back to operational tables (invoices, payments, stock) for GL
  amounts (ADR-012).
