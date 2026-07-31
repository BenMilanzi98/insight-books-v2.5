# Accounting Invariant Catalogue

Formal invariants **ACC-INV-001** through **ACC-INV-050** for InsightBooks V2, plus documented extras from module rules. Each invariant links to audit rule codes (where applicable), risk IDs, and test status.

**Legend:** ✅ tested | ⚠️ partial / failing | ❌ not tested | 🔍 audit-only

---

## Journal & posting (ACC-INV-001 – ACC-INV-010)

| ID | Invariant | Audit rule | Risk | Test evidence | Status |
|---|---|---|---|---|---|
| ACC-INV-001 | Every posted journal: sum(debits) = sum(credits) | JRN-001 | R-01 | `accountingAudit.test.js`, `accountingV2.postingEngine.test.js` | ✅ |
| ACC-INV-002 | Posted journal has ≥2 lines with single-sided amounts | JRN-002 | R-01 | `accountingAudit.test.js` | ✅ |
| ACC-INV-003 | No line has both debit and credit | JRN-003 | — | `accountingAudit.test.js` | ✅ |
| ACC-INV-004 | No line has zero/negative amounts | JRN-004 | — | `accountingAudit.test.js` | ✅ |
| ACC-INV-005 | One active posted journal per (sourceModule, sourceType, sourceId, eventType) | JRN-006 | R-03 | `accountingV2.postingEngine.test.js` | ✅ |
| ACC-INV-006 | Posted journal has posting date | JRN-007 | — | `accountingAudit.test.js` | ✅ |
| ACC-INV-007 | No legacy header-amount rows without lines in canonical reports | JRN-009 | R-01, R-06 | `accountingAudit.test.js`, `accountingV2.ledger.test.js` | ⚠️ reports suite failing |
| ACC-INV-008 | V2 posting rejects cross-tenant account IDs | COA-005, TEN-001 | R-19 | `accountingV2.postingEngine.test.js` | ✅ |
| ACC-INV-009 | Idempotency key collision returns stable outcome | — | R-03 | `accountingV2.postingEngine.test.js` | ✅ |
| ACC-INV-010 | Retired legacy `postGlEntry` cannot create new journals | — | R-22–25 | `accountingEngine.test.js` | ⚠️ expects throw — tests fail on callers still using API |

---

## Chart of accounts (ACC-INV-011 – ACC-INV-015)

| ID | Invariant | Audit rule | Finding | Test evidence | Status |
|---|---|---|---|---|---|
| ACC-INV-011 | Unique account code per tenant | COA-001 | — | `coaV2.domain.test.js` | ✅ |
| ACC-INV-012 | Single canonical salary expense account 5200 | COA-002 | SAL-DUP | `legacyExpenseAccountRemaps.test.js`, `malawiTaxUtilsPayroll.test.js` | ⚠️ rollup tests failing |
| ACC-INV-013 | No direct posting on parent with active children | COA-003 | TB-003 | `coaDirectPostingEligibility.test.js`, `accountingAudit.test.js` | ✅ |
| ACC-INV-014 | Operating expense header 5000 is presentation-only in IS rollup | — | 5000 | `incomeStatementOperatingExpenseRollup.test.js` | ⚠️ |
| ACC-INV-015 | Inactive accounts reject new postings | COA-006 | — | `coaV2.domain.test.js` | ✅ |

---

## General ledger & balances (ACC-INV-016 – ACC-INV-022)

| ID | Invariant | Audit rule | Risk | Test evidence | Status |
|---|---|---|---|---|---|
| ACC-INV-016 | Canonical balance derived from journal lines (ADR-011) | GL-002 | R-02 | `accountingV2.ledger.test.js`, `glReconciliation.test.js` | ✅ |
| ACC-INV-017 | Stored `Account.balance` flagged when ≠ derived | GL-002 | R-02 | `accountingAudit.test.js` | 🔍 |
| ACC-INV-018 | Header-amount journal rows contribute zero to line totals | — | R-01 | `accountingV2.ledger.test.js` | ✅ |
| ACC-INV-019 | Trial balance debits = credits for posted set | TB-001 | — | `accountingV2.reports.test.js` | ⚠️ failing |
| ACC-INV-020 | TB excludes draft/void/mirror journals | — | — | `accountingV2.reports.test.js` | ⚠️ failing |
| ACC-INV-021 | No parent+child double-count in V2 TB presentation | TB-003 | R-13 | `accountingAudit.test.js` | ⚠️ |
| ACC-INV-022 | Money arithmetic uses safe decimal/minor aggregation | — | R-10 | `money.test.js`, `moneyDecimalAggregationSafety.test.js` | ✅ |

---

## Receivables & payables (ACC-INV-023 – ACC-INV-028)

| ID | Invariant | Audit rule | Risk | Test evidence | Status |
|---|---|---|---|---|---|
| ACC-INV-023 | AR control = open invoice subledger | AR-001 | R-04 | `verify-accounting-scenario.cjs`, `accountingAudit.test.js` | 🔍 / ⚠️ |
| ACC-INV-024 | `remainingBalance = total − totalPaid` on invoices | AR-001 | R-04 | `invoiceTotals.test.js` | ✅ |
| ACC-INV-025 | Posted sale/invoice has traceable journal | AR-002 | R-09 | `accountingAudit.test.js` | 🔍 |
| ACC-INV-026 | Payment not posted twice to GL | AR-004 | R-03 | via JRN-006 audit | 🔍 |
| ACC-INV-027 | AP control = supplier subledger | AP-001 | R-05 | audit engine | 🔍 |
| ACC-INV-028 | Liability balance has journal support | AP-004 | R-05 | audit engine | ❌ GAP-QA-012 |

---

## Periods & close (ACC-INV-029 – ACC-INV-033)

| ID | Invariant | Audit rule | Risk | Test evidence | Status |
|---|---|---|---|---|---|
| ACC-INV-029 | Posted txn covered by accounting period | PER-001 | R-07 | `accountingV2.periods.test.js` | ⚠️ |
| ACC-INV-030 | No posting after period closed | PER-002 | R-07 | `accountingV2.periods.test.js` | ⚠️ |
| ACC-INV-031 | No overlapping period boundaries without explicit policy | PER-003 | R-07 | `accountingAudit.test.js` | 🔍 |
| ACC-INV-032 | Period reopen requires second-person approval | — | — | `accountingV2.periods.test.js` | ⚠️ failing |
| ACC-INV-033 | Close blocked on unbalanced TB | — | — | `accountingV2.periods.test.js` | ⚠️ failing |

---

## Capital, equity & reports (ACC-INV-034 – ACC-INV-042)

| ID | Invariant | Audit rule | Finding | Test evidence | Status |
|---|---|---|---|---|---|
| ACC-INV-034 | Capital posted once per source event | CAP-001 | — | `accountingAudit.test.js` | 🔍 |
| ACC-INV-035 | Owner capital MK1M appears once on BS | CAP-002, CAP-005 | R-06 | `accountingV2.reports.test.js` | ⚠️ failing |
| ACC-INV-036 | Equity stored balance matches GL authority | CAP-005 | CAP-005 | `accountingAudit.test.js` | 🔍 |
| ACC-INV-037 | Drawings/dividends not classified as P&L expense | CAP-003 | — | `accountingV2.reports.test.js` | ⚠️ |
| ACC-INV-038 | Assets = Liabilities + Equity on BS | — | — | `accountingV2.reports.test.js` | ⚠️ |
| ACC-INV-039 | IS operating profit = revenue − operating expenses (5200 rollup) | — | 5200, 5000 | `incomeStatementOperatingExpenseRollup.test.js` | ⚠️ |
| ACC-INV-040 | Drill-down line = report line total (REP-025) | — | — | `accountingV2.reports.test.js` | ⚠️ |
| ACC-INV-041 | Cross-report reconciliation VERIFIED on clean books | REP-001 | — | `accountingV2.reports.test.js` | ⚠️ |
| ACC-INV-042 | Budget amounts never posted to GL | — | — | `accountingV2.reports.test.js` | ⚠️ |

---

## Tenancy (ACC-INV-043 – ACC-INV-045)

| ID | Invariant | Audit rule | Finding | Test evidence | Status |
|---|---|---|---|---|---|
| ACC-INV-043 | Journal line account belongs to same tenant | TEN-001, COA-005 | SEC-1 | `accountingV2.postingEngine.test.js` | ✅ |
| ACC-INV-044 | Financial rows have non-null tenantId | TEN-002 | R-14 | audit engine | 🔍 |
| ACC-INV-045 | Tenant scope enforced on stock/POS reads | — | — | `tenantScope.test.js`, `tenantStockAccess.test.js` | ✅ |

---

## Reversals & repair (ACC-INV-046 – ACC-INV-050)

| ID | Invariant | Audit rule | Risk | Test evidence | Status |
|---|---|---|---|---|---|
| ACC-INV-046 | Active reversal at most once per original | REV-002 | R-12 | `accountingAudit.test.js` | 🔍 |
| ACC-INV-047 | Reversal mirrors original accounts/amounts | REV-003 | — | `accountingAudit.test.js` | 🔍 |
| ACC-INV-048 | Repair journal preserves originals (HREP) | — | — | `accountingV2.repair.test.js` | ⚠️ failing |
| ACC-INV-049 | Salary reclassification targets 5200 without changing expense total | — | SAL-DUP | `accountingV2.repair.test.js` | ⚠️ failing |
| ACC-INV-050 | Cross-tenant line detected as anomaly P6-XTEN-001 | TEN-001 | R-19 | repair anomaly tests | ✅ domain |

---

## Known extras (module-specific, not renumbered)

| Code | Meaning | Module | Test |
|---|---|---|---|
| EQT-035 | MK1M capital event appears > once | Equity | `equityManagement.domain.test.js` |
| REP-006 | Material AR/AP control difference blocks VERIFIED | Reports | `accountingV2.reports.test.js` ⚠️ |
| REP-036 | Unclassified accounts disclosed on BS | Reports | `accountingV2.reports.test.js` ⚠️ |
| LRD-017 | Loan capacity uses non-revenue-only basis | Loan readiness | `loanReadiness.engine.test.js` ✅ |
| SAL-DUP | Historical duplicate salary accounts consolidated to 5200 | CoA | `coaMigration.test.js` ✅ |
| TB-003 | Direct postings on header with children | TB | `accountingAudit.test.js` 🔍 |

---

## Maintenance

- New invariants require finance + engineering sign-off.
- Each ACC-INV must map to ≥1 test or audit rule within two sprints.
- See `REQUIREMENT_TEST_TRACEABILITY_MATRIX.md` and `DEFECT_REGRESSION_CATALOGUE.md`.
