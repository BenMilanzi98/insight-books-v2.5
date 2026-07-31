# Fresh-Books V2 Cutover — Phase 6 Evidence

**Date:** 2026-07-24

## Decisions locked

- `NEW_ENGINE` / `executePosting` is the only posting authority.
- `JournalEntry` / `JournalEntryLine` are financial SoT (not `Transaction` / `Account.balance`).
- CoA purpose resolution uses canonical mappings (`coaV2CanonicalMappings` ON).

## Verification gates

| Gate | Mechanism |
| --- | --- |
| No active `await postGlEntry(` / `return postGlEntry(` in `app/api` + `lib` | `scripts/forbid-legacy-gl-writers.cjs` + `test/accountingV2.freshBooksCutover.test.js` |
| No `transaction.create(` outside allowlist | Same script (allow: `postGlEntry.js` dead body, `purchaseAccounting.js` dead body after throw) |
| No `updateAccountBalanceOnTransaction(` outside allowlist | Same script (definition throws `LEGACY_BALANCE_MUTATION_DISABLED`) |
| Sale / invoice / tax auto-post stubs | Source contains `LEGACY_POSTING_REMOVED` |

## Runtime fail-closed

- `lib/accountingEngine/postGlEntry.js` → `LEGACY_POSTING_REMOVED`
- `lib/accountBalanceService.js` → `LEGACY_BALANCE_MUTATION_DISABLED`
- `createSaleJournalEntries` / `createInvoiceJournalEntry` / `autoPostTaxEntry` → `LEGACY_POSTING_REMOVED`

## Reset script

`scripts/fresh-books-v2-reset.js --confirm` now upserts for tenant `*`:

- `accountingV2Enabled` = true
- `coaV2CanonicalMappings` = true

## Gap register updates (2026-07-24)

| ID | State |
| --- | --- |
| FSA-GAP-001 | CLOSED/REMEDIATED |
| FSA-GAP-009 | CLOSED/REMEDIATED |
| DUP-GL-001 | CLOSED/REMEDIATED |

## Unlinked-CoA data purge (local) — 2026-07-25

```bash
node --import ./scripts/registerAliasLoader.mjs scripts/purge-unlinked-coa-data.mjs --confirm
```

- Linked 4 PaymentAccount rows to CoA `1110`
- Deleted 19 archive `Transaction` (+ lines)
- Cleared `AccountBalance*` / zeroed `Account.balance`
- Active payment accounts with null CoA link: **0**

## Wipe executed (local) — 2026-07-24

```
Before: { journalEntries: 0, journalLines: 0, events: 2, transactions: 19 }
After:  { journalEntries: 0, journalLines: 0, events: 0, transactions: 19, accountsZeroed: 543 }
Transaction archive preserved.
```

Purpose mappings backfilled via:

```bash
node --import ./scripts/registerAliasLoader.mjs scripts/coa-v2-backfill-purpose-mappings.mjs --apply
```

## How to re-run

```bash
node scripts/forbid-legacy-gl-writers.cjs
npm test -- test/accountingV2.boundaries.test.js test/accountingV2.freshBooksCutover.test.js
node --import ./scripts/registerAliasLoader.mjs scripts/coa-v2-backfill-purpose-mappings.mjs --dry-run
```
