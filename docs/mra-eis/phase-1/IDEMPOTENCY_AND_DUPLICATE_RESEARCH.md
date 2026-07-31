# Idempotency and Duplicate Research

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

| Operation | Classification |
|---|---|
| activate-terminal | NOT_IDEMPOTENT / UNKNOWN — TAC single-use risk |
| confirmation | UNKNOWN |
| submit-sales | REQUIRES_RECONCILIATION via invoiceNumber + last-online |
| get-latest-configs | NATURALLY_IDEMPOTENT (read) |
| initial inventory batch | UNKNOWN |
| ping | NATURALLY_IDEMPOTENT |

No idempotency-key header in OpenAPI.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
