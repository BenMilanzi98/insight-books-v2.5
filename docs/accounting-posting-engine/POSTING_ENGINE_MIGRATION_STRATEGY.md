# Posting Engine Migration Strategy

## Schema changes (all additive)

Migration: `prisma/migrations/*acct_v2_posting_engine*` (deployed).

**Extended — `JournalEntry`** (nullable/defaulted columns): `journalNumber`,
`totalDebit`, `totalCredit`, `currency`, `exchangeRate`, `baseCurrency`,
`postingDate`, `accountingPeriodId`, `financialYearLabel`, `templateId`,
`templateVersion`, `architectureVersion`, `accountingEventId` (unique),
`postingMode`, `approvedById`, `approvedAt`, `adjustmentCategory`,
`adjustmentReason`, `relatedJournalId`, `metadata`.
Unique: `(tenantId, journalNumber)`.

**Extended — `JournalEntryLine`**: `baseDebit`, `baseCredit`, `currency`,
`taxCode`, `dimensions`. Non-negative CHECK constraints on debit/credit
(NOT VALID — historical rows untouched).

**Extended — `AcctV2EventRegistry`** (Phase 2 table): `approvalReference`,
`approvedBy`, `templateId`, `templateVersion`, `failureRetryable`.

**New — `AcctV2JournalSequence`**: `(tenantId, scopeKey)` unique,
`lastValue` with non-negative CHECK.

**New — `AcctV2OpeningBalanceBatch`**: `(tenantId, effectiveDate, version)`
unique; status lifecycle + journal linkage.

**Constraint** `je_v2_posted_requirements`: V2 posted journals must carry
posting date, period, source, template and event linkage.

No existing entity was duplicated: journals extend the shared `JournalEntry`
store; the event registry, outbox, audit, shadow and flag tables are the
Phase 2 entities extended in place. Templates are code (versioned modules),
not database rows — no template migration is required.

## Legacy compatibility

- Legacy journals are untouched; no historical journal was rewritten.
- V2 journals persist legacy-compatible status strings so existing reports
  keep working.
- Legacy adapters (`infrastructure/legacy/*`) remain the read path for
  comparison and guard checks.
- Source links live in the event registry — no columns were added to
  operational tables.

## Rollout inputs

- **Pilot business selection**: CoA V2 readiness `READY`, complete required
  mappings, configured periods, active finance approver.
- **Pilot events**: `MANUAL_JOURNAL_POSTED` (NEW_ENGINE), `ADJUSTMENT_POSTED`,
  `OPENING_BALANCE_POSTED`; `INVOICE_POSTED` in SHADOW only.
- **Acceptance thresholds**: 100% duplicate prevention in tests; shadow
  exact-match rate ≥ 98% over the observation window before any operational
  event activates; zero unexplained legacy–new conflicts.
- **Data-count verification**: see `MIGRATION_VALIDATION.md`.
- **Production locks**: additive DDL only; the NOT VALID check constraints
  avoid long table scans during deploy; validation can be run later in a
  maintenance window.

## Rollback

Schema rollback is possible only where no V2 records depend on the additive
columns/tables; behavioural rollback (flags → LEGACY) is always available and
is the primary mechanism — see `ROLLBACK_STRATEGY.md`.
