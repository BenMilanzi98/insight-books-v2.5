# Support Access Audit

| Item | Finding | Class |
|------|---------|-------|
| Model `PlatformSupportAccess` | Live | KEEP |
| Helpers reason/TTL/status | Live | KEEP |
| API start → ACTIVE immediately | Skips REQUESTED/APPROVED | EXTEND |
| Banner + exit | Live | KEEP |
| End session any caller with perm | Weak ownership | REFACTOR |
| Tenant session mint / impersonation | **Not implemented** | MISSING |
| Privilege ceiling | Not enforced | MISSING |
| Post-expiry API deny on tenant plane | N/A (no wiring) | MISSING |

**Target:** Approval optional by policy; ACTIVE session required for tenant-plane support actions; realActor always Admin; effectiveTenantId set; expiry enforced; audit immutable.
