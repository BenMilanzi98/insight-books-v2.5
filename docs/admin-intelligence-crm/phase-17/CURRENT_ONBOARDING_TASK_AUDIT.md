# Current Onboarding Task Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding Task model (INTERNAL/CUSTOMER/SHARED/SYSTEM_VERIFICATION) | NOT_FOUND | — |
| Customer evidence attestation | NOT_FOUND | — |
| `submitCustomerTaskEvidence` / review | NOT_FOUND | — |
| Dependency graph + cycle detection | NOT_FOUND | — |
| CS `CsTask` | WRONG_DOMAIN | `lib/admin/customerSuccess/tasks.js` — case/playbook linked; no Customer evidence attestation |
| CRM Activities / Tasks | WRONG_DOMAIN | Phase 13 activity plane ≠ onboarding Customer Task |
| Portal Customer self-complete | NOT_AVAILABLE | `CUSTOMER_PORTAL_NOT_CONFIGURED` |
| Completing Customer Task without evidence | TASK_COMPLETION_TRUTH_RISK / FORBIDDEN | Must block in Wave 2 |

**Implication:** Wave 2 onboarding tasks + attestation; never complete Customer actor tasks without evidence/waiver.
