# Phase 4 Tasks — Central Accounting Posting Engine

Implementation plan and live status. Statuses: PLANNED → IN_PROGRESS → COMPLETE / DEFERRED(phase).

Common security implication for all workstreams: every read/write is business-scoped
through `AccountingContext`; no client-supplied tenant ids; typed errors only.

---

## A. Previous-phase evidence review
- **Status**: COMPLETE
- **Dependencies**: —
- **Files**: `docs/accounting-posting-engine/PHASE_1_TO_3_EVIDENCE_INDEX.md`
- **DB changes**: none
- **Tests**: n/a (documentation)
- **Risks**: missing a Phase 1 finding → control gap. Mitigated by indexing every Phase 1 doc.
- **Evidence**: PHASE_1_TO_3_EVIDENCE_INDEX.md (14 Phase 1 findings, 14 Phase 2 decisions, 9 Phase 3 decisions)
- **Completion notes**: no findings invented; every row cites its source document.

## B. Existing posting architecture analysis
- **Status**: COMPLETE
- **Dependencies**: A
- **Files**: `docs/accounting-posting-engine/CURRENT_POSTING_ARCHITECTURE.md`
- **DB changes**: none
- **Tests**: n/a
- **Risks**: unknown posting path bypasses the future guard. Mitigated by repo-wide searches (`journalEntry.create`, `postGlEntry`, `balance: { increment`, …).
- **Evidence**: CURRENT_POSTING_ARCHITECTURE.md — 18 `postGlEntry` call sites, 2 journal stores, 7 direct-balance-update routes.
- **Completion notes**: no posting function replaced before this analysis.

## C. Posting command contract
- **Status**: COMPLETE
- **Dependencies**: A, B
- **Files**: `lib/accountingV2/engine/postingCommand.js`, `lib/accountingV2/domain/errors.js` (`InvalidPostingCommandError`)
- **DB changes**: none
- **Security**: rejects client-supplied architecture overrides, posting modes, tenant ids.
- **Tests**: `test/accountingV2.engine.test.js` §command validation
- **Risks**: over-strict validation blocking legitimate pilots → covered by tests for every field.
- **Evidence**: POSTING_COMMAND_CONTRACT.md
- **Completion notes**: strict typed builder `createPostingCommand`; decimal-string money only; frozen output.

## D. Posting result contract
- **Status**: COMPLETE
- **Dependencies**: C
- **Files**: `lib/accountingV2/engine/postingResult.js`
- **DB changes**: none
- **Tests**: engine tests assert result shape for posted/replayed/shadow/failed paths
- **Risks**: leaking internals in results → result contains only safe fields.
- **Evidence**: POSTING_RESULT_CONTRACT.md
- **Completion notes**: idempotent retries return the original result with `wasExistingPosting: true`.

## E. Accounting event registry
- **Status**: COMPLETE
- **Dependencies**: C
- **Files**: `lib/accountingV2/domain/eventStatus.js`, `lib/accountingV2/infrastructure/eventRegistryRepository.js`, `prisma/schema.prisma` (`AcctV2EventRegistry` additive columns)
- **DB changes**: additive columns `approvalReference`, `approvedBy`, `templateId`, `templateVersion` on `AcctV2EventRegistry`
- **Tests**: status-transition tests; registry claim tests
- **Risks**: breaking Phase 2 status consumers → persisted values unchanged; transitions added on top.
- **Evidence**: ACCOUNTING_EVENT_REGISTRY.md
- **Completion notes**: transition map enforced server-side (`assertEventStatusTransition`).

## F. Source validation framework
- **Status**: COMPLETE
- **Dependencies**: C
- **Files**: `lib/accountingV2/engine/sourceValidation.js`
- **DB changes**: none
- **Tests**: manual-journal, opening-balance, adjustment, invoice validator tests incl. cross-tenant and already-posted cases
- **Risks**: operational adapters incomplete by design (Phase 9); framework + pilot validators only.
- **Evidence**: SOURCE_VALIDATION_FRAMEWORK.md
- **Completion notes**: typed validator registry; pilot validators: ManualJournal, Adjustment, OpeningBalance, Invoice (shadow pilot).

## G. Idempotency and concurrency protection
- **Status**: COMPLETE
- **Dependencies**: E
- **Files**: `lib/accountingV2/infrastructure/eventRegistryRepository.js`, `lib/accountingV2/engine/postingEngine.js`
- **DB changes**: existing unique constraints (Phase 2); new unique `JournalEntry.accountingEventId`
- **Tests**: sequential duplicate, concurrent duplicate (simulated race → P2002), conflicting hash, retry-after-failure, retry-after-success
- **Risks**: replay returning stale results → replay reads the linked journal in the same query.
- **Evidence**: IDEMPOTENCY_IMPLEMENTATION.md, CONCURRENCY_CONTROL.md
- **Completion notes**: DB uniqueness is the hard guard; no in-memory locks.

## H. Approval validation
- **Status**: COMPLETE
- **Dependencies**: C
- **Files**: `lib/accountingV2/engine/approvalValidation.js`
- **DB changes**: none (approval stored on journal + registry)
- **Security**: approval never trusted from the frontend; separation of duties enforced server-side.
- **Tests**: approval-required, self-approval rejection, approver-permission tests
- **Risks**: no legacy approval framework to integrate → engine-native policy documented.
- **Evidence**: APPROVAL_INTEGRATION.md
- **Completion notes**: adjustments and opening balances always require approval; manual journals per policy/flag.

## I. Account mapping resolution
- **Status**: COMPLETE
- **Dependencies**: Phase 3
- **Files**: `lib/accountingV2/engine/templateContext.js` (mapping resolution glue)
- **DB changes**: none
- **Tests**: missing mapping, deprecated/inactive/header mapped account, cross-business account
- **Risks**: fallback logic sneaking in → forbidden by tests; only `resolvePurposeAccount`.
- **Evidence**: ACCOUNT_MAPPING_INTEGRATION.md
- **Completion notes**: templates declare purposes; resolution errors are non-retryable.

## J. Period resolution
- **Status**: COMPLETE
- **Dependencies**: —
- **Files**: `lib/accountingV2/engine/periodResolution.js`
- **DB changes**: none (uses current `accountingPeriod` table)
- **Tests**: open, closed, backdated (permission), future-dated, unconfigured-period policy
- **Risks**: Phase 8 will replace the resolver → engine consumes it behind one function.
- **Evidence**: PERIOD_RESOLUTION_INTEGRATION.md
- **Completion notes**: closed periods reject with `ClosedAccountingPeriodError`; no silent allow in strict mode.

## K. Posting-template framework
- **Status**: COMPLETE
- **Dependencies**: C, I
- **Files**: `lib/accountingV2/templates/templateRegistry.js`, `lib/accountingV2/templates/definitions.js`
- **DB changes**: none (code-versioned templates; id+version stored on journals)
- **Tests**: registry versioning, template lookup, unsupported event
- **Risks**: silent template edits → version bump policy + architecture test on catalogue hash.
- **Evidence**: POSTING_TEMPLATE_FRAMEWORK.md, POSTING_TEMPLATE_CATALOGUE.md
- **Completion notes**: 23 templates in catalogue; 3 fully implemented pilots (manual, adjustment, opening balance) + invoice shadow pilot; 19 DEFINED for Phase 9.

## L. Journal draft generation
- **Status**: COMPLETE
- **Dependencies**: K
- **Files**: `lib/accountingV2/templates/*.js`, reuses `domain/journalDraft.js`
- **DB changes**: none
- **Tests**: draft generation per pilot template; balanced enforcement
- **Risks**: drafts persisting directly → templates return frozen drafts; persistence only via engine.
- **Evidence**: JOURNAL_DRAFT_GENERATION.md
- **Completion notes**: drafts carry template id/version/architecture version in metadata.

## M. Journal validation
- **Status**: COMPLETE
- **Dependencies**: F–L
- **Files**: `lib/accountingV2/engine/validationPipeline.js`, `lib/accountingV2/engine/accountValidation.js`
- **DB changes**: none
- **Tests**: pipeline order determinism, every rejection class
- **Risks**: order-dependent behaviour → stages are a fixed ordered list.
- **Evidence**: JOURNAL_VALIDATION_PIPELINE.md, ACCOUNT_VALIDATION.md
- **Completion notes**: 12 deterministic stages; structured `PostingValidationIssue[]` output.

## N. Atomic persistence
- **Status**: COMPLETE
- **Dependencies**: M
- **Files**: `lib/accountingV2/engine/journalPersistence.js`, `lib/accountingV2/engine/postingEngine.js`
- **DB changes**: additive `JournalEntry`/`JournalEntryLine` columns (see AC)
- **Tests**: rollback on line failure, on source-update failure, on outbox failure; no partial effects
- **Risks**: partial writes → single `runInAccountingTransaction`; failure recording outside the failed transaction is sanitized.
- **Evidence**: ATOMIC_PERSISTENCE.md
- **Completion notes**: claim → validate → journal → lines → statuses → audit → outbox → result in one transaction.

## O. Journal numbering
- **Status**: COMPLETE
- **Dependencies**: N
- **Files**: `lib/accountingV2/engine/journalNumbering.js`, `prisma/schema.prisma` (`AcctV2JournalSequence`)
- **DB changes**: new table `AcctV2JournalSequence` (tenant + scope unique)
- **Tests**: sequential allocation, per-scope isolation, concurrency behaviour (row-lock increment)
- **Risks**: gaps after rollback (accepted and documented — numbers not reused).
- **Evidence**: JOURNAL_NUMBERING.md
- **Completion notes**: format `{prefix}-{year}-{seq6}`; prefix per event class (MJ/ADJ/OB/JE).

## P. Source status transition
- **Status**: COMPLETE
- **Dependencies**: E, N
- **Files**: `lib/accountingV2/engine/sourcePostingState.js`
- **DB changes**: none — the event registry is the central source-link table (decision documented)
- **Tests**: derived state per registry status; failed posting leaves source unposted
- **Risks**: per-table `posted` flags drifting → V2 sources read state through this service.
- **Evidence**: SOURCE_POSTING_STATUS.md
- **Completion notes**: statuses NOT_READY/READY_TO_POST/POSTING/POSTED/POSTING_FAILED/REVERSED/CANCELLED_BEFORE_POSTING derived + stored on registry.

## Q. Audit trail
- **Status**: COMPLETE
- **Dependencies**: N
- **Files**: `lib/accountingV2/infrastructure/auditTrail.js` (extended actions), engine call sites
- **DB changes**: none (append-only `AuditLog`)
- **Tests**: audit rows on post/fail/duplicate/approve
- **Evidence**: AUDIT_AND_TRACEABILITY.md
- **Completion notes**: posting request, success, failure, duplicate, retry, approval, mode-sensitive actions audited.

## R. Transactional outbox
- **Status**: COMPLETE
- **Dependencies**: N
- **Files**: engine uses existing `infrastructure/outbox.js`
- **DB changes**: none
- **Tests**: outbox row in same transaction; rollback removes it
- **Evidence**: TRANSACTIONAL_OUTBOX.md
- **Completion notes**: `JOURNAL_POSTED`, `ACCOUNTING_EVENT_POSTED`, `SOURCE_ACCOUNTING_STATUS_CHANGED` events.

## S. Error and retry architecture
- **Status**: COMPLETE
- **Dependencies**: C
- **Files**: `lib/accountingV2/domain/errors.js` (extended), `lib/accountingV2/engine/retryPolicy.js`
- **DB changes**: none
- **Tests**: retryable classification, capped retries, non-retryable finality
- **Evidence**: ERROR_AND_RETRY_ARCHITECTURE.md
- **Completion notes**: 20+ typed posting errors; retries reuse identity + hash; max attempts capped.

## T. Shadow posting
- **Status**: COMPLETE
- **Dependencies**: K, M
- **Files**: engine routes SHADOW/DUAL_COMPARE through the Phase 2 shadow stack with template-generated drafts
- **DB changes**: none
- **Tests**: shadow never touches production tables; comparison statuses
- **Evidence**: SHADOW_POSTING.md
- **Completion notes**: shadow journals excluded from all production queries (boundary tests).

## U. Legacy comparison
- **Status**: COMPLETE
- **Dependencies**: T
- **Files**: `lib/accountingV2/shadow/shadowAccounting.js` (Phase 2, reused), diagnostics API
- **DB changes**: none
- **Tests**: EXACT_MATCH / ACCOUNT_DIFFERENCE / AMOUNT_DIFFERENCE / MISSING / DUPLICATE legacy paths
- **Evidence**: SHADOW_POSTING.md §comparison
- **Completion notes**: comparison surfaced in diagnostics UI + API.

## V. Manual journal implementation
- **Status**: COMPLETE
- **Dependencies**: C–S
- **Files**: `lib/accountingV2/application/manualJournalService.js`, `app/api/accounting-v2/manual-journals/*`
- **DB changes**: uses extended `JournalEntry` columns
- **Security**: `journal.create/submit/approve/post` permissions; separation of duties.
- **Tests**: full lifecycle, immutability, restricted accounts, closed period, repeat posting
- **Evidence**: MANUAL_JOURNAL_IMPLEMENTATION.md
- **Completion notes**: draft → submit → approve → engine post; NEW_ENGINE mode required for posting via engine, feature-flagged.

## W. Adjustment journal framework
- **Status**: COMPLETE
- **Dependencies**: V
- **Files**: `lib/accountingV2/application/adjustmentJournalService.js`, `app/api/accounting-v2/adjustments/*`
- **DB changes**: `JournalEntry.adjustmentCategory` + metadata
- **Tests**: reason/category/approval required; closed-period rules; linkage
- **Evidence**: ADJUSTMENT_JOURNAL_FRAMEWORK.md
- **Completion notes**: 9 adjustment categories; approval mandatory; related journal linkage.

## X. Opening-balance pilot framework
- **Status**: COMPLETE
- **Dependencies**: V
- **Files**: `lib/accountingV2/application/openingBalanceService.js`, `prisma/schema.prisma` (`AcctV2OpeningBalanceBatch`), `app/api/accounting-v2/opening-balances/*`
- **DB changes**: new table `AcctV2OpeningBalanceBatch` (unique per tenant+effectiveDate+version)
- **Tests**: balanced/unbalanced, duplicate batch, AR-without-customer, approval, isolation
- **Evidence**: OPENING_BALANCE_FRAMEWORK.md
- **Completion notes**: no historical migration performed; framework + tests only.

## Y. Security and permissions
- **Status**: COMPLETE
- **Dependencies**: —
- **Files**: `lib/accountingV2/permissions.js` (extended), `lib/accountingV2/api/routeGuard.js`
- **DB changes**: none
- **Tests**: unauthorized posting/approval, cross-business injection
- **Evidence**: SECURITY_AND_PERMISSIONS.md
- **Completion notes**: 15 new permission keys (`accountingPosting.*`, `journal.submit`, adjustment/opening-balance keys, shadow/diagnostics view).

## Z. Observability
- **Status**: COMPLETE
- **Dependencies**: N
- **Files**: `lib/accountingV2/observability/postingMetrics.js`, `accountingLogger.js` (reused)
- **DB changes**: none (metrics derived from registry/attempt tables)
- **Tests**: log/metric fields present per attempt
- **Evidence**: OBSERVABILITY_GUIDE.md
- **Completion notes**: structured logs per attempt; DB-derived metrics for diagnostics.

## AA. API and internal interface
- **Status**: COMPLETE
- **Dependencies**: V–Z
- **Files**: `app/api/accounting-v2/**`, `app/system/accounting-posting-engine/page.js`
- **DB changes**: none
- **Security**: guarded routes only; no generic posting endpoint.
- **Tests**: security tests; route guard behaviour
- **Evidence**: POSTING_ENGINE_API.md
- **Completion notes**: preview, events, retry, manual journals, adjustments, opening balances, diagnostics.

## AB. Automated testing
- **Status**: COMPLETE
- **Dependencies**: all
- **Files**: `test/accountingV2.engine.test.js`, `test/accountingV2.engine.pipeline.test.js`, `test/accountingV2.boundaries.test.js` (extended), `test/helpers/acctV2PrismaStub.js` (extended)
- **Evidence**: MIGRATION_VALIDATION.md §tests
- **Completion notes**: command, idempotency, account, period, double-entry, transaction-rollback, concurrency, manual/adjustment/opening-balance, shadow, security, architecture suites.

## AC. Migration and deployment
- **Status**: COMPLETE
- **Dependencies**: E, N, O, X
- **Files**: `prisma/schema.prisma`, `prisma/migrations/*_acct_v2_posting_engine/`
- **DB changes**: additive only — see POSTING_ENGINE_MIGRATION_STRATEGY.md
- **Tests**: migrate diff/deploy against dev DB; existing data untouched (count verification)
- **Evidence**: POSTING_ENGINE_MIGRATION_STRATEGY.md, MIGRATION_VALIDATION.md
- **Completion notes**: no historical rows modified; constraints added as NOT VALID where legacy data could violate.

## AD. Phase 5 readiness
- **Status**: COMPLETE
- **Files**: PHASE_5_READINESS.md
- **Completion notes**: canonical journal structures, posted-status definition, ledger filters, shadow exclusion, blockers documented.

## AE. Final validation
- **Status**: COMPLETE
- **Files**: FINAL_PHASE_4_REPORT.md, MIGRATION_VALIDATION.md
- **Completion notes**: lint, tests, production build, migration validation, rollout/rollback documented; engine NOT globally activated.
