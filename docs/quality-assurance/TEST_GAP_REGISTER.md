# Test Gap Register

Phase 16 gap IDs use prefix **GAP-QA-**. Linked finding IDs (SEC-*, R-*, TEN-*, GAP-SEC-*, etc.) come from prior phases only.

| Gap ID | Title | Linked findings | Current state | Target | Owner WS | Severity | Status |
|---|---|---|---|---|---|---|---|
| GAP-QA-001 | CI not green — 55 failing Vitest cases | R-01, R-06, legacy posting removal | 13 files fail on `npm test` | Zero failures on default CI path | AV | **Critical** | IN_PROGRESS |
| GAP-QA-002 | No code coverage measurement | — | No Vitest coverage config | ≥70% lines on `lib/accountingV2`, `lib/securityGovernance` per `TEST_COVERAGE_POLICY.md` | AW | High | NOT_STARTED |
| GAP-QA-003 | SEC-2 supplier IDOR — no regression test | SEC-2, R-20, TEN-003, GAP-SEC-013 | No HTTP test | `test/qa/supplier-idor.test.js` | BF | **Critical** | NOT_STARTED |
| GAP-QA-004 | SEC-3/4 route RBAC — no integration tests | SEC-3, SEC-4, R-21, GAP-SEC-015/016 | `authz.test.js` helper only | `test/qa/reversal-authz.test.js`, `test/qa/capital-authz.test.js` | BG | High | NOT_STARTED |
| GAP-QA-005 | Middleware catalogue test missing | GAP-SEC-011, GAP-SEC-012 | Manual inventory only | `test/qa/middleware-catalogue.test.js` | BH | High | NOT_STARTED |
| GAP-QA-006 | `securityGovernance.policy.test.js` not created | GAP-SEC-004, THR-007–016 | Engine domain tests exist | Full policy facade tests | BI | High | NOT_STARTED |
| GAP-QA-007 | `securityGovernance.sod.test.js` not created | GAP-SEC-005/006, THR-016 | Module-local SoD only | Central registry deny cases | BJ | High | NOT_STARTED |
| GAP-QA-008 | `securityGovernance.session.test.js` not created | GAP-SEC-001/002/003, THR-002/003 | Cookie encode/decode in engine test | Sign, revoke, expiry integration | BK | High | NOT_STARTED |
| GAP-QA-009 | Equity HTTP / SoD tests absent | EQT-035, SEC-4 class | Domain tests only | `test/qa/equity-approval.test.js` | BL | Medium | NOT_STARTED |
| GAP-QA-010 | Loan readiness SoD route tests absent | LRD-017, THR-020 | Engine tests only | `test/qa/loan-readiness-sod.test.js` | BM | Medium | NOT_STARTED |
| GAP-QA-011 | `accountingV2.reports.test.js` regression — mass failure | TB-003, CAP-005, R-06 | ~40 cases failing | Fix stub/fixture drift; lock with snapshots | AV | **Critical** | IN_PROGRESS |
| GAP-QA-012 | AP-004 phantom liability — no unit regression | R-05, AP-004 | Audit engine only | `test/qa/liability-journal-link.test.js` | BN | High | NOT_STARTED |
| GAP-QA-013 | Legacy callers still invoke removed `postGlEntry` | R-01, R-22–25 | `accountingEngine.test.js`, `inventoryWriteOffJournal.test.js`, `payrollReversalLegacyRoot.test.js` fail | Migrate to V2 adapters or mark deprecated with explicit skip + ticket | AV | **Critical** | IN_PROGRESS |
| GAP-QA-014 | DB integration tests skip silently in CI | TEN-001 data scenarios | 3 files use `skipIf` without tenant | Seed `QA-Accounting` job or document waiver | BO | Medium | IN_PROGRESS |
| GAP-QA-015 | No Playwright / E2E smoke | — | None | Login + TB page smoke in Phase 17 | BP | Medium | NOT_STARTED |
| GAP-QA-016 | No testcontainers for isolated PG | — | Optional secret DB only | Local reproducibility (Phase 17) | BQ | Low | NOT_STARTED |
| GAP-QA-017 | Retired posting tests permanently skipped | R-03 | 23 skipped in posting.test.js | Archive to `test/qa/retired/` or delete with ADR | BR | Low | PENDING |
| GAP-QA-018 | No API contract / OpenAPI tests | ADR-005 | — | Generated route manifest tests | BS | Medium | NOT_STARTED |
| GAP-QA-019 | Webhook signature tests absent | GAP-SEC-022, E25 | Engine has `verifyWebhookSignature` unit test | `test/qa/webhook-replay.test.js` | BT | Medium | NOT_STARTED |
| GAP-QA-020 | Upload auth gateway untested | GAP-SEC-009/010 | `assertSafeUpload` in engine test | HTTP upload deny cases | BU | High | NOT_STARTED |
| GAP-QA-021 | AI governance route tests incomplete | GAP-SEC-018/019 | Partial engine tests | `test/qa/ai-governance.test.js` | BV | Medium | NOT_STARTED |
| GAP-QA-022 | `verify:accounting-scenario` not required in CI | R-04, AR-001 | Optional step | Required on staging; optional PR with label | AX | High | IN_PROGRESS |
| GAP-QA-023 | No flaky-test quarantine workflow | — | Ad hoc skips | See `FLAKY_TEST_POLICY.md` | AY | Medium | NOT_STARTED |
| GAP-QA-024 | Phase 15 exit test bar unmet | PHASE_16_READINESS gate #7 | BW–BY not started | 90% THR-007–016 automated | BI–BK | **Critical** | NOT_STARTED |
| GAP-QA-025 | Migration rehearsal not automated | R-01, R-08 | Manual script only | `MIGRATION_REHEARSAL_RUNBOOK.md` + CI job | AZ | High | NOT_STARTED |

---

## Severity summary

| Severity | Open count |
|---|---|
| Critical | 5 |
| High | 10 |
| Medium | 9 |
| Low | 1 |

---

## Closure criteria (each GAP-QA)

1. Automated test(s) merged under `test/` or `test/qa/`.
2. CI gate updated if applicable (`CI_QUALITY_GATES.md`).
3. Entry moved to **DONE** in `PHASE_16_TASKS.md`.
4. Traceability row updated in `REQUIREMENT_TEST_TRACEABILITY_MATRIX.md`.

No gap closes on documentation alone.
