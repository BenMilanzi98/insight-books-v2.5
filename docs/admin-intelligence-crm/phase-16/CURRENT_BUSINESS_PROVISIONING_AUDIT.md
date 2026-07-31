# Current Business Provisioning Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| First-class Business model | NOT_FOUND | No `model Business` conversion target; Tenant is primary org unit |
| BusinessSetupRun / Step | FOUNDATION / WRONG_DOMAIN if aliased | Setup wizard, not conversion Business entity |
| PlatformPlanVersion `businessLimit` | FOUNDATION | Plan taxonomy limit |
| Conversion BUSINESS create/link | NOT_FOUND | — |
| Cross-tenant Business create deny | NOT_FOUND | Wave 2 test required |

**Implication:** Wave 2 primary Business only when accepted scope requires; else `SKIPPED_NOT_APPLICABLE`.
