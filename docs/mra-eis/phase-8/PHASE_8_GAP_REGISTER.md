# Phase 8 Gap Register

| ID | Gap | Severity | Mitigation |
|---|---|---|---|
| G8-01 | Request hash unverified (Q-010/Q-011) | CRITICAL (non-mock) | Fail closed outside MOCK |
| G8-02 | Config endpoint sandbox verification | HIGH | Provisional contracts; mock covers flows |
| G8-03 | Production sync gated | CRITICAL (prod) | Hard block in client + readiness |
| G8-04 | Live sandbox not executed | MEDIUM | Manual authorized only |
| G8-05 | Shared rate-limit / queue fairness store | LOW | In-process + BOD batch limit |
| G8-06 | Approval deep-wiring for forced activate | MEDIUM | Conflict → Manual Review |
| G8-07 | Version semantic ordering | LOW | Equality-based comparison |

---
*Phase 8 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock/local-tax mutations. Snapshots immutable. Activation atomic. Offline remains disabled.*
