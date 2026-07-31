# Remaining Risk Register

| Field | Value |
|---|---|
| Scope | System-wide residual risks after inventory + code review |
| Mitigation status | Mixed — many tracked in phase-specific registers |

---

## Critical / High

| ID | Risk | Source | Mitigation | Residual |
|---|---|---|---|---|
| SYS-R-001 | Full test suite failures unknown — regressions may be masked | SYS-DEF-001 | Baseline `npm test` in CI | **Open** |
| SYS-R-002 | Production data never forensically audited in this pass | Phase 1 local-only | Run `audit:forensic` on prod copy | **Open** |
| SYS-R-003 | Phase 18 cutover not rehearsed | Cutover docs | Dry-run manifest | **Open** |
| SYS-R-004 | Phase 17 capacity not certified | Performance docs | Load harness + certification | **Open** |
| SYS-R-005 | Legacy posting paths bypass V2 registry | P2-01, R-15 | Phase 9 wiring / posting matrix | **Open** |
| SYS-R-006 | Dual ledger double-count (Transaction + JE + AcctV2) | R-22 | Migration + recon | **Open** |
| SYS-R-007 | Security HTTP gaps (IDOR, reversal authz) | DEF-SEC-002–004 | Phase 17 HTTP suites | **Open** |
| SYS-R-008 | Report engine failing tests | DEF-REP-* | GAP-QA-011 | **Open** |

---

## Medium

| ID | Risk | Mitigation | Residual |
|---|---|---|---|
| SYS-R-009 | Outbox enqueue without dispatcher | ARCH-005 monitor; ship worker | **Open** |
| SYS-R-010 | No E2E / Playwright smoke | GAP-QA-015 | **Accepted deferred** |
| SYS-R-011 | Nullable tenantId on accounts | COA-012 checks | **Deferred** |
| SYS-R-012 | Status casing drift on legacy journals | Normalization backlog | **Open** |
| SYS-R-013 | Shadow mode write load if enabled | Flag governance | **Low if off** |
| SYS-R-014 | In-memory metrics lost on restart | P2-05 | **Accepted** |
| SYS-R-015 | Local migrate dev shadow-DB limitation | migrate diff procedure | **Accepted** |

---

## Low / Accepted

| ID | Risk | Notes |
|---|---|---|
| SYS-R-016 | Advisory modules could gain GL post via future bug | REG-PLAN-NOGL / REG-LRD-NOGL + invariants |
| SYS-R-017 | Cron job failure silent without observability | Phase 17 dashboards draft |
| SYS-R-018 | 681 API routes — authz not per-route reviewed | API_SECURITY_AUDIT stub |

---

## Cross-phase registers

| Register | Path |
|---|---|
| Phase 1 accounting | `docs/accounting-audit/RISK_REGISTER.md` |
| Phase 2 architecture | `docs/accounting-architecture/RISK_REGISTER.md` |
| QA | `docs/quality-assurance/RISK_REGISTER.md` |
| Performance | `docs/performance-reliability/RISK_REGISTER.md` |

---

## Review cadence

- Update after each **npm test baseline** and **forensic prod copy** run.
- All **Critical** risks must be Closed or Accepted with sign-off before production cutover (`docs/production-cutover/STOP_CONDITIONS.md`).
