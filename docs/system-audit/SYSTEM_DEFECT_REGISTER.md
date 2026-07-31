# System Defect Register

| Field | Value |
|---|---|
| Status | **Updated 2026-07-22 — automated suite green; release still blocked** |
| Rule | Defect IDs assigned only when evidenced |

---

## Baseline evidence (2026-07-22)

| Gate | Result |
|---|---|
| Inventory | **157** pages, **681** APIs, **234** models, **109** migrations, **106** test files |
| `npm run test:pr-fast` | **PASS** (117 tests) |
| Full `npx vitest run` | **PASS** — **923 passed** / **29 skipped** / **0 failed** (was 55 failed at audit start) |
| Production `next build` | **PASS** (exit 0; earlier this audit) |
| `next lint` | **BROKEN** (missing `@next/next` plugin for deprecated CLI) — package `lint` switched to `eslint .` |
| Permanent REG-* QA regressions | **PASS** |

---

## Open — release blockers

| ID | Title | Severity | State | Evidence |
|---|---|---|---|---|
| SYS-DEF-002 | Phase 17 capacity **NOT CERTIFIED** | **High** | **Open** | `docs/performance-reliability/CAPACITY_CERTIFICATION.md` |
| SYS-DEF-003 | Phase 18 production cutover **NOT EXECUTED** | **High** | **Open** | `docs/production-cutover/` |
| SYS-DEF-004 | Outbox dispatcher missing | **Medium** | **Open** | Phase 17 architecture notes |
| SYS-DEF-005 | Production data-integrity forensic **PENDING** | **High** | **Open** | Scripts exist; not run on prod |
| SYS-DEF-007 | `next lint` / ESLint plugin config drift | **Low** | **Mitigated** | `package.json` `lint` → `eslint .`; `lint:next` kept |
| SYS-DEF-014 | Master prompt E2E / every-route manual validation incomplete | **High** | **Open** | Inventory exists; not every workflow exercised in browser |

---

## Closed this audit pass (test/code alignment)

| ID | Title | Severity | State | Fix |
|---|---|---|---|---|
| SYS-DEF-001 | Full vitest suite not green | High | **Closed** | Seeds/tests aligned to V2 journal authority; salary/IT rollup restored to 5200/5350; missing CoA helpers restored; inventory write-off tests use V2 adapter |
| SYS-DEF-010 | `journalAccountSelect` missing helpers broke unit tests | Medium | **Closed** | Restored helpers + formatter |
| SYS-DEF-011 | `accountingEngine.test.js` expected retired `postGlEntry` success path | High | **Closed** | Asserts `LEGACY_POSTING_REMOVED` |
| SYS-DEF-012 | `taxRateValidation.test.js` used `node:test` under Vitest | Medium | **Closed** | Converted to Vitest |
| SYS-DEF-013 | Payroll legacy reversal test expected removed GL writer | High | **Closed** | Asserts fail-closed `LEGACY_POSTING_REMOVED` |
| SYS-DEF-015 | P&L rollup sent salaries to 5301 / IT to 5702 | High | **Closed** | `incomeStatementOperatingExpenseRollup` + category map → 5200 / 5350 |
| SYS-DEF-016 | Report/period/repair fixtures still seeded legacy `Transaction` rows | High | **Closed** | Fixtures seed `architectureVersion: ACCOUNTING_V2` journals |

---

## Permanent regression coverage (still green)

| Regression ID | State |
|---|---|
| REG-CAP-005 / REG-EQT-035 | Closed (regression) |
| REG-SAL-5200 | Closed (regression) |
| REG-EXP-5000 | Closed (regression) |
| REG-PLAN-NOGL | Closed (regression) |
| REG-LRD-NOGL | Closed (regression) |

---

## Cross-references

- `KNOWN_DEFECT_REGRESSION_REPORT.md`
- `RELEASE_READINESS_REPORT.md` — **NOT READY**
- `FINAL_SYSTEM_AUDIT_REPORT.md`
