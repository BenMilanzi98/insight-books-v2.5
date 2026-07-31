# Phase 1–5 Evidence Index for Historical Repair

Binding inputs for Phase 6. Every entry cites the real prior-phase document.
Nothing here is invented; where evidence is incomplete the proposed status is
UNDER_INVESTIGATION / EVIDENCE_INCOMPLETE, not repair.

Environment note: this index is built against the development database
(5 tenants, 19 transactions, 6 journal entries — see
`BACKUP_AND_RESTORE_VALIDATION.md`). Production repair requires re-running
detection against production data; the defect classes and repair machinery are
identical.

## Evidence register

| Ev. ID | Phase | Finding | Anomaly type(s) | Confidence | Proposed repair class | Approval | Evidence path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P6-EV-001 | 1 | Legacy header-amount journals (amounts on `JournalEntry.debit/credit` floats, zero lines) invisible to line-based reports but included in stored balances; live trace `QA-S19-LEGACY-CR` (5,000 on account 3102) | UNSUPPORTED_HISTORICAL_RECORD / JRN-104 | CONFIRMED | MISSING_JOURNAL_REPAIR (reconstruct lines as historical repair journal per document) or ACCEPTED_EXCEPTION where no source proof | Finance Manager | `docs/accounting-audit/JOURNAL_INTEGRITY_REPORT.md`, `docs/accounting-audit/CAPITAL_AND_EQUITY_AUDIT.md`, `docs/accounting-audit/GENERAL_LEDGER_AUDIT.md` |
| P6-EV-002 | 1 | `Account.balance` stored snapshot drifts from journal-derived balances (GL-002); two rebuild helpers disagree on mirror exclusion | STORED_BALANCE_DIFFERENCE / DIRECT_ACCOUNT_BALANCE_UPDATE | CONFIRMED | PROJECTION_REBUILD + REPORT_ONLY_REPAIR (retire cache from authoritative surfaces); never journals | Senior accountant | `docs/accounting-audit/GENERAL_LEDGER_AUDIT.md`, P0-4 in `docs/accounting-audit/PHASE_2_REMEDIATION_BACKLOG.md` |
| P6-EV-003 | 1 | Owner capital MK1,000,000 → MK2,000,000: defect class proven — a surface summing stored balance + journal lines (or parent 3000 rollup + children) displays exactly double | CAPITAL_DUPLICATION / PARENT_CHILD_DOUBLE_COUNT / REPORT_QUERY_ERROR | CONFIRMED (mechanism); production instance requires production data re-run | REPORT_ONLY_REPAIR / PROJECTION_REBUILD; journal repair only if a true duplicate journal is proven on production data | Finance Manager + owner (equity) | `docs/accounting-audit/CAPITAL_AND_EQUITY_AUDIT.md` §"MK1,000,000 trace" |
| P6-EV-004 | 1 | Duplicate-posting TOCTOU race: `assertNoDuplicatePostedSource` check-then-insert, no DB unique key, `skipDuplicateCheck` bypass, free-form `sourceId` | DUPLICATE_JOURNAL (latent) / TECHNICAL_LINKAGE_ERROR | CONFIRMED (race); no confirmed duplicates in current dev data | DUPLICATE_EFFECT_REPAIR when instances found; prevention already delivered by Phase 4 idempotency for V2 path | Finance Manager | `docs/accounting-audit/DUPLICATE_POSTING_ANALYSIS.md` |
| P6-EV-005 | 1 | Source→journal linkage gaps: `SupplierBill.journalEntryId`/`SupplierPayment.journalEntryId` NULL; sales/payments traceable only by naming convention (`QA-S02-SALE` under `sourceId='QA-pos-mobile-money'`) | MISSING_SOURCE_LINK / TECHNICAL_LINKAGE_ERROR | HIGH_CONFIDENCE per row (PK matching); ambiguous rows MEDIUM | SOURCE_LINK_REPAIR / METADATA_ONLY_REPAIR | Senior accountant; finance review for ambiguous | P0-3 in `docs/accounting-audit/PHASE_2_REMEDIATION_BACKLOG.md`, `docs/accounting-audit/JOURNAL_INTEGRITY_REPORT.md` |
| P6-EV-006 | 1 | Sources marked posted without journals / journals without sources (orphans); engine-bypass paths (11 locations) created inconsistent effects | MISSING_JOURNAL / ORPHAN_JOURNAL | Per-record; requires per-row evidence | MISSING_JOURNAL_REPAIR (only with authoritative source) / orphan classification | Finance Manager | `docs/accounting-audit/JOURNAL_INTEGRITY_REPORT.md`, P0-6 backlog |
| P6-EV-007 | 1 | AR/AP subledger vs control account maintained independently; observed 15,000-class gaps (`QA-S18-INV` partial-posting pattern); aging services read operational tables | SUBLEDGER_CONTROL_DIFFERENCE | Per-record | Evidence-based journal repair + REPORT_ONLY_REPAIR for lineage | Finance Manager | `docs/accounting-audit/RECEIVABLES_AUDIT.md`, `PAYABLES_AUDIT.md`, `FINANCIAL_REPORT_LINEAGE.md` |
| P6-EV-008 | 1 | Liability module balances live outside GL (`Liability` rows without journals) — unsupported-liability symptom | UNSUPPORTED_LIABILITY | Per-record | MISSING_JOURNAL_REPAIR only where contract/schedule proves the liability; otherwise exception + exclusion of non-authoritative cache from reports | Finance Manager | P1-2 backlog, `docs/accounting-audit/GENERAL_LEDGER_AUDIT.md` |
| P6-EV-009 | 1 | Reversal integrity: no DB constraint against repeated reversal of one journal; dual status representation across ledgers; `ReversalAudit` unmapped | INVALID_REVERSAL / DUPLICATE_REVERSAL | Per-record | REVERSAL_REPAIR (link/complete); Phase 5 linkage columns now available | Finance Manager | `docs/accounting-audit/REVERSALS_AUDIT.md` |
| P6-EV-010 | 1 | Status-casing drift (`posted`/`Posted`/`POSTED`; `draft` default in old migration) | TECHNICAL_LINKAGE_ERROR | CONFIRMED | METADATA_ONLY_REPAIR (normalize casing; no financial meaning change) | Senior accountant | `docs/accounting-audit/JOURNAL_INTEGRITY_REPORT.md`, JRN-106 |
| P6-EV-011 | 1 | Period control: fail-open coverage, boundary-day double coverage, journals without period FK | WRONG_PERIOD / MISSING (period link) | Per-record; link population is metadata where period is provable | METADATA_ONLY_REPAIR (proven period link) / PERIOD_ADJUSTMENT_REPAIR | Period controller | `docs/accounting-audit/ACCOUNTING_PERIODS_AUDIT.md` |
| P6-EV-012 | 1 | Tenant-isolation holes (unfiltered account loads, query-string tenantId) — cross-business references possible in historical data | CROSS_TENANT_REFERENCE | Detection required; none confirmed in dev data | CROSS_BUSINESS_REPAIR with security escalation | Finance Manager + Super Admin | `docs/accounting-audit/MULTI_TENANT_AND_SECURITY_AUDIT.md` |
| P6-EV-013 | 1 | Float arithmetic across 48 money models (JournalEntry.debit/credit etc.) — historical rounding residue possible | ROUNDING_DIFFERENCE | Per-record | Documented immaterial-rounding acceptance policy or AMOUNT_ADJUSTMENT_REPAIR | Finance policy | P1-5 backlog, `docs/accounting-posting-engine/MONEY_AND_ROUNDING.md` |
| P6-EV-014 | 3 | Salary costs across conflicting accounts; 5200 canonical; cleanup inventory exists | WRONG_ACCOUNT | Per-row from cleanup report | RECLASSIFICATION_REPAIR (Dr 5200 / Cr wrong account); liabilities (PAYE/pension) stay separate | Finance Manager | `docs/accounting-coa/SALARY_ACCOUNT_CLEANUP_REPORT.md` |
| P6-EV-015 | 3 | Duplicate accounts register + merge machinery; merged-away accounts must not accept postings | WRONG_ACCOUNT / GL-116 | CONFIRMED | Mapping correction for future + reclassification for proven historical misposts | Senior accountant | `docs/accounting-coa/DUPLICATE_ACCOUNT_REGISTER.md` |
| P6-EV-016 | 4 | Opening-balance framework: one OB batch per (tenant, effectiveDate, version); legacy opening data (stored fields, `onboarding` transactions) NOT migrated in Phase 4 | OPENING_BALANCE_DUPLICATION / UNSUPPORTED_OPENING_BALANCE | Per-record | DUPLICATE_EFFECT_REPAIR for double openings; controlled migration journals for stored-field openings with evidence | Finance Manager | `docs/accounting-posting-engine/OPENING_BALANCE_FRAMEWORK.md` |
| P6-EV-017 | 5 | Canonical authority rules: header-amount journals contribute nothing (JRN-104 findings); authority conflicts (GL-117); parent-child presentation-only rollups; stored balances excluded (GL-118) | multiple | CONFIRMED (rules binding on repairs) | Repairs must restore data to canonical validity, never adjust the rules to fit bad data | — | `docs/accounting-ledger/CANONICAL_JOURNAL_AUTHORITY_RULES.md` |
| P6-EV-018 | 5 | Repair inventory by category with permitted repair approaches; DB triggers make posted-row mutation impossible — repairs must be new journals | all | — | Binding constraints on Phase 6 design | — | `docs/accounting-ledger/PHASE_6_READINESS.md` |
| P6-EV-019 | 5 | Reconciliation service reports GL-111 stored-balance drift, GL-114 projection staleness, GL-112 imbalance, GL-117 conflicts, JRN-1xx structure findings — the Phase 6 detection substrate | all | — | Detection reuses these engines; Phase 6 persists findings into the anomaly registry | — | `docs/accounting-ledger/LEDGER_REBUILD_AND_RECONCILIATION.md`, `JOURNAL_AND_LEDGER_INTEGRITY_RULES.md` |
| P6-EV-020 | 2 | ADR-002 (immutable posted journals), ADR-006 (exact decimals), ADR-011 (posted lines authoritative), ADR-012 (no operational-table statements) | — | — | Binding on every repair class | — | `docs/accounting-architecture/ARCHITECTURE_DECISIONS.md` |

## Per-anomaly working detail

Full per-record detail (business, financial year, period, module, source
record, journal, accounts, amount, root cause, remaining uncertainty,
reviewer) lives in the **Historical Anomaly Registry**
(`AcctV2HistoricalAnomaly` table) populated by the detection service, and in
machine-readable exports under `artifacts/accounting-repair/`. This document
indexes the defect classes and their binding evidence; the registry carries
the row-level truth so it cannot fall out of date with the data.

## Explicit non-findings (do not invent)

- No confirmed duplicate capital journal exists in the development data
  (CAP-001 clean); the MK2,000,000 display is a surface-summation defect
  class, proven with the 3102/QA-S19 trace.
- No confirmed cross-tenant posted journal exists in the development data.
- Dividend/share-capital records do not exist (module unimplemented) — nothing
  to reconcile, recorded as scope gap.
