# Phase 18 Readiness — Release Certification

Final assurance phase before **production financial cutover** certification. Depends on Phase 16 (CI + matrices) and Phase 17 (E2E + nightly DB).

**Production cutover documentation (framework — cutover NOT EXECUTED):** [`docs/production-cutover/`](../production-cutover/README.md) — start with [`PHASE_18_TASKS.md`](../production-cutover/PHASE_18_TASKS.md) and [`FINAL_PHASE_18_REPORT.md`](../production-cutover/FINAL_PHASE_18_REPORT.md).

---

## Purpose

Formal **release certification** combining automated gates, migration rehearsal evidence, and human sign-off (`RELEASE_CERTIFICATION_PROCESS.md`).

---

## Entry gates

| # | Gate | Source | Status |
|---|---|---|---|
| 1 | Phase 17 E2E smoke green | `test/e2e/smoke/` | NOT_STARTED |
| 2 | Staging migration rehearsal ×2 | `MIGRATION_REHEARSAL_RUNBOOK.md` | NOT_STARTED |
| 3 | Phase 15 security exit | GAP-SEC critical closed + BW–BY | NOT MET |
| 4 | Finance UAT on pilot tenant | Manual | NOT_STARTED |
| 5 | Rollback drill | security ROLLBACK_STRATEGY Tier 2–3 | NOT MET |
| 6 | Zero open Critical ACC-INV without waiver | Invariant catalogue | NOT MET |
| 7 | `FINAL_PHASE_15_REPORT.md` | security-governance | NOT MET |

---

## Certification artefacts (release packet)

| Artefact | Path |
|---|---|
| Unit test report | CI `npm test` artifact |
| Coverage report | `lcov.info` |
| DB scenario JSON | `verify-accounting-scenario` stdout |
| Migration rehearsal sign-off | `artifacts/quality-assurance/rehearsal-*-signoff.md` |
| Open gap list | `TEST_GAP_REGISTER.md` (only Low/Medium open) |
| Waiver register | `TEST_WAIVER_GOVERNANCE.md` |
| Risk acceptance | `RISK_REGISTER.md` signed rows |
| Security residual | `docs/security-governance/THREAT_MODEL.md` |

---

## Go / no-go criteria

### Go

- All **G1–G5** gates green on staging within 24h of cutover window
- No open **Critical** GAP-QA or GAP-SEC without expired waiver
- Finance approves TB + BS pilot tenant
- Rollback window tested < 4h restore

### No-go

- Any TEN-001 / P6-XTEN-001 on pilot tenant
- AR-001 &gt; materiality threshold
- SEC-2 IDOR unfixed without compensating WAF (not approved today)
- `accountingV2.reports.test.js` equivalent manual failures

---

## Timeline (placeholder)

| Milestone | Target |
|---|---|
| Phase 16 exit | After AV + BF–BK |
| Phase 17 E2E | +4–6 weeks |
| Staging rehearsal #1 | Before beta |
| Staging rehearsal #2 | 7 days pre-cutover |
| Certification meeting | Cutover −2 days |

---

## Roles

| Role | Certification duty |
|---|---|
| Release manager | Owns packet |
| Engineering lead | G1–G4 evidence |
| QA lead | Matrices + rehearsal |
| Security | SEC-INV + Phase 15 exit |
| Finance | MT-003, CAP-005, TB sign-off |

---

## Post-cutover (Phase 18+)

- 48h hypercare: nightly G5 + audit delta
- 30d: AR-001 / GL-002 trending
- Pen test remediation backlog from Phase 16 security hardening

---

## Document status

| Field | Value |
|---|---|
| Version | 0.1 |
| Last updated | July 2026 |

See `RELEASE_CERTIFICATION_PROCESS.md` for step-by-step procedure.
