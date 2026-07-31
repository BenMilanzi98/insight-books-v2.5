# Phase 13 Tasks

| Stream | Status |
|---|---|
| Transmission forensic audit | DONE |
| Gap register | DONE |
| Endpoint/payload/response registries | DONE |
| Readiness + config compatibility | DONE |
| Mapper + validation + evidence | DONE |
| Message hash (mock / fail-closed live) | DONE |
| JWT lease + HTTP client | DONE |
| Attempt/response/classification | DONE |
| Accepted/Rejected/Unknown processing | DONE |
| Phase 14/15 outbox events | DONE |
| Worker + APIs + UI | DONE |
| Disable legacy direct submit | DONE |
| Unit tests | DONE |
| Docs + Phase 14 handover | DONE |
| Live MRA sandbox Sales | BLOCKED |
| QR / receipt | PHASE 14 |

---
*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*
