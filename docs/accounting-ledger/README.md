# Phase 5 — Journal Entry and General Ledger Reimplementation

Phase 5 establishes one canonical, immutable, traceable journal structure and
rebuilds the General Ledger as a controlled query service derived exclusively
from valid posted journal lines (ADR-001, ADR-011). The GL is no longer an
independent record: every balance on every surface is computed from the same
canonical line source with the same authority rules.

## Code map

| Area | Path |
| --- | --- |
| Canonical journal source (authority rules) | `lib/accountingV2/ledger/canonicalJournalSource.js` |
| GL query engine (opening/movement/closing/running/hierarchy) | `lib/accountingV2/ledger/ledgerQueryService.js` |
| Journal query service (canonical browsing + lineage) | `lib/accountingV2/ledger/journalQueryService.js` |
| Integrity rule catalogue + checks | `lib/accountingV2/ledger/integrityRules.js` |
| Ledger projection rebuild | `lib/accountingV2/ledger/ledgerRebuildService.js` |
| Ledger reconciliation | `lib/accountingV2/ledger/ledgerReconciliationService.js` |
| V2 journal reversal workflow | `lib/accountingV2/application/journalReversalService.js`, `REVERSAL_JOURNAL` template in `lib/accountingV2/templates/pilotTemplates.js` |
| Reversal linkage persistence | `linkReversalToOriginal` in `lib/accountingV2/engine/journalPersistence.js` |
| Ledger APIs | `app/api/accounting-v2/ledger/**` |
| GL V2 UI | `app/general-ledger-v2/page.js` |
| Migration (columns, projection table, DB triggers) | `prisma/migrations/20260720200000_acctv2_ledger/migration.sql` |
| Tests | `test/accountingV2.ledger.test.js` |

## Document index

| Document | Contents |
| --- | --- |
| `PHASE_1_TO_4_EVIDENCE_INDEX.md` | Binding findings and decisions from Phases 1–4 |
| `CURRENT_JOURNAL_AND_LEDGER_ARCHITECTURE.md` | Pre-Phase-5 inventory of the dual-ledger system |
| `PHASE_5_TASKS.md` | Workstream plan and completion status |
| `CANONICAL_JOURNAL_MODEL.md` | Canonical journal entry/line structure, statuses, immutability, lineage |
| `CANONICAL_JOURNAL_AUTHORITY_RULES.md` | The single union rule deciding which lines count |
| `GENERAL_LEDGER_QUERY_ARCHITECTURE.md` | Balance math, normal balance, hierarchy, reversals, dimensions, currency |
| `GENERAL_LEDGER_READ_MODEL_DECISION.md` | Direct query vs stored read model decision |
| `LEDGER_REBUILD_AND_RECONCILIATION.md` | Projection rebuild + reconciliation services |
| `JOURNAL_AND_LEDGER_INTEGRITY_RULES.md` | JRN-1xx / GL-1xx rule catalogue |
| `JOURNAL_AND_LEDGER_API.md` | API routes, exports, UI, security, audit, observability |
| `MIGRATION_VALIDATION.md` | Migration + database-trigger validation evidence |
| `PERFORMANCE_VALIDATION.md` | Query strategy and performance notes |
| `PHASE_6_READINESS.md` | Historical repair inventory for Phase 6 |
| `PHASE_7_READINESS.md` | Contracts and blockers for the reporting rewrite |
| `FINAL_PHASE_5_REPORT.md` | Complete phase report |
