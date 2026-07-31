# Phase 2 Risk Register

Phase 1 risks R-01…R-25 remain tracked in `docs/accounting-audit/RISK_REGISTER.md` — none are
closed by Phase 2 (it builds controls, it does not repair). New/updated entries for the
transition foundation:

| ID | Risk | Severity | Likelihood | Mitigation (implemented) | Residual owner |
|---|---|---|---|---|---|
| P2-01 | Legacy production paths still bypass the registry (nothing routes through the coordinator yet), so legacy duplicates remain possible until Phase 9 wiring | High | Certain (by design) | Registry ready; posting matrix defines wiring order; audit engine monitors | Phase 9 |
| P2-02 | SEC-1/SEC-2 legacy holes unchanged (Phase 2 does not modify legacy code) | Critical | Medium | V2 surfaces immune; adapter pre-validates tenancy; hotfix recommended independently (backlog P0-5) | Phase 4 / hotfix |
| P2-03 | Shadow mode enabled on a high-volume tenant could add write load | Medium | Low (off by default, admin-gated) | Config + flag double consent; performance review step in cutover strategy; ARCH-005 backlog alert | Ops |
| P2-04 | Flag/config misuse activating unsafe modes | High | Low | NEW_ENGINE refused at API and resolver; audit trail with reason; permission-gated | Phase 4 |
| P2-05 | In-memory metrics reset on restart (not durable) | Low | Certain | Durable queries documented in `OBSERVABILITY_GUIDE.md`; tables are the source of truth | Phase 4 |
| P2-06 | Outbox has no dispatcher yet — rows accumulate if any code enqueues heavily | Low | Low (only coordinator enqueues; coordinator unused in production) | ARCH-005 monitor | Phase 4 |
| P2-07 | Legacy adapters may drift from legacy behaviour as legacy code changes | Medium | Medium | Adapters wrap legacy functions (not copies) where possible; boundary tests pin import points | Each phase |
| P2-08 | `prisma migrate dev` unavailable locally (no shadow-DB permission) — future migrations must use the `migrate diff` + `migrate deploy` procedure | Low | Certain locally | Procedure documented in `MIGRATION_VALIDATION.md` | Eng |
| P2-09 | Pre-existing unrelated test failures (8 tests in 6 legacy suites) could mask regressions in CI | Medium | Certain | Verified pre-existing via stash bisect; listed in final report; fix independently | Eng |
| P2-10 | Content-hash omits some fields (dimensions/description), so a reused key with only those changed replays silently | Low | Low | Material fields (identity, date, currency, amount, lines) covered; extend hash in Phase 4 templates | Phase 4 |
