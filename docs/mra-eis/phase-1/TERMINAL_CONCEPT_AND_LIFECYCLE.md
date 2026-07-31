# Terminal Concept and Lifecycle

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Official concepts (from API/guide)

| Term | Meaning (documented) | Confidence |
|---|---|---|
| Terminal | Activated software/device instance with terminalId + credentials | VO |
| terminalPosition | Integer used in fiscal numbering | VO (schema) |
| terminalLabel | From terminalConfiguration | VO |
| productID / productVersion | Certified software identity | VO |
| MAC / platform | Activation environment fingerprint; MAC mandatory in guide prose, optional in OpenAPI | OI |
| siteId | Trading site on invoices | VO |

## SaaS / multi-tenant questions (BLOCKING clarifications)

See MRA_CLARIFICATION_REGISTER Q-017…Q-020. InsightBooks must **not** invent MAC strategy or share terminal credentials across tenants.

## Lifecycle (documented)

Acquire terminal (portal) → TAC → activate-terminal → persist credentials/config → terminal-activated-confirmation (x-signature) → ACTIVE → operate → token renew → possible block/unblock → (reactivation unknown).

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
