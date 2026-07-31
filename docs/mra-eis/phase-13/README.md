# Phase 13 — MRA EIS Sales Payload Mapping & Online Transmission

**Decision:** `READY_FOR_PHASE_14_WITH_BLOCKERS`

## Entry
- Domain: `lib/mraEis/application/salesTransmission/`
- Client: `lib/mraEis/infrastructure/mraClient/salesClient.js`
- Mock: `lib/mraEis/infrastructure/mraClient/mockMraSalesServer.js`
- APIs: `/api/mra-eis/sales-transmission`
- UI: `/settings/integrations/mra-eis/sales-transmission`
- Worker: `processSalesPayloadOutboxBatch`
- Tests: `test/mraEis.phase13.salesTransmission.test.js`
- Outbox: `MRA_EIS_ACCEPTED_RECEIPT_REQUESTED` (Phase 14), `MRA_EIS_TRANSMISSION_RECONCILIATION_REQUESTED` (Phase 15)

## Hard rules
- Source = completed immutable Fiscal Snapshot only
- Exact transmitted bytes hashed once (mock synthetic SHA-256; live hash blocked)
- JWT leased server-side / mock synthetic — never in DB/Jobs/Outbox/logs
- HTTP 200 ≠ acceptance
- No QR / final receipt
- No Journal / Stock Movement
- Accepted never resubmitted; UNKNOWN never blindly retried
- Production + live sandbox transmission **BLOCKED**

---
*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*
