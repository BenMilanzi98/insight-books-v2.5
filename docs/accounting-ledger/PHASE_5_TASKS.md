# Phase 5 Implementation Plan — Journal Entry and General Ledger Reimplementation

Status values: PLANNED / IN_PROGRESS / COMPLETE / DEFERRED.
Standing risks for all workstreams: shared `JournalEntry` table serves legacy +
V2 rows (additive changes only); no historical amounts may change.

| WS | Workstream | Status | Depends on | Files affected | DB changes | Tests | Evidence / completion notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | Previous-phase evidence review | COMPLETE | — | `PHASE_1_TO_4_EVIDENCE_INDEX.md` | — | — | 10 Phase 1 findings + 5 fresh inspection defects + binding ADRs indexed |
| B | Current journal implementation analysis | COMPLETE | — | `CURRENT_JOURNAL_AND_LEDGER_ARCHITECTURE.md` | — | — | Write paths, statuses, deletes, cascades inventoried |
| C | Current General Ledger analysis | COMPLETE | — | same doc | — | — | Five read surfaces with four dedup rules documented |
| D | Canonical Journal Entry model | COMPLETE | A–C | `prisma/schema.prisma` | Additive: reversal linkage (`originalJournalId`, `reversedByJournalId`, `reversalStatus`, `reversedAt`, `reversedById`), `sourceNumber`, indexes | Model tests | Existing Phase 4 columns cover the rest; totals validated at posting |
| E | Canonical Journal Entry Line model | COMPLETE | D | schema | No new columns (Phase 4 added base amounts/currency/tax/dimensions); index `[accountId, journalEntryId]` | Line-structure tests | `lineNumber` = deterministic sequence |
| F | Journal lineage | COMPLETE | D | `lib/accountingV2/ledger/journalQueryService.js` | — | Lineage tests | Journal ↔ event ↔ source both directions; legacy rows flagged `lineageReliable:false` where source key unverifiable |
| G | Journal status + immutability | COMPLETE | D | DB trigger migration; Phase 4 `journalStatus.js` reused | Trigger: block DELETE of Posted journals; block financial-column UPDATE on Posted V2 journals + lines | Immutability tests | App + repository + API + DB layers |
| H | Journal repository | COMPLETE | G | Phase 4 `journalPersistence.js` + `manualJournalService.js` (already restricted) | — | Contract tests | No update/delete of posted rows exposed; boundary test extended |
| I | Journal Query Service | COMPLETE | F | `lib/accountingV2/ledger/journalQueryService.js` | — | Query/filter tests | Canonical union list + detail, full filter set, stable ordering, DB-side pagination |
| J | Journal UI | COMPLETE | I | `app/journal-entries/*` uses legacy API (unchanged); V2 journal detail available via `/api/accounting-v2/journals`; canonical explorer via ledger UI | — | — | Full legacy journal-UI rebuild deferred to cutover stage (flag-gated); canonical data exposed through new APIs |
| K | GL query architecture | COMPLETE | A–C | `lib/accountingV2/ledger/canonicalJournalSource.js`, `ledgerQueryService.js` | — | Source inclusion/exclusion tests | Single canonical line source; one dedup/authority rule |
| L | Opening balance calculation | COMPLETE | K | `ledgerQueryService.js` | — | Opening tests | Net posted activity before start date; integer-cent math |
| M | Period movement calculation | COMPLETE | K | same | — | Movement tests | Raw debit/credit preserved |
| N | Closing balance calculation | COMPLETE | L, M | same | — | Closing tests | Opening + debits − credits; abnormal flagged |
| O | Running balance calculation | COMPLETE | K | same | — | Running/pagination tests | Deterministic order: postingDate, postedAt, journalNumber, entryId, lineNumber, lineId; page opening carried |
| P | Normal-balance presentation | COMPLETE | K | same | — | Presentation tests | CoA V2 → legacy `normalBalance` → category default; abnormal-balance warning |
| Q | Account hierarchy handling | COMPLETE | K | `ledgerQueryService.js` hierarchy options | — | Hierarchy tests | Posting accounts authoritative; parents presentation-only; direct header activity = anomaly; merge-survivor rollup preserved |
| R | Dimension filtering | COMPLETE | K | line `dimensions` JSON + legacy branch | — | Dimension tests | Branch native; V2 dimensions from JSON; legacy rows → `UNASSIGNED` + integrity flag |
| S | Multi-currency support | COMPLETE | K | base amounts on V2 lines | — | Currency tests | Base-currency ledger default; foreign detail preserved; no retroactive conversion |
| T | Reversal handling | COMPLETE | D, K | reversal linkage + `reversalService` reuse | — | Reversal tests | Both rows posted; net zero after reversal date; filters (show all / pairs / hide-pairs presentation) |
| U | Legacy compatibility | COMPLETE | K | normalization inside `canonicalJournalSource.js` + `journalQueryService.js` (no separate normalizer module) | — | Normalization tests | Legacy Transaction + legacy JE normalized to canonical contract with warnings; no rewriting |
| V | Ledger read model | COMPLETE | K | `GENERAL_LEDGER_READ_MODEL_DECISION.md`; `AcctV2LedgerBalance` summary projection | New table `AcctV2LedgerBalance` (versioned, rebuildable) | Projection tests | Decision: direct indexed query authoritative (Option A) + rebuildable monthly summary cache (non-authoritative) |
| W | Ledger rebuild service | COMPLETE | V | `lib/accountingV2/ledger/ledgerRebuildService.js` + API | — | Rebuild tests | Per business/year/period/account; dry-run; validate-before-swap; versioned rows |
| X | Ledger reconciliation service | COMPLETE | K, V | `lib/accountingV2/ledger/ledgerReconciliationService.js` + API | — | Reconciliation tests | Canonical lines vs projection vs stored `Account.balance` vs legacy TB output |
| Y | Journal + ledger exports | COMPLETE | I, K | `/api/accounting-v2/ledger/export`; legacy GL export aligned (P5-I01 fix) | — | Export-consistency tests | Same query contract as screen; CSV formula-injection protection |
| Z | Security + permissions | COMPLETE | all | `lib/accountingV2/permissions.js` + route guards | — | Security tests | New `ledger.*` + `journals.*` keys; business scope everywhere |
| AA | Audit + observability | COMPLETE | W, X | audit trail + `accountingLogger` metrics | — | — | Rebuild/reconcile/export audited; ledger metrics |
| AB | Integrity monitoring | COMPLETE | X | `lib/accountingV2/ledger/integrityRules.js` | — | Rule tests | JRN-101…110 + GL-110…118 catalogue |
| AC | Database migration | COMPLETE | D, E, G, V | `prisma/migrations/*_acctv2_ledger` | Additive columns, indexes, table, triggers | Migration validation | Deployed + status clean |
| AD | Performance optimization | COMPLETE | K | indexes; DB-side groupBy; paginated lines | — | Perf notes | No full-line loads; documented in `PERFORMANCE_VALIDATION.md` |
| AE | Automated testing | COMPLETE | all | `test/accountingV2.ledger.test.js` + stub extensions | — | — | Suites 52.1–52.13 mapped |
| AF | Production-like validation | COMPLETE | AC, AE | migration deploy + full test run + build | — | — | Results in `MIGRATION_VALIDATION.md` / final report |
| AG | Phase 6 readiness | COMPLETE | X | `PHASE_6_READINESS.md` | — | — | Historical repair inventory by category |
| AH | Phase 7 readiness | COMPLETE | K–S | `PHASE_7_READINESS.md` | — | — | TB/report contracts + blockers |
| AI | Final report | COMPLETE | all | `FINAL_PHASE_5_REPORT.md` | — | — | — |

## Deferred work (explicitly out of Phase 5)

- Historical repair of duplicates, header-amount journals, unsupported
  balances, missing dimensions → Phase 6 (inventoried in readiness doc).
- Trial Balance / financial statement rewrite onto the new engine → Phase 7.
- Full legacy Journal Entries UI replacement → cutover stage after pilot
  validation (data available now via canonical APIs).
- Receivables/Payables subledger reimplementation → Phase 9 (compatibility
  queries only in Phase 5).
- Retirement of `Account.balance` / `AccountBalance` caches → Phase 6.
