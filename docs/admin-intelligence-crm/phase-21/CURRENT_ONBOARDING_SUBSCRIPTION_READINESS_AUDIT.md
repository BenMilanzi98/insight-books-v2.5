# Current Onboarding Subscription Readiness Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Subscription pin on Project/Request | FOUNDATION | `subscriptionId` on CustomerOnboarding Request/Project models (prisma); loaded by readiness configuration path |
| Evaluate via configuration | PARTIAL | `lib/admin/customerSuccess/onboarding/readiness/configuration.js` — `evaluateConfigurationReadiness` loads `prisma.subscription.findUnique` by pin; returns plan evidence; missing pin/model → `UNKNOWN` |
| Dedicated subscription readiness module | NOT_FOUND | No `lib/admin/customerSuccess/onboarding/readiness/subscription.js` — honesty via configuration only today |
| ACTIVE only from authoritative service | GAP | Must not invent ACTIVE from pin/request alone — Wave 2 (G21-08) |
| Closed-Won ≠ Subscription ACTIVE | CORRECT_AND_REUSABLE upstream | Phase 20 conversion honesty; onboarding must not re-derive ACTIVE from CRM Closed-Won |

**Gaps:** G21-08 → Wave 2.
