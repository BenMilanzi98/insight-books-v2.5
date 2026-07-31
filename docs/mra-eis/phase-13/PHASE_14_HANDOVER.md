# Phase 14 Handover

## Phase 14 receives
- ACCEPTED_ONLINE transmission + accepted attempt + immutable response evidence
- responseChecksum, mraTransactionId, validationUrl, qrDataPresent (not rendered)
- Fiscal snapshot id/checksum/fiscal number + seller/buyer/lines/tax/payment snapshots
- Event `MRA_EIS_ACCEPTED_RECEIPT_REQUESTED` (references only)

## Phase 14 must
- Generate QR image + final fiscal receipt from immutable evidence
- Not call MRA Sales again
- Not mutate snapshot/number/accounting/inventory

## Phase 15 dependencies
- UNKNOWN_OUTCOME transmissions + reconciliation events
- Retry classifications
- Last Online/Offline interfaces (still blocked adapters)

## Known ambiguities
- QR payload structure (MRA clarification)
- Live success-code catalogue
- Message-hash algorithm

---
*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*
