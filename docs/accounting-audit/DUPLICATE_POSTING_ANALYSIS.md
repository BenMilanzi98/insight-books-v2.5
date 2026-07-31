# Duplicate Posting Analysis

Run: `npm run audit:forensic -- --module journals` (JRN-006 grouping) + code inspection.
Artifact: `artifacts/accounting-audit/findings-latest.csv` (suspected-duplicate rows carry
rule JRN-006 / CAP-001 with per-source evidence).

## Detection method

Duplicates are **never** identified by amount alone. The engine groups posted, non-reversal
journals by `(tenantId, sourceType, sourceId)` on both ledgers; capital duplicates additionally
match per-equity-account source groups (CAP-001). Confidence tiers: confirmed / highly likely /
possible / requires review.

## Current-data results

| Ledger | Duplicate source groups |
|---|---|
| Transaction | **0** |
| JournalEntry | 1 group — `manual_journal:QA-manual-journal` ×3 (two **Draft** + one Posted → not an economic duplicate; flagged `possible` for review) |

## Technical causes present in the codebase (ranked)

| # | Cause | Status | Evidence |
|---|---|---|---|
| 1 | **TOCTOU race in duplicate check** — `assertNoDuplicatePostedSource` counts then inserts without a DB constraint or serialization | **Confirmed structural** | `lib/accountingMappingRules.js:320`; no unique index on `(tenantId, sourceType, sourceId)` |
| 2 | **Caller-supplied `sourceId` conventions** — different call sites use row ids, external keys, or auto-generated references; two paths posting the same business event under different keys defeat the check entirely | **Confirmed** | Observed: sale `QA-S02-SALE` posted under `sourceId='QA-pos-mobile-money'` |
| 3 | `skipDuplicateCheck: true` escape hatch | Confirmed available | `postGlEntry` parameter; used by batch/legacy paths |
| 4 | **Two ledgers**: the same business event posted once to `Transaction` and once to `JournalEntry` would not be seen as a duplicate by either check | Confirmed structural | dual-ledger architecture; supplier bills reference `journalEntryId` while GL posts `Transaction` |
| 5 | Creation-handler *and* approval-handler posting | Present risk in bill finalize / expense approval flows | posting matrix (`ACCOUNTING_POSTING_MATRIX.md`) |
| 6 | Import/seeder/backfill reruns (`scripts/sync-existing-data-to-accounts.js`, `backfill-legacy-gl.cjs`) | Confirmed tooling exists; idempotency varies per script | `scripts/` inventory |
| 7 | Frontend double-click / API retry | Mitigated only by cause #1's racy check | no idempotency-key middleware found |
| 8 | Reversal followed by accidental repost | Possible — after reversal, `assertNoDuplicatePostedSource` still counts the original posted row, **blocking** repost (safe), but paths using `skipDuplicateCheck` bypass this | code reading |

## Phase 2 recommendations (no action taken now)

1. Partial unique index: `(tenantId, sourceType, sourceId) WHERE status='posted' AND "isReversal"=false`.
2. Enforce `sourceId = source-row primary key` convention; migrate caller-key rows.
3. Remove/gate `skipDuplicateCheck`.
4. Single-ledger consolidation (see backlog P0-1).
