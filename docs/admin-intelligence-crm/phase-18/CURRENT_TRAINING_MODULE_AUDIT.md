# Current Training Module Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Module / ModuleVersion models | NOT_FOUND | No Training module tables |
| Role-to-module mapping service | NOT_FOUND | Must not assign unentitled Product modules |
| CsTrainingRecord.moduleKey | REUSE_WITH_RECONCILIATION | Thin free-text `moduleKey` on foundation row — not versioned ModuleVersion |
| Product module entitlement | CORRECT_AND_REUSABLE | Subscription/entitlement plane remains authoritative for Product scope |

**Implication:** Wave 1 ModuleVersion under curriculum; role-module matrix enforced against entitlement; never silent Product escalation.
