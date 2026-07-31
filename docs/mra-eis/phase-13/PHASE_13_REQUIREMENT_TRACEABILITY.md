# Phase 13 Requirement Traceability

| Requirement | Trace |
|---|---|
| Endpoint path POST submit-sales-transaction | `salesEndpointContractRegistry.js` |
| Request hash | Mock synthetic / live Q-010 fail-closed |
| Snapshot integrity | `verifyFiscalSnapshotIntegrity` |
| Payload mapping | `salesPayloadMapper.js` from canonicalSnapshot |
| Classification | `applicationStatusClassifier.js` |
| Transmission aggregate | Phase 5 `MraEisTransmission` EXTEND |
| Attempts/Responses | Phase 5 models |
| Phase 14 event | `ACCEPTED_RECEIPT_REQUESTED` |
| Phase 15 event | `TRANSMISSION_RECONCILIATION_REQUESTED` |
| Legacy disable | `lib/eisService.js` submitInvoice |

---
*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*
