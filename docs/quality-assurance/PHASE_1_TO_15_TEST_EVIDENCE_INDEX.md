# Phases 1–15 — Test Evidence Index

Cross-phase map of **existing automated tests** and **documented gaps**. No invented finding IDs — all IDs appear in prior phase audits, gap registers, or module reports.

**Baseline:** 95 Vitest files under `test/`, 869 cases (791 pass / 55 fail / 23 skipped, July 2026 run).

---

## Phase 1 — Accounting forensic audit

| Finding / risk | Audit rule | Existing test coverage | Gap |
|---|---|---|---|
| R-01 dual ledger / JRN-009 header journals | JRN-009 | `test/accountingAudit.test.js` (header-amount detection); `test/accountingV2.ledger.test.js` (header row excluded from line totals) | Full legacy→V2 migration regression — **PENDING** `test/qa/ledger-dual-write.test.js` |
| R-02 stored balance drift | GL-002 | `test/accountingAudit.test.js`; `test/glReconciliation.test.js`; `test/accountingV2.ledger.test.js` | Concurrency race — **NOT_STARTED** |
| R-03 duplicate posting | JRN-006 | `test/accountingV2.postingEngine.test.js` (idempotency, P2002 race via stub) | Legacy path — skipped blocks in `accountingV2.posting.test.js` |
| R-04 AR divergence | AR-001 | `test/accountingAudit.test.js`; `scripts/verify-accounting-scenario.cjs` (`ar-subledger`) | API integration — **PENDING** |
| R-05 phantom liabilities | AP-004 | Audit engine only (no dedicated unit file) | **GAP-QA-012** |
| R-06 capital double-count | CAP-005, CAP-002 | `test/accountingAudit.test.js`; `test/accountingV2.reports.test.js` (MK1M once — **currently failing**) | Fix failing suite before claiming coverage |
| R-07 period fail-open | PER-001..003 | `test/accountingV2.periods.test.js` (56 cases; close/reopen subset **failing**) | Boundary-day UTC — **PENDING** |
| R-19 SEC-1 cross-tenant GL | TEN-001, COA-005 | `test/accountingV2.postingEngine.test.js` (`CrossTenantAccountingError`); skipped tenant block in `accountingV2.posting.test.js` | Legacy `postGlEntry` — **PENDING** Phase 15 Q |
| R-20 SEC-2 supplier IDOR | TEN-003 | **None** | **GAP-QA-003** → `test/qa/supplier-idor.test.js` |
| R-21 SEC-3/4 reversal/capital RBAC | — | `test/authz.test.js` (permission helper only) | Route integration — **GAP-QA-004** |
| TB-003 header double-count | TB-003 | `test/accountingAudit.test.js`; `test/coaRollupInventory.test.js` | V2 TB engine tests **failing** in `accountingV2.reports.test.js` |
| SAL-DUP / 5200 | COA-002 | `test/legacyExpenseAccountRemaps.test.js`; `test/incomeStatementOperatingExpenseRollup.test.js` (**failing**); `test/malawiTaxUtilsPayroll.test.js` | Tenant DB pipeline — `coaExpenseTenantPipeline.test.js` (skipIf) |

**Primary test files:** `test/accountingAudit.test.js`, `test/accountingEngine.test.js` (legacy — **4 failing** after `postGlEntry` removal).

---

## Phase 2 — Accounting architecture

| Evidence | Test coverage |
|---|---|
| ADR-005 / P2-02 session-only context | `test/accountingV2.domain.test.js`, `test/accountingV2.boundaries.test.js`, `test/tenantScope.test.js` |
| CrossTenantAccountingError | `test/accountingV2.postingEngine.test.js` |
| Service boundary contracts | Partial via domain tests; no generated OpenAPI contract tests — **GAP-QA-018** |

---

## Phase 3 — Chart of Accounts V2

| Evidence | Test coverage |
|---|---|
| Code governance, 5000/5200 preservation | `test/coaV2.domain.test.js` (62 cases), `test/coaV2.services.test.js` (25) |
| SAL-DUP consolidation | `test/coaMigration.test.js`, `test/legacyExpenseAccountRemaps.test.js` |
| Expense category normalization | `test/systemExpenseCategoryCodes.test.js`, `test/expenseRegisterGlCogsOverlap.test.js` |
| Tenant expense pipeline | `test/coaExpenseTenantPipeline.test.js` (DB skipIf) |

---

## Phase 4 — Posting engine

| Evidence | Test coverage |
|---|---|
| Event registry, idempotency, templates | `test/accountingV2.postingEngine.test.js` (57 cases) |
| Retired `postAccountingEvent` paths | `test/accountingV2.posting.test.js` — **4 describe.skip blocks** (23 skipped cases) |
| Integration adapters | `test/accountingV2.integrations.test.js` (14) |
| Mapping rules | `test/accountingMappingRules.test.js` |

---

## Phase 5 — Ledger V2

| Evidence | Test coverage |
|---|---|
| Canonical journal source, rebuild | `test/accountingV2.ledger.test.js` (45 cases) |
| GL reconciliation | `test/glReconciliation.test.js` |
| Money / decimal safety | `test/money.test.js`, `test/moneyDecimalAggregationSafety.test.js`, `test/taxPrecision.test.js` |

---

## Phase 6 — Repair

| Evidence | Test coverage |
|---|---|
| Anomaly detection P6-XTEN-001 | `test/accountingV2.repair.test.js` (46 cases; duplicate-journal + 5200 reclass **failing**) |
| Repair batch SoD | Domain tests only; no HTTP — **GAP-QA-008** |

---

## Phase 7 — Reports V2

| Evidence | Test coverage |
|---|---|
| TB, IS, BS, CF, equity, drill-down | `test/accountingV2.reports.test.js` (70 cases — **majority failing** July 2026) |
| Legacy report services | `test/accountingReportService.test.js`, `test/reportingEngine.test.js`, `test/reportGlAccountLines.test.js` |
| REP-001, REP-006, REP-025, REP-036 | Covered in reports suite when green |

---

## Phase 8 — Accounting periods

| Evidence | Test coverage |
|---|---|
| Period integrity, close, reopen | `test/accountingV2.periods.test.js` (56 cases; close workflow **failing**) |
| Payroll month alignment | `test/payrollMonthPeriod.test.js` |

---

## Phase 9 — Integrations

| Evidence | Test coverage |
|---|---|
| Webhook idempotency (E25) | Schema only; **no automated webhook tests** — GAP-SEC-022 |
| Source linkage | `test/reportingSourceRules.test.js`, `test/invoicePaymentJournalLookup.test.js` |

---

## Phase 10 — Bank reconciliation

| Evidence | Test coverage |
|---|---|
| Domain, import, completion, period close | `test/bankReconciliation.domain.test.js` (24), `import.test.js`, `completion.test.js`, `periodClose.test.js` |

---

## Phase 11 — Equity management

| Evidence | Test coverage |
|---|---|
| EQT-035 duplicate capital | `test/equityManagement.domain.test.js`, `test/equityManagement.workflows.test.js` |
| Reconciliation rules | Domain tests; HTTP SoD — **GAP-QA-009** |

---

## Phase 12 — Accounting close

| Evidence | Test coverage |
|---|---|
| Close domain + module pack | `test/accountingClose.domain.test.js` (16), `test/accountingClose.moduleAndPack.test.js` (8) |

---

## Phase 13 — Financial planning

| Evidence | Test coverage |
|---|---|
| Engine, export, quality | `test/financialPlanning.engine.test.js`, `export.test.js`, `quality.test.js` |

---

## Phase 14 — Loan readiness

| Evidence | Test coverage |
|---|---|
| LRD-017 capacity not revenue-only | `test/loanReadiness.engine.test.js` (21 cases, uses `toBeCloseTo`) |
| SoD | Domain only; no route tests — **GAP-QA-010** |

---

## Phase 15 — Security & governance

| Evidence | Test coverage | Status |
|---|---|---|
| Policy engine domain | `test/securityGovernance.engine.test.js` (27 cases) | **EXISTS** |
| Policy engine integration | `test/securityGovernance.policy.test.js` | **NOT_STARTED** |
| SoD registry | `test/securityGovernance.sod.test.js` | **NOT_STARTED** |
| Session sign/revoke | `test/securityGovernance.session.test.js` | **NOT_STARTED** |
| RBAC helper | `test/authz.test.js` (10 cases) | **EXISTS** — needs middleware extension (BZ) |
| SEC-2 regression | `test/qa/supplier-idor.test.js` (planned) | **NOT_STARTED** |
| Middleware catalogue | `test/qa/middleware-catalogue.test.js` (planned) | **NOT_STARTED** |

---

## CI evidence

| Job | Command | When |
|---|---|---|
| `accounting-verify.yml` → Unit tests | `npm test` | Every push/PR to main, master, develop |
| `accounting-verify.yml` → DB scenario | `npm run verify:accounting-scenario -- --tenant=QA-Accounting` | Only if `secrets.DATABASE_URL` set |

---

## Summary: test debt by severity

| Severity | Count | Examples |
|---|---|---|
| **Blocking CI green** | 55 failing cases / 13 files | `accountingV2.reports.test.js`, legacy `postGlEntry` callers |
| **Skipped by design** | 23 cases | Retired posting API, shadow accounting |
| **DB conditional skip** | 3 files | `expenseCoaCategoryPicker`, `salaryAdvanceGlAccount`, `coaExpenseTenantPipeline` |
| **Not started (Phase 15/16)** | 4+ planned files under `test/qa/` | policy, sod, session, middleware, IDOR |

See `TEST_GAP_REGISTER.md` for GAP-QA-001+ and `PHASE_16_TASKS.md` for remediation workstreams.
