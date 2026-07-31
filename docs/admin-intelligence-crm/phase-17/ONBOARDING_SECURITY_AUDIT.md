# Onboarding Security Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding SoD permissions (`onboarding*`) | NOT_FOUND | Only `customerSuccess.read` on foundations route in `permissions.js` |
| Exact idempotency / conflicting payload fail | EXTEND pattern | Domain handoffs unique on `idempotencyKey` — Request/Project must match |
| Template author ≠ approver | NOT_FOUND | Wave 2 |
| Evidence submitter ≠ reviewer | NOT_FOUND | Wave 2 |
| Go-live / completion / waiver SoD | NOT_FOUND | Wave 3 |
| Hash-only invites | CORRECT_AND_REUSABLE | `invitations.js` |
| Temp password admin create | PRIVILEGED_USER_RISK | Do not use from onboarding |
| Document classification + private storage | NOT_FOUND | FILE_SECURITY_RISK — Wave 3 |
| MIME/size/scan / expiring access | NOT_FOUND | Wave 3 |
| MRA Production credentials in onboarding docs | FORBIDDEN | — |
| Tenant accounting posts from onboarding | FORBIDDEN | Mirror `accountingBoundary.js` |
| Cross-tenant project access | CROSS_TENANT_RISK | Scope stubs + missing Project authz |
| Dry-run / no side effects on Request create | Wave 1 contract | Handoff consume creates Request only — not Tenant/Subscription |

**Disposition:** Permissions skeleton Wave 1; SoD + file security Waves 2–3; export/search harden Wave 4.
