# Activation Dependency Audit

Performed without live MRA calls.

| Dependency | Status |
|---|---|
| Platform EIS | Phase 4 control plane |
| Tenant entitlement / participation | Phase 4 |
| Business EIS setting | Phase 4 |
| Terminal / credential / config models | Phase 5 |
| Secret Provider / envelope | Phase 6 ENV_ENVELOPE |
| Activation HMAC KAT | Phase 6 VERIFIED_WITH_TEST_VECTOR |
| Confirmation productionEnabled | **false** (sandbox verification pending) |
| Message hash / offline signers | BLOCKED (out of Phase 7) |
| MRA base URL | Mock default; sandbox/prod via env |
| Outbox | Phase 5; queues CONFIGURATION_SYNC_REQUESTED |
| Audit | `recordEisControlAudit` + redaction |
| Product ID config | Table + `MRA_EIS_PRODUCT_ID` |
| Stable identity | Implemented; production blocked Q-017–019 |
| Postgres migrate deploy | Environment-dependent (often P1001 locally) |

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
