# Canonical Journal Entry and Line Model

The canonical journal store is the shared `JournalEntry` / `JournalEntryLine`
table pair. Phase 4 added the V2 posting columns; Phase 5 finalizes the model
with reversal lineage and database-level immutability. All changes are
additive — no legacy column was renamed, retyped, or removed.

## Journal Entry (header)

| Concern | Fields | Notes |
| --- | --- | --- |
| Identity | `id`, `journalNumber` (unique per tenant), `accountingEventId` (unique) | Numbering is prefix + FY + sequence, concurrency-safe (`AcctV2JournalSequence`) |
| Business scope | `tenantId` | Required for posted V2 journals (CHECK `je_v2_posted_requirements`) |
| Dates | `entryDate` (economic), `postingDate` (period-determining), `postedDate`, `createdAt` | V2 journals always carry `postingDate`; legacy rows may only have `entryDate` |
| Period | `accountingPeriodId`, `financialYearLabel` | Resolved server-side at posting |
| Classification | `entryType` (`Regular`, `Adjustment`, `Opening`, `Reversal`, …), `adjustmentCategory`, `adjustmentReason` | |
| Totals | `totalDebit`, `totalCredit` (Decimal 18,2) | Must equal line sums (JRN-101) |
| Currency | `currency`, `exchangeRate`, `baseCurrency` | Base amounts on lines |
| Source lineage | `sourceType`, `sourceId`, `sourceNumber` (Phase 5), `accountingEventId`, `templateId`, `templateVersion` | Journal → event → source document, both directions |
| Reversal lineage (Phase 5) | `reversalStatus` (`REVERSAL` on the reversing journal, `REVERSED` on the original), `originalJournalId`, `reversedByJournalId`, `reversedAt`, `reversedById` | Bidirectional links written atomically inside the reversal's posting transaction |
| Status | `status` | Lifecycle governed by `lib/accountingV2/domain/journalStatus.js` |
| Authorship | `createdById`, `postedById`, `approvedById`, `approvedAt` | Separation of duties enforced by approval validation |
| Architecture marker | `architectureVersion` (`LEGACY_V1` default, `ACCOUNTING_V2`) | Decides which immutability regime applies |

## Journal Entry Line

| Concern | Fields | Notes |
| --- | --- | --- |
| Identity/order | `id`, `journalEntryId`, `lineNumber` | `lineNumber` is a deterministic sequence, unique per journal (JRN-110) |
| Account | `accountId` | Must exist, belong to the business, and allow posting at post time |
| Amounts | `debitAmount`, `creditAmount` (Decimal 18,2) | Exactly one side non-zero (JRN-105) |
| Currency | `currency`, `baseDebit`, `baseCredit` | Transaction amounts plus base-currency amounts; no retroactive conversion |
| Dimensions | `dimensions` (JSON), plus header `branchId` | Legacy rows without dimensions surface as `UNASSIGNED` |
| Narrative | `description` | |

## Status and immutability

Posted V2 journals are immutable at four layers:

1. **Domain**: `journalStatus.js` only permits forward transitions
   (`Posted → Reversed / PartiallyReversed`); financial edits are rejected.
2. **Repository**: `journalPersistence.js` exposes no update/delete of posted
   rows. The only sanctioned updates are the notes annotation and
   `linkReversalToOriginal` (reversal linkage + `Posted → Reversed`).
3. **API**: legacy journal routes refuse to touch V2 rows; V2 routes only act
   on drafts.
4. **Database** (Phase 5 triggers, validated live — see
   `MIGRATION_VALIDATION.md`):
   - `je_block_posted_delete` — no posted journal (any architecture) can be
     hard-deleted.
   - `je_v2_block_posted_update` — financial columns of posted V2 journals are
     frozen; status can never regress.
   - `jel_v2_block_posted_change` — lines of posted V2 journals cannot be
     updated or deleted.

Corrections happen exclusively through reversal or adjustment journals.

## Reversal treatment

- Reversing a posted V2 journal posts a **new** journal through the engine
  (`REVERSAL_JOURNAL` template): every line mirrored with debit/credit swapped,
  dimensions preserved, `entryType = 'Reversal'`, journal number prefix `REV`.
- Reversals always require approval and pass the same validation pipeline as
  any posting.
- The original stays in the ledger (status `Reversed`); original + reversal
  net to zero after the reversal date. Both directions are linked
  (`originalJournalId` / `reversedByJournalId`) atomically.
- A repeated reversal request replays idempotently (same event identity) and
  never creates a second reversal; the source validator additionally rejects
  already-reversed journals.
- Legacy reversals continue through the legacy reversal service; the V2
  workflow only accepts `architectureVersion = 'ACCOUNTING_V2'` journals.

## Lineage guarantees

For every V2 journal: journal → `accountingEventId` → `AcctV2EventRegistry`
row → source document (`sourceModule`/`sourceType`/`sourceId`), and back.
`journalQueryService.getCanonicalJournal` resolves this chain and flags legacy
rows whose source keys cannot be verified with `lineageReliable: false` —
never by guessing.
