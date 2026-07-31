# Current Activation Policy Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Conversion activation policy engine | NOT_FOUND | immediate / after invoice / after payment / service date / manual |
| Tenant.status default active | PARTIAL_CONVERSION_RISK | Admin create sets `active` without policy |
| AccountSubscription.isActive | FOUNDATION | Separate from Tenant.status |
| MRA activation attempts | WRONG_DOMAIN | Phase 7 product activation models |
| `activateProvisionedSubscription` | NOT_FOUND | Plan interface name |
| Closed Won ⇒ ACTIVE | FORBIDDEN / CORRECT_AND_REUSABLE honesty | Close + readiness flags |

**Implication:** Wave 3 activation policies; ACTIVE only when prerequisites pass.
