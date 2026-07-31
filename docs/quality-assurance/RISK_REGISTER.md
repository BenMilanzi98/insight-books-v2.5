# Risk Register — Quality Assurance Lens

QA-specific view of testing and release risks. **Financial/security finding IDs reused from prior phases** — not invented. Complements `docs/accounting-audit/RISK_REGISTER.md` (R-01–25) and `docs/security-governance/SECURITY_CONTROL_GAP_REGISTER.md`.

Status: **Open** / **Mitigated** / **Monitored** / **Accepted**

| Risk ID | Description | Source finding | Severity | Test mitigation | Owner WS | Status |
|---|---|---|---|---|---|---|
| QA-R01 | CI red — 55 failing Vitest cases block release | GAP-QA-001 | **Critical** | Fix AT, AU, AW | AV | Open |
| QA-R02 | Reports suite failure hides CAP-005 / TB-003 regressions | R-06, TB-003 | **Critical** | `accountingV2.reports.test.js` green | AT | Open |
| QA-R03 | Legacy callers broken by postGlEntry removal untested on V2 path | R-22–25, GAP-QA-013 | **Critical** | Migrate + REG-* tests | AW | Open |
| QA-R04 | SEC-2 supplier IDOR — zero HTTP tests | SEC-2, R-20, GAP-SEC-013 | **Critical** | `supplier-idor.test.js` | BF | Open |
| QA-R05 | Phase 15 security suites missing — THR bar unmet | GAP-QA-024, PHASE_16_READINESS #7 | **Critical** | BW–BK | BI–BK | Open |
| QA-R06 | No coverage measurement on financial kernel | GAP-QA-002 | High | BA, BB | Open |
| QA-R07 | DB integration silently skipped in CI | GAP-QA-014 | High | BE, BO, G5 nightly | Monitored |
| QA-R08 | 23 permanently skipped posting tests obscure coverage | GAP-QA-017 | Medium | Archive BR | Accepted (waiver W-SKIP-RETIRED) |
| QA-R09 | AR-001 only in optional CI step | R-04 | High | Require G5 staging | AX | Monitored |
| QA-R10 | AP-004 phantom liability — no regression test | R-05 | High | `liability-journal-link.test.js` | BN | Open |
| QA-R11 | Middleware catalogue untested — new modules exposed | GAP-SEC-011 | High | `middleware-catalogue.test.js` | BH | Open |
| QA-R12 | E2E absence — UI auth flows unverified | — | Medium | Phase 17 Playwright | Accepted |
| QA-R13 | Migration rehearsal manual only | GAP-QA-025 | High | AZ automation | Open |
| QA-R14 | Float assertions (`toBeCloseTo`) on financial KPIs | R-10 | Low | Integer minor policy | Monitored |
| QA-R15 | Phase 16 starts before Phase 15 code exit | security PHASE_16_READINESS | High | Gate coordination | Monitored |
| QA-R16 | RLS false negatives if tested too early | GAP-SEC-025 | Medium | Defer to Phase 16+ compliance | Accepted |
| QA-R17 | Flaky quarantine without policy | — | Medium | FLAKY_TEST_POLICY | AY | Mitigated (policy DONE) |
| QA-R18 | Waiver sprawl without governance | — | Medium | TEST_WAIVER_GOVERNANCE | Mitigated |
| QA-R19 | Dual admin/tenant auth untested end-to-end | GAP-SEC-028 | Low | Documented | Accepted |
| QA-R20 | AI routes partial governance tests | GAP-SEC-018/019 | Medium | `ai-governance.test.js` | BV | Open |

---

## Mapping to programme risks (selected)

| Programme ID | QA risk bridge |
|---|---|
| R-01 | QA-R02, QA-R03 |
| R-04 | QA-R09 |
| R-05 | QA-R10 |
| R-06 | QA-R02 |
| R-19 / SEC-1 | QA-R04 (partial QA-R03) |
| R-20 / SEC-2 | QA-R04 |
| R-21 / SEC-3/4 | QA-R05 |
| GAP-SEC-001–030 | QA-R05, QA-R11, QA-R04 |

---

## Severity summary

| Severity | Open |
|---|---|
| Critical | 5 |
| High | 7 |
| Medium | 4 |
| Low | 1 |
| Mitigated/Accepted | 4 |

---

## Review cadence

| Activity | Frequency |
|---|---|
| Full register review | Sprint |
| Critical risk stand-down | Weekly until QA-R01 closed |
| Pre-release scan | Each certification (`RELEASE_CERTIFICATION_PROCESS.md`) |

---

## Acceptance criteria for production

No open **Critical** QA-R* without:
1. Compensating manual control documented
2. Waiver with expiry
3. Finance + security sign-off

Target: **zero Critical** at Phase 18 certification.

---

## Related

- `TEST_GAP_REGISTER.md`
- `docs/accounting-audit/RISK_REGISTER.md`
- `docs/security-governance/THREAT_MODEL.md`
- `PHASE_16_TASKS.md`
