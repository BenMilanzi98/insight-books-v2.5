# Training Security Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| canManageTraining / canViewTraining | PARTIAL / EXTEND | `model.js` — deepen training* SoD perms |
| programAccess portfolio scope | PARTIAL / EXTEND | `programAccess.js` + `listScope.js` |
| Writes-by-id fail-closed | EXTEND | loadTrainingProgramForActor pattern |
| Assessment answer leak | ASSESSMENT_TRUTH_RISK / EXTEND | Strip in search/export; no pre-submit bank leak |
| Attempt tokens | EXTEND | attempts.js — non-predictable deepen |
| Cross-tenant resolveCrmScope stub | CARRY / CROSS_TENANT_RISK | Historical CRM stub mode:all — harden |
| Tenant GL from Training | FORBIDDEN | tenantGlForbidden domain contract |

**Implication:** Security is EXTEND + CARRY cross-tenant stub; Wave 1–4 must keep fail-closed portfolio.

