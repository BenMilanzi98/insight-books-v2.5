# Sales Transmission Dependency Audit

| Mechanism | Classification |
|---|---|
| Phase 5 Transmission/Attempt/Response | EXTEND |
| Phase 6 canonicalize | REUSE |
| Phase 6 hashEisMessage | FAIL_CLOSED / WRAP for mock |
| Phase 6 withSecret JWT | REUSE |
| Phase 7/8/10 MRA clients | REUSE pattern |
| Phase 12 snapshot + outbox | EXTEND |
| lib/eisService.submitInvoice | DISABLE (UNSAFE_DIRECT_CALL) |
| app/api/eis/* remaining | LEGACY_READ_ONLY / gate |
| Browser payload submit | UNSAFE — rejected by API |

---
*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*
