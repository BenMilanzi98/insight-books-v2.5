# Receipt Cancellation and Corrections

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## API-documented

- POST cancel-receipt (VoidReceiptCreateDto)
- POST get-void-receipts
- POST process-credit-debit-note (higher VAT/total → debit; lower → credit)

## Not to invent

Negative sales payloads, ad-hoc refund endpoints, undocumented correction flows.

Portal-only processes may exist — RC for full refund/return matrix. Mark unsupported flows BLOCKED pending MRA guidance.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
