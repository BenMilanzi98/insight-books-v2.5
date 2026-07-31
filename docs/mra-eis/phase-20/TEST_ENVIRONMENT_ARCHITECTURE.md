# Test Environment Architecture

| Env | Fiscal TX | MRA calls | Default |
|---|---|---|---|
| LOCAL_UNIT / CI_UNIT | Synthetic | MOCK only | YES |
| MOCK_MRA | Synthetic | mock://mra-eis | YES |
| MRA_SANDBOX | Synthetic taxpayer | Explicit enablement | NO |
| CERTIFICATION | Approved only | Explicit approval | NO |
| PRODUCTION | Forbidden for auto tests | Forbidden | NO |

Isolation: test DB/queues/caches/email sinks. Production protected.

---
*Phase 20 — Complete automated testing, security, reliability and release readiness. Mock success ≠ Sandbox certification ≠ Production readiness. Production MRA is never called automatically. No historical Sale submission. No Critical/High code defects remaining in CI suite. Carry-forward: authorized Sandbox contracts, Staging load/soak/chaos, Production migration extract.*
