# Current Provisioning Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Wave 2 Customer/Tenant/Business/Branch | PARTIAL | EXTEND | `wave2Runner.js`, `customerProvision.js`, `tenantProvision.js`, `businessBranch.js` |
| Wave 3 Subscription/billing/payment/activation | PARTIAL | EXTEND | `wave3Runner.js` + subscription/billing/payment/activation modules |
| Request ≠ result honesty | PARTIAL | EXTEND | Resource statuses + activation policy; deepen never ACTIVATED/PROVISIONED without provider |
| Payment initiation ≠ PAID | READY | CORRECT_AND_REUSABLE | `paymentBoundary.js`; `activation.js` ignores caller booleans |
| Invitation hash-only | READY | CORRECT_AND_REUSABLE | `invitations.js` — no temp passwords |
| Tenant GL forbidden | READY | CORRECT_AND_REUSABLE | `accountingBoundary.js` |
| Partial failure → PARTIALLY_COMPLETED | PARTIAL | EXTEND | Status machine supports; resume after fail Wave 3 Vitest |
| Dry-run zero side effects | READY | CORRECT_AND_REUSABLE | `dryRun.js` |
| Fabricate Tenant/Subscription from handoff alone | — | FORBIDDEN | Orchestrator requires execute path |

**Implication:** Provisioning spine exists with honesty intent; Wave 3 Critical = no fabricated terminal provision/activation statuses.
