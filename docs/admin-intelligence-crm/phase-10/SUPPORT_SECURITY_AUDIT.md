# Support Security Audit

| Control | Current | Required |
|---------|---------|----------|
| `systemAdmin.support.*` | NOT_FOUND | Wave 1+ permissions |
| Queue scope | N/A | Agents queue-scoped |
| Ticket ID / number guessing | N/A | AuthZ on every get |
| Support-access PAM | READY | Keep separate from tickets |
| CoA admin route | Removed | Must stay removed |

**Threat:** Confusing PlatformSupportAccess with ticket access; CS portfolio agents reading all tickets.
