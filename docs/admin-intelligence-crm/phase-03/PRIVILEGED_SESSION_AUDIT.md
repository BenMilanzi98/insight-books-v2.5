# Privileged Session Audit

| Finding | Class |
|---------|-------|
| Admin JWT 24h, no idle timeout server-side | EXTEND |
| No persisted session rows | MISSING |
| Support sessions TTL 15–240m | KEEP |
| Revoke APIs 501 | MISSING |
| Step-up auth for PAM | MISSING |

**Target:** Privileged actions optionally require fresh auth / MFA; revoke increments `Admin.sessionVersion` checked in verify.
