# Privacy and Data Classification

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

| Field | Class | Storage | Log | UI |
|---|---|---|---|---|
| sellerTIN / buyerTIN | CONFIDENTIAL | Encrypted/restricted | Mask | Need-to-know |
| buyerAuthorizationCode | SECRET | Minimize TTL | Never | Mask |
| JWT / secretKey / TAC | SECRET / SHORT_LIVED | HSM/secret store | Never | Never |
| VAT5 details | CONFIDENTIAL | Restricted | Mask | Need-to-know |
| validationURL | INTERNAL | OK | OK | Receipt |
| Invoice lines | CONFIDENTIAL | Tenant DB | Limited | Role-based |

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
