# Authentication and Credential Research

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Credentials

| Field | Class | Lifecycle notes |
|---|---|---|
| TAC | SHORT_LIVED_SECRET | Single-use activation; never reuse |
| jwtToken | SHORT_LIVED_SECRET (claims include exp) | Renew via request-new-terminal-token |
| secretKey | LONG_LIVED_SECRET | Signing/offline; rotation RC |
| terminalId | INTERNAL | Public-ish identifier |
| productID/version | INTERNAL | Certification identity |
| TIN | CONFIDENTIAL | Taxpayer identity |

## JWT

Guide samples show issuer MRA, audience EISTerminals, claims DeviceId, SecretKey, APIKey, TIN, exp. **Do not log claims containing secrets.**

## Preliminary security requirements (later phases)

Encrypt at rest · no frontend exposure · no logs/exports · RBAC · audit access · rotation/revocation capability.

**Phase 1:** no real credentials stored.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
