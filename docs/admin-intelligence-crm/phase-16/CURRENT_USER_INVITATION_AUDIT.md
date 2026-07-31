# Current User Invitation Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Conversion invitation (hash-only token) | NOT_FOUND | Design requires hash + expiry/revoke/resend |
| Admin user create | FOUNDATION / PRIVILEGED_USER_RISK | `app/api/admin/users/create/route.js` may return `temporaryPassword` |
| Admin users route | FOUNDATION / PRIVILEGED_USER_RISK | Same temporaryPassword pattern |
| Meeting/Demo sendInvitations | WRONG_DOMAIN | Not Tenant user provision |
| Raw invitation token storage | NOT_FOUND (good) | Wave 2 must store hash only |
| Platform Super Admin for Tenant users | FORBIDDEN | Must not grant on conversion invite |
| Exact retry no duplicate invite | NOT_FOUND | — |

**Implication:** Wave 2 greenfield invitation step; never default/shared passwords; never reuse temporaryPassword as durable invite.
