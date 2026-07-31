# Current Onboarding Provisioning Readiness Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Dedicated provisioning readiness module | NOT_FOUND | No `lib/admin/customerSuccess/onboarding/readiness/provisioning.js` (glob verified absent) |
| Tenant pin evaluate (thin cover) | PARTIAL | `lib/admin/customerSuccess/onboarding/readiness/tenant.js` — `evaluateTenantReadiness` / `READINESS_STATUS`; missing `tenantId` → `UNKNOWN`; tenant not found → `NOT_READY`; model unavailable with pin → `UNKNOWN` (never invents READY) |
| Aggregate dimension | PARTIAL | Tenant dimension wired in `lib/admin/customerSuccess/onboarding/readiness/evaluate.js` `CORE_DIMENSIONS`; no separate provisioning status in aggregate |
| REQUESTED/PROCESSING ≠ READY | GAP | Must enforce Wave 2 — provision request lifecycle must not green-light go-live readiness |
| Fabricated Tenant/Business/Branch IDs | FORBIDDEN | Must remain false — readiness evaluates pins only; no identity mint from onboarding |
| Phase 20 provision requests | CORRECT_AND_REUSABLE input | Consume as request truth only via handoff/Request spine (`handoffConsume.js` → Request); not as provisioning READY proof |

**Gaps:** G21-07 → Wave 2 (dedicated provisioning readiness honesty).
