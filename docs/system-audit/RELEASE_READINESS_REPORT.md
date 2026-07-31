# Release Readiness Report

| Field | Value |
|---|---|
| Verdict | **NOT READY** — zero-defect production release **not** supported by current evidence |
| Date | 2026-07-22 |
| Branch | `v2` |

---

## Executive verdict

InsightBooks V2 is **NOT READY** for a claim of production release with zero known defects. Automated Vitest is green and inventory exists, but capacity certification, cutover execution, production forensic, outbox consumer, and full manual E2E remain open.

---

## Gate summary

| Gate | Required | Actual | Pass? |
|---|---|---|---|
| Full `npx vitest run` green | All suites pass | **923 passed** / 29 skipped / **0 failed** | ✅ |
| Phase 16 QA / PR-fast | Critical suites green | **117 passed** (`test:pr-fast`) | ✅ |
| Phase 17 capacity certified | Load/SLO evidence | **NOT CERTIFIED** | ❌ |
| Phase 18 cutover executed | Manifest + control totals | **NOT EXECUTED** | ❌ |
| Production forensic audit | TB/GL/CoA clean on prod copy | **PENDING** | ❌ |
| Data integrity script (prod) | FK/orphan/balance clean | **PENDING** | ❌ |
| E2E UI smoke | Critical paths | **None** (SYS-DEF-014) | ❌ |
| Outbox dispatcher | Consumer running | **Missing** (SYS-DEF-004) | ❌ |
| Report engine unit tests | accountingV2.reports | **PASSING** | ✅ |
| Legacy posting fail-closed | `LEGACY_POSTING_REMOVED` | **PASSING** | ✅ |

---

## What IS in place

- **109** Prisma migrations through `security_governance_v2`
- V2 API surfaces for accounting, CoA, bank recon, equity, close, planning, loan readiness, security
- **106** test files including QA invariants, property tests, permanent regressions
- Phase documentation under `docs/accounting-audit/`, `docs/quality-assurance/`, `docs/performance-reliability/`, `docs/production-cutover/`
- Read-only forensic audit engine and data integrity scripts
- Permanent regressions: REG-CAP-005, REG-SAL-5200, REG-EXP-5000, REG-PLAN-NOGL, REG-LRD-NOGL

---

## Conditions to reassess readiness

1. Record and drive **npm test** baseline to agreed waiver threshold or zero failures.
2. Complete **Phase 17 capacity certification** with artifact in `artifacts/performance-reliability/`.
3. Execute **cutover rehearsal** (not necessarily prod) with control totals matched.
4. Run **forensic + integrity** on production copy; close or waive each Critical/High finding.
5. Ship or explicitly accept **outbox dispatcher** backlog risk.
6. Close or waive **DEF-SEC-*** and **DEF-REP-*** catalogue items.

---

## Related documents

- `FINAL_SYSTEM_AUDIT_REPORT.md` — audit conclusion
- `SYSTEM_DEFECT_REGISTER.md` — open defects
- `docs/quality-assurance/PHASE_18_READINESS.md`
- `docs/production-cutover/PHASE_18_TASKS.md`
- `artifacts/quality-assurance/release-certification-latest.json` — draft certification artifact

**Do not** mark release ready until this report is updated with dated evidence for each gate.
