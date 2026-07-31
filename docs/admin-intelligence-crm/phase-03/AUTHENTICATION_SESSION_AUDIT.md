# Authentication & Session Audit

| Item | Finding | Class |
|------|---------|-------|
| Login | Email/password → bcrypt → JWT (`adminId`, `email`, `role`, `isAdmin`) 24h | KEEP |
| Cookie | `admin_token` httpOnly, sameSite lax, secure in prod | KEEP |
| Verify (modern) | Signature + `isAdmin` + DB `isActive` + load permissions | KEEP |
| Middleware | Cookie string present only — no verify | UNSAFE |
| MFA | Settings default `requireForAdmins` unused by login | MISSING |
| Session store | None; security/sessions returns empty / 501 | MISSING |
| Logout | Clears cookie + AdminAuditLog | KEEP |
| Deactivate | Modern verify rejects; legacy JWT routes may still accept | STALE_PERMISSION_RISK |
| Token version / jti | Absent | MISSING |

**Target:** Verify JWT in middleware; optional session version on Admin; revoke-all; step-up MFA for PAM actions.
