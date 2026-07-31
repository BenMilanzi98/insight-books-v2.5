# Current Support Architecture Audit

| Check | Class | Evidence |
|-------|-------|----------|
| `/insightbooks/support` ops plane | NOT_FOUND | No app tree |
| `lib/admin/support/*` | NOT_FOUND | — |
| SupportTicket domain | NOT_FOUND | Prisma |
| CsCase (CS) | CORRECT_AND_REUSABLE / FORBIDDEN as tickets | Phase 8 |
| PlatformSupportAccess | WRONG_DOMAIN | PAM/impersonation only |
| Tenant `/support` | DISCONNECTED shell | Disabled unavailable page |
| Competing ticket systems | NOT_FOUND | Greenfield — create one |

**Implication:** Build dedicated Support domain from scratch; never alias CsCase.
