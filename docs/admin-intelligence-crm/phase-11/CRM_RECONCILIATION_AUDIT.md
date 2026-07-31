# CRM Reconciliation Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM reconciliation jobs | NOT_FOUND | — |
| Capture vs Lead count recon | NOT_FOUND | Emails have no Lead counterpart |
| Handoff → Lead recon | NOT_FOUND | Handoffs exist; no Lead bridge |
| Score definition version recon | NOT_FOUND | — |
| Support recon as CRM recon | WRONG_DOMAIN | `lib/admin/support/reconciliation.js` |
| Product analytics recon as CRM | WRONG_DOMAIN | Phase 9 |

**Implication:** Wave 4 recon foundations for capture/handoff/Lead consistency. Empty recon ≠ 0% mismatch — use gate states.
