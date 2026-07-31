# Complete Feature Matrix

| Field | Value |
|---|---|
| Basis | Static code review (routes + lib + tests present) |
| Legend | **REVIEWED_CODE** = handlers + domain lib exist; **PARTIAL** = some paths legacy/mixed; **UNKNOWN** = not reviewed in this pass |
| E2E verified | **No** — matrix does not imply manual QA sign-off |

**Columns:** C = Create, R = Read, U = Update, D = Delete, A = Approve/workflow, P = Posts to GL

---

## V2 accounting platform

| Module | C | R | U | D | A | P | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| Accounting V2 — journals | ✓ | ✓ | ✓ | ○ | ✓ | ✓ | REVIEWED_CODE | `app/api/accounting-v2/journals`, `lib/accountingV2` |
| Accounting V2 — ledger | ○ | ✓ | ○ | ○ | ○ | ○ | REVIEWED_CODE | ledger routes + `accountingV2.ledger.test.js` |
| Accounting V2 — periods | ✓ | ✓ | ✓ | ○ | ✓ | ○ | REVIEWED_CODE | periods routes + `accountingV2.periods.test.js` |
| Accounting V2 — opening balances | ✓ | ✓ | ✓ | ○ | ✓ | ✓ | REVIEWED_CODE | opening-balances routes |
| Accounting V2 — reports | ✓ | ✓ | ○ | ○ | ○ | ○ | PARTIAL | reports routes; some tests **FAILING** per DEFECT catalogue |
| Accounting V2 — repair | ✓ | ✓ | ○ | ○ | ✓ | ○ | REVIEWED_CODE | repair routes + `accountingV2.repair.test.js` |
| Posting engine | ✓ | ✓ | ○ | ○ | ○ | ✓ | PARTIAL | coordinator exists; legacy callers partially migrated |
| CoA V2 governance | ✓ | ✓ | ✓ | ○ | ✓ | ○ | REVIEWED_CODE | `coa-v2` routes + `coaV2.*.test.js` |
| Bank reconciliation V2 | ✓ | ✓ | ✓ | ○ | ✓ | ✓ | REVIEWED_CODE | bank-recon routes + domain tests |
| Equity management V2 | ✓ | ✓ | ✓ | ○ | ✓ | ✓ | REVIEWED_CODE | equity routes + workflow tests |
| Accounting close V2 | ✓ | ✓ | ○ | ○ | ✓ | ✓ | REVIEWED_CODE | close routes + `accountingClose.*.test.js` |
| Financial planning V2 | ✓ | ✓ | ✓ | ✓ | ○ | **✗** | REVIEWED_CODE | REG-PLAN-NOGL — never posts |
| Loan readiness V2 | ✓ | ✓ | ✓ | ✓ | ○ | **✗** | REVIEWED_CODE | REG-LRD-NOGL — never posts |
| Security governance V2 | ✓ | ✓ | ✓ | ✓ | ✓ | ○ | REVIEWED_CODE | security-governance routes + engine test |

---

## Legacy operational modules (selected)

| Module | C | R | U | D | A | P | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| Sales / POS | ✓ | ✓ | ✓ | ✓ | ○ | ✓ | PARTIAL | Legacy + V2 adapters; dual-post risk documented R-22 |
| Invoices / AR | ✓ | ✓ | ✓ | ✓ | ○ | ✓ | PARTIAL | Partial payment, refund routes modified for V2 |
| Expenses | ✓ | ✓ | ✓ | ✓ | ○ | ✓ | PARTIAL | REG-EXP-5000 band enforced in regression |
| Purchases / AP | ✓ | ✓ | ✓ | ✓ | ○ | ✓ | PARTIAL | Bills, receipts, supplier payments |
| Payroll | ✓ | ✓ | ✓ | ○ | ✓ | ✓ | PARTIAL | REG-SAL-5200; legacy reversal tests failing |
| Inventory / stock | ✓ | ✓ | ✓ | ✓ | ○ | ✓ | PARTIAL | Transfers, write-offs — some legacy posting tests failing |
| Assets / depreciation | ✓ | ✓ | ✓ | ✓ | ○ | ✓ | UNKNOWN | Routes exist; not re-reviewed in system pass |
| Capital account | ✓ | ✓ | ✓ | ○ | ○ | ✓ | PARTIAL | REG-CAP-005 regression |
| Journal entries (legacy UI) | ✓ | ✓ | ✓ | ✓ | ○ | ✓ | PARTIAL | Coexists with V2 journals |
| General ledger (v1 UI) | ○ | ✓ | ○ | ○ | ○ | ○ | PARTIAL | Superseded by `/general-ledger-v2` |
| Reports (legacy) | ○ | ✓ | ○ | ○ | ○ | ○ | PARTIAL | `/reports` + `/reports/financial` |
| HR (leave, attendance, benefits) | ✓ | ✓ | ✓ | ✓ | ✓ | ○ | UNKNOWN | Large HR subtree — code presence only |
| InsightBooks SaaS admin | ✓ | ✓ | ✓ | ✓ | ○ | ○ | UNKNOWN | Tenant/billing admin |
| EIS integration | ✓ | ✓ | ✓ | ○ | ○ | ○ | UNKNOWN | EIS routes + cron sync |
| Budget / forecast (legacy bf) | ✓ | ✓ | ✓ | ✓ | ○ | ○ | PARTIAL | `/api/bf/*` coexists with financial-planning V2 |

---

## System / platform

| Module | C | R | U | D | A | P | Status |
|---|---|---|---|---|---|---|---|
| Auth / tenants | ✓ | ✓ | ✓ | ○ | ○ | ○ | PARTIAL |
| System health | ○ | ✓ | ○ | ○ | ○ | ○ | REVIEWED_CODE |
| Cutover gates | ○ | ✓ | ○ | ○ | ○ | ○ | REVIEWED_CODE |
| Maintenance mode | ○ | ✓ | ✓ | ○ | ○ | ○ | REVIEWED_CODE |
| Cron jobs | ✓ | ○ | ○ | ○ | ○ | ✓ | PARTIAL |

---

## Interpretation

- **REVIEWED_CODE** means the repository contains coherent API + lib + (usually) unit/domain tests — not production readiness.
- **PARTIAL** indicates legacy/V2 overlap, failing tests, or incomplete migration wiring.
- **UNKNOWN** modules need dedicated audit workstreams before release certification.

See `MODULE_INTEGRATION_MATRIX.md` for cross-module dependencies and `SYSTEM_DEFECT_REGISTER.md` for open items.
