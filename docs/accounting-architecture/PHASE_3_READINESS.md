# Phase 3 Readiness — Chart of Accounts Reconstruction

## What Phase 2 delivers to Phase 3

- `AccountBehaviour` / `AccountCategory` / `AccountNormalBalance` enums (single definitions).
- `AccountMappingService` contract with explicit-failure semantics
  (`MissingAccountMappingError`, `InactiveAccountError`, `NonPostingAccountError`) — Phase 3
  swaps the legacy-code backing for a configured, versioned, audited mapping registry without
  touching callers.
- The 18 legacy mapping keys inventoried in `legacyAccountMappingAdapter.js`
  (AR 1200, AP 2110, VAT out 2041 / in 1150, WHT 2045, PAYE 2130, salaries 5200, COGS 5100,
  capital 3100, OBE 3190, retained earnings 3200, revenue 4100/4150, cash 1110, bank 1130, …).
- Posting-account validation rule (header accounts with active children refuse postings).

## Inputs Phase 3 must gather (from Phase 1 artifacts + fresh production runs)

| Item | Source |
|---|---|
| Duplicate accounts (code/name/purpose collisions, COA-002) | `npm run audit:forensic:coa` + `artifacts/accounting-audit/accounts.csv` |
| Mapping conflicts (multiple resolvers → different accounts per purpose) | `CHART_OF_ACCOUNTS_FORENSIC_REPORT.md`; hardcoded-code sweep (R-15) |
| Historical activity per duplicate account | GL reconciliation CSVs; rerun ledger audit against production before any merge decision |
| System-account requirements | mapping keys above + Phase 4 template needs |
| Parent-child violations (postings to parents, COA-003) | audit engine findings |

## Migration blockers to clear

1. Legacy `Account.tenantId` is nullable; global template accounts exist — decide ownership
   before merges (R-17).
2. Duplicate `accountCode`/`code` field pair on `Account` — pick the canonical column and
   backfill the other before constraint tightening.
3. Accounts referenced by both ledgers (`TransactionLine` + `JournalEntryLine`) must be
   merge-mapped together, never independently.
4. Merges must be implemented as mapping-table redirects + reversal-style reclassification
   journals — **no row deletion** (`AcctV2EventRegistry` MIGRATION events give the audit trail).

## Approval decisions required before starting

- Canonical CoA blueprint per business type (owner sign-off).
- Handling of pre-blueprint tenants with repurposed codes.
- Whether inactive accounts with history are retired (behaviour flag) or merged.
