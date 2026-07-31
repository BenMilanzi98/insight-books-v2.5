# Reliability Risk Register

Reliability risks distinct from pure performance. IDs are **PR-** prefixed; no fabricated audit finding numbers.

| ID | Risk | Likelihood | Impact | Detection | Mitigation | Status |
|---|---|---|---|---|---|---|
| PR-01 | PostgreSQL single point of failure | Medium | Critical | DB connection errors, health `/ready` fail | Backups, restore drill ([DISASTER_RECOVERY_RUNBOOK.md](./DISASTER_RECOVERY_RUNBOOK.md)) | Open |
| PR-02 | Connection pool exhaustion | Medium | High | `too many clients`, rising wait time | Pool sizing, backpressure | Open |
| PR-03 | Outbox without dispatcher | Low–Medium | Medium | ARCH-005 audit, growing `AcctV2OutboxMessage` pending count | Implement dispatcher | Open |
| PR-04 | In-memory rate limit split-brain (multi-instance) | Low (single node) / High (cluster) | Medium | Abuse logs, uneven 429 rates | Shared rate limit store | Open |
| PR-05 | Cron secret leakage | Low | High | Security audit | Rotate `CRON_SECRET`, IP allowlist | Open |
| PR-06 | Ungraceful shutdown mid-posting | Medium | Critical | Partial journal (should rollback) | Transaction boundaries + [GRACEFUL_SHUTDOWN.md](./GRACEFUL_SHUTDOWN.md) | Mitigated by design |
| PR-07 | Stale report served as truth | Low | High | REP-030 reconciliation | Version-based cache invalidation | Mitigated |
| PR-08 | Duplicate posting under retry | Low | **Critical** | Idempotency tests, P2002 handling | Zero error budget ([ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md)) | Mitigated |
| PR-09 | Backup restore untested RTO | Medium | Critical | No timed restore evidence | Migration rehearsal + DR drill | **NOT CERTIFIED** |
| PR-10 | Disk full on uploads volume | Medium | Medium | Host monitoring | Volume alerts | Open |
| PR-11 | Long-running report blocks event loop | Low | Medium | Event loop lag metric | Timeouts, worker offload (future) | Open |
| PR-12 | Tenant data leak under load | Low | Critical | QA isolation matrix | Tenant scoping in all queries | Test coverage partial |
| PR-13 | Health check false positive | Medium | Medium | Docker HEALTHCHECK hits wrong path | Fix health routes | In progress |
| PR-14 | Schema migration failure in prod | Low | Critical | CI migrate deploy | Rehearsal runbook | Partial |

---

## Acceptance criteria for Phase 17 exit

- PR-01, PR-09: timed restore documented in [RECOVERY_OBJECTIVES.md](./RECOVERY_OBJECTIVES.md)
- PR-03: dispatcher or explicit waiver with monitoring
- PR-08: verified under [DATA_CONSISTENCY_UNDER_LOAD.md](./DATA_CONSISTENCY_UNDER_LOAD.md)

---

## Cross-links

- [RISK_REGISTER.md](./RISK_REGISTER.md) — combined view
- [accounting-architecture/RISK_REGISTER.md](../accounting-architecture/RISK_REGISTER.md)
