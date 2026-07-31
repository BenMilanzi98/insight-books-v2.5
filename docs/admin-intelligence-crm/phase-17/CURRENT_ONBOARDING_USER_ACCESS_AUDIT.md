# Current Onboarding User Access Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding user/role readiness | NOT_FOUND | Spec `readiness/users.js` absent |
| Hash-only invitations from conversion | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/invitations.js` |
| Admin user create with temporaryPassword | PRIVILEGED_USER_RISK / WRONG_SOURCE | `app/api/admin/users/create/route.js` — not onboarding invitation path |
| Least-privilege check vs accepted roles | NOT_FOUND | Wave 3 |
| Grant Super Admin from onboarding | FORBIDDEN | — |

**Implication:** Wave 3 track invite/role readiness; reuse hash-only invite boundary; never mint temp passwords from onboarding.
