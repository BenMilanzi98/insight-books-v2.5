# Module Integration Matrix

| Field | Value |
|---|---|
| Validation basis | Code paths + phase evidence indexes |
| Full e2e | **PENDING** — most rows remain PENDING until rehearsal |
| Production cutover | **NOT EXECUTED** |

**Status legend:** **VALIDATED** = automated test or forensic script green on sample data; **PARTIAL** = unit/domain only; **PENDING** = not rehearsed end-to-end; **N/A** = advisory/no GL link

---

## Core accounting integrations

| From → To | Required link | Status | Evidence / gap |
|---|---|---|---|
| Sales/POS → Posting engine → GL | Invoice/sale payment posts balanced journals | PARTIAL | `accountingV2.integrations.test.js`; dual-ledger risk R-22 |
| Expenses → CoA V2 resolver → GL | Expense lines in 5xxx band | PARTIAL | REG-EXP-5000 regression; mapping registry partial rollout |
| Payroll → 5200 Salaries → GL | Payroll debit to canonical 5200 | PARTIAL | REG-SAL-5200 regression; reversal tests failing |
| Purchases/AP → GL | Bill + payment journals | PENDING | Source linkage audit module exists; prod run pending |
| Capital contributions → Equity GL | Single equity credit per contribution | PARTIAL | REG-CAP-005 regression; report display issues DEF-R06 |
| Opening balances → Periods → GL | OB only in open period | REVIEWED_CODE | opening balance service + tests |
| Invoices partial pay/refund → GL | Payment journals idempotent | PARTIAL | Modified routes; integration tests partial |
| Inventory write-off → GL | COGS/inventory journals | PENDING | `inventoryWriteOffJournal.test.js` **FAILING** (legacy removal) |
| Assets depreciation → GL | Scheduled depreciation post | PENDING | Route exists; e2e not recorded |
| Tax (Malawi PAYE/VAT) → GL | Tax element accounts | PARTIAL | `malawiPAYE.test.js`, tax routes |

---

## V2 platform integrations

| From → To | Required link | Status | Evidence / gap |
|---|---|---|---|
| Posting engine → Outbox | Same-transaction enqueue | PARTIAL | Outbox write exists; **dispatcher missing** (P2-06) |
| Posting engine → AcctV2 ledger projection | Summary balances updated | PARTIAL | Flag-gated `LEDGER_PROJECTION` |
| Periods → Posting engine | Closed period blocks post | REVIEWED_CODE | `accountingV2.periods.test.js` |
| CoA V2 mappings → Posting engine | `resolvePurposeAccount` | PARTIAL | Legacy hardcoded paths remain (R-15) |
| Bank recon → GL | Matched/adjustment journals | PARTIAL | `bankReconciliation.completion.test.js` |
| Bank recon → Period close | Unreconciled blocks close | PARTIAL | `bankReconciliation.periodClose.test.js` |
| Equity mgmt → GL | Owner transactions post | REVIEWED_CODE | `equityManagement.workflows.test.js` |
| Accounting close → GL | Closing entries + TB check | REVIEWED_CODE | `accountingClose.domain.test.js` |
| Repair engine → GL | Anomaly repair posts | PARTIAL | Domain tests; prod anomalies unknown |
| Reports V2 → Ledger | Drill-down = line totals | PENDING | DEF-REP-025 **FAILING** |
| Financial planning → GL | **Must never post** | VALIDATED | REG-PLAN-NOGL |
| Loan readiness → GL | **Must never post** | VALIDATED | REG-LRD-NOGL |

---

## Security & tenancy

| From → To | Required link | Status | Evidence / gap |
|---|---|---|---|
| API routes → Tenant scope | All queries filtered by businessId | PARTIAL | `tenantScope.test.js`, `qa/multi-tenant` |
| Posting engine → Tenant validation | Cross-tenant lines rejected | REVIEWED_CODE | `accountingV2.postingEngine.test.js` REG-TEN-POST |
| Security governance → Approvals | Maker-checker on sensitive ops | PARTIAL | Engine test; HTTP suites NOT_STARTED (DEF-SEC-002–004) |
| Sessions → Security governance | Session revoke/audit | PENDING | Routes exist; e2e pending |

---

## Phase 17 / 18 platform

| From → To | Required link | Status | Evidence / gap |
|---|---|---|---|
| Health probes → Load balancer | `/api/system/health/*` | REVIEWED_CODE | Routes + `performanceReliability.engine.test.js` |
| Cutover gates → Manifest | All gates evaluated | PARTIAL | `productionCutover.engine.test.js`; **cutover NOT EXECUTED** |
| Capacity harness → SLO evidence | Load test certification | **PENDING** | Phase 17 **NOT CERTIFIED** |
| Forensic audit → Defect register | Production TB/GL anomalies | **PENDING** | `npm run audit:forensic` on prod copy not recorded |

---

## External integrations

| Integration | Status | Notes |
|---|---|---|
| EIS (electronic invoicing) | PENDING | Cron sync + API; prod validation unknown |
| Payment gateways / subscriptions | PENDING | Subscription model; not in V2 cutover scope review |
| Mobile app download/telemetry | PENDING | Mobile routes + maintenance flags |
| Email (payslips, reminders) | PENDING | Outbox for accounting; email delivery separate |

---

## Next validation steps

1. Run `npm run audit:forensic` on production database copy → append to `DATA_INTEGRITY_REPORT.md`.
2. Record full `npm test` baseline → `SYSTEM_DEFECT_REGISTER.md`.
3. Execute Phase 18 rehearsal manifest (dry run) → update cutover integration rows.
4. Close GAP-QA-015 (Playwright smoke) for UI ↔ API integration spot checks.
