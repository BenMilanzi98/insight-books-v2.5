# Phase 1–4 Evidence Index (binding on Phase 5)

Every finding below was verified in the repository or prior-phase documents.
No findings were invented. Columns: source phase / ID / description / affected
structure / root cause / required Phase 5 implementation / historical
implication / deferred to Phase 6? / TB + reporting implication / evidence /
risk.

## Phase 1 — forensic audit findings

| ID | Finding | Affected | Root cause | Phase 5 requirement | Phase 6 deferral | Evidence | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1-L01 | Dual posted ledger: `Transaction/TransactionLine` + `JournalEntry/JournalEntryLine`; JE rows with `transactionId` mirror Transactions | All ledger queries | Historical module divergence | Canonical journal source with one mirror-exclusion rule applied everywhere | Historical consolidation deferred | `GENERAL_LEDGER_AUDIT.md`; `officialLedgerEngine.js` | Critical |
| P1-L02 | Legacy header-amount `JournalEntry` rows (Float debit/credit on header, zero lines) invisible to line aggregation but present in stored balances (QA-S19-LEGACY ×2, MK5,000) | GL vs stored balances; capital/cash divergence | Pre-line schema era | Flag as integrity exception (JRN-009 → GL rule); never add to canonical ledger | Repair (backing journals) deferred | `JOURNAL_INTEGRITY_REPORT.md` | High |
| P1-L03 | `Account.balance` incremental cache: unserialized read-modify-write in JS floats; `skipBalanceUpdate` escape; two rebuild paths disagree (`recalculateAccountBalanceFromPostedGl` includes mirrors) | Stored balances; CoA display; legacy BS | Cache treated as truth | Ledger derives only from posted lines; stored balance compared as non-authoritative in reconciliation; abnormal differences reported | Cache retirement deferred | `GENERAL_LEDGER_AUDIT.md`; `accountBalanceService.js` | Critical |
| P1-L04 | Status casing drift: `posted`/`Posted`/`POSTED`/`Void`/`void`; exact-match filters silently drop rows | TB vs GL vs CoA | Free-string status columns | Canonical layer normalizes case, flags non-standard casing as integrity finding | Data normalization deferred | `TRIAL_BALANCE_FORENSIC_REPORT.md` | High |
| P1-L05 | Duplicate prevention was TOCTOU (`assertNoDuplicatePostedSource`); caller-invented `sourceId` conventions defeat source→journal joins (`QA-S02-SALE` posted under `QA-pos-mobile-money`) | Lineage, duplicate detection | No DB constraint; caller discipline | Lineage marked "unreliable" for legacy rows without verifiable source link; canonical union keyed on event registry for V2 | Historical source-link repair deferred | `DUPLICATE_POSTING_ANALYSIS.md` | High |
| P1-L06 | Reversals: correct new-opposite-transaction pattern, but no DB uniqueness on `reversedTransactionId`; JE reversals unlinked from originals; three unreconciled reversal representations | Reversal filters | Schema gaps | Add reversal linkage columns on `JournalEntry`; canonical reversal treatment (both rows posted, net zero) | Historical reversal-link backfill deferred | `REVERSALS_AUDIT.md` | Medium |
| P1-L07 | TB does not skip group-header accounts (P&L/BS do) → parent+child double-count risk | Trial Balance | Missing header filter | Canonical ledger: header accounts are presentation-only; posting totals exclude them; direct parent activity surfaced as anomaly | — | `FINANCIAL_REPORT_LINEAGE.md` TB-003 | High |
| P1-L08 | Statement-grade reports read operational tables / stored balances (multi-tenant cash flow, AR/AP aging, dashboard fallbacks, legacy BS in exports) | Reports | Pre-ADR-001 design | Out of Phase 5 scope (Phase 7); ledger engine must provide the contracts they will move to | Deferred to Phase 7 | `FINANCIAL_REPORT_LINEAGE.md` | Critical (P7) |
| P1-L09 | `JournalEntry.entryDate` nullable → rows drop out of date-filtered TB | Date filters | Nullable column | Canonical layer treats missing dates as integrity findings, not silent drops | Backfill deferred | `TRIAL_BALANCE_FORENSIC_REPORT.md` #6 | Medium |
| P1-L10 | Line tables have no `tenantId`; tenant scope only via parent join; some helpers group lines by `accountId` alone | Tenant isolation | Schema design | Every Phase 5 query joins through the tenant-filtered parent; tests assert cross-business refusal | — | GL explorer report | High |

## Phase 1 — current-code defects found in Phase 5 inspection (2026-07-20)

| ID | Finding | Phase 5 action |
| --- | --- | --- |
| P5-I01 | GL export route lacks `transactionId: null` and merge rollup → export double-counts vs screen | Fix legacy export to reuse the screen query rules (read-path alignment, no data change); new engine serves one query contract for screen + export |
| P5-I02 | GoodsReceipt dedup + mirror exclusion excludes both sides of GR pairs from the GL screen | Canonical rule: mirrors excluded, Transactions included — exactly once; GR special-case retired in the canonical layer |
| P5-I03 | Journal list "all sources" keeps mirrored JE and drops the Transaction — opposite of GL | Canonical journal query service applies the same authority rule as the ledger |
| P5-I04 | Running balance accumulated after date-desc sort → non-chronological | New engine computes running balances over the canonical ascending order, then presents in requested order |
| P5-I05 | Posted `JournalEntry` hard-delete blocked only in application code | DB trigger: block DELETE of Posted journal entries; block UPDATE of financial columns on Posted V2 journals |

## Phase 2 — binding decisions

| ID | Decision | Phase 5 requirement |
| --- | --- | --- |
| ADR-001 | Financial statements derive exclusively from posted journal lines | GL query engine reads only canonical posted lines |
| ADR-002 | Posted = permanent; corrections via reversal/adjustment | Repository/API/DB restrictions carried into ledger layer |
| ADR-005 | Business-scoped AccountingContext everywhere | All ledger queries take context; row-ownership asserted |
| ADR-006 | Exact decimal arithmetic; no floats for money | Ledger math in integer minor units / decimal strings |
| ADR-007 | Legacy access via adapters only | Legacy journal normalization lives in `infrastructure/legacy/` |
| ADR-008 | Server-side DB feature flags; deny by default | `ledgerV2*` flags; no client override |
| ADR-011 | Stored balances are caches, never truth | Reconciliation compares them; ledger never reads them |
| ADR-012 | No operational-table financial statements | Ledger engine adds no invoice/payment/expense totals |

## Phase 3 — binding decisions

| ID | Decision | Phase 5 requirement |
| --- | --- | --- |
| P3-C01 | CoA V2 columns: `coaV2Category`, `coaV2NormalBalance`, `coaV2Behaviour`, `coaV2Status`, `postingAllowed`, `hierarchyPath`, `consolidationGroup` | Normal-balance presentation uses CoA V2 config first, legacy `normalBalance` fallback, category default last — never account-code ranges |
| P3-C02 | Merge survivors (`mergedIntoAccountId`) roll up historical activity | Canonical ledger keeps survivor rollup (same as `accountMergeRollup`) with original account preserved on lines |
| P3-C03 | Header/behaviour rules: headers are non-posting | Header accounts excluded from posting totals; direct header activity = anomaly |
| P3-C04 | Deprecated accounts visible historically | Ledger shows deprecated accounts' history; flags new-activity anomalies |

## Phase 4 — binding structures

| ID | Structure | Phase 5 requirement |
| --- | --- | --- |
| P4-S01 | V2 journals live in shared `JournalEntry` with `architectureVersion='ACCOUNTING_V2'`, unique `journalNumber`/`accountingEventId`, `je_v2_posted_requirements` CHECK | Canonical layer distinguishes legacy vs V2 rows by `architectureVersion` |
| P4-S02 | Event registry is the source-accounting link; legacy guard prevents dual posting going forward | Authority rules: conflicts detectable via registry + `(tenantId, sourceType, sourceId)` overlap; never count both |
| P4-S03 | Shadow journals live only in `AcctV2ShadowJournal(Line)` | Structurally excluded from ledger; boundary tests police joins |
| P4-S04 | Posting modes per scope (LEGACY default) | Ledger authority follows posting-mode configuration |
| P4-S05 | `PHASE_5_READINESS.md` open decision: dual legacy store treatment | Resolved in Phase 5: canonical union adapter (no data migration) — see `CANONICAL_JOURNAL_AUTHORITY_RULES.md` |

## Evidence gaps

- Phase 1 artifacts (CSV) reflect the QA dataset, not production volumes;
  reconciliation counts must be re-run per business before cutover.
- `ReversalAudit` table exists but is `@@ignore`d — its trigger-written rows
  are not readable through Prisma; treated as unavailable evidence.
