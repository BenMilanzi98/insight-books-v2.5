# Performance Baselines

| Operation | Target (Staging) | Status |
|---|---|---|
| Fiscal-number allocation | P95 < 100ms under 50 concurrent | DEFERRED Staging |
| Transmission worker | Recoverable backlog | DEFERRED |
| Dashboard overview | P95 < 2s | PARTIAL unit |
| Migration Dry Run 1k rows | < 60s | DEFERRED |

Unit gates do not claim Staging load pass.

---
*Phase 20 — Complete automated testing, security, reliability and release readiness. Mock success ≠ Sandbox certification ≠ Production readiness. Production MRA is never called automatically. No historical Sale submission. No Critical/High code defects remaining in CI suite. Carry-forward: authorized Sandbox contracts, Staging load/soak/chaos, Production migration extract.*
