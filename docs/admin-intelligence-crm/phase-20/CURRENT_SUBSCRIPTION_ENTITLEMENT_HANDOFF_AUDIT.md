# Current Subscription / Entitlement Handoff Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Subscription from accepted snapshot | PARTIAL | EXTEND | `subscription.js` `createOrAmendSubscriptionFromAccepted` |
| Closed Won ≠ ACTIVE | READY | CORRECT_AND_REUSABLE | Domain contract `closedWonImpliesActive: false`; activation policy gate |
| Entitlement qty ≤ accepted | PARTIAL | EXTEND | `entitlements.js` `provisionEntitlementsFromAccepted` |
| Activation AFTER_PAYMENT | READY | CORRECT_AND_REUSABLE | `activation.js` `resolveAuthoritativePaymentSuccess` fail-closed |
| Billing / invoice from snapshot | PARTIAL | EXTEND | `billing.js` — Platform Invoice; Tenant Invoice WRONG_DOMAIN |
| Payment NOT_CONFIGURED typed | READY | CARRY | Explicit when provider missing |
| Training / Migration / MRA requirement handoffs | READY | CORRECT_AND_REUSABLE | `trainingHandoff.js`, `migrationHandoff.js`, `mraEisHandoff.js` — execution NOT_STARTED |
| CS assignment | READY | CORRECT_AND_REUSABLE | `customerSuccess.js` — ownership only |
| No MRA fiscal submit from conversion | READY | CORRECT_AND_REUSABLE | Handoff payload only |

**Implication:** Subscription/entitlement/request honesty largely present; Wave 3 seals edge cases where status jumps to ACTIVE/PROVISIONED without provider result.
