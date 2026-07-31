# Current Subscription Provisioning Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| AccountSubscription model | FOUNDATION | plan/txRef/amount/status/isActive/isTrial |
| `subscriptionService` | FOUNDATION | Trial/upgrade/status/EIS helpers |
| Admin Tenant create trial | FOUNDATION / SUBSCRIPTION_DUPLICATION_RISK | Auto trial; conversion must create-or-link |
| `assertNoDuplicateActiveSubscription` | CORRECT_AND_REUSABLE helper | `lib/admin/platformBilling.js` |
| Snapshot-driven subscription | NOT_FOUND | — |
| Closed Won ⇒ ACTIVE | FORBIDDEN / absent | Honesty flags false |
| CREATE_OR_AMEND_SUBSCRIPTION | NOT_FOUND | — |
| `subscriptionConfig.js` prices | WRONG_SOURCE | Must not override accepted snapshot |

**Implication:** Wave 3 from accepted pricing snapshot; Closed Won ≠ ACTIVE.
