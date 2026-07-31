# Sales Endpoint Contract Decision

**Decision:** `PROVISIONAL_SANDBOX_ONLY`

- Path: `POST /api/v1/sales/submit-sales-transaction`
- Mock transmission: ALLOWED
- Live sandbox: BLOCKED
- Production: BLOCKED
- No automatic endpoint/method/hash fallback
- HTTP 200 alone is not acceptance

---
*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*
