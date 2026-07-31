# Phase 14 — MRA EIS Validation QR & Fiscal Receipts

**Decision:** `READY_FOR_PHASE_15_WITH_BLOCKERS`

## Entry
- Domain: `lib/mraEis/application/fiscalReceipt/`
- APIs: `/api/mra-eis/fiscal-receipts`
- UI: `/settings/integrations/mra-eis/fiscal-receipts`
- Worker: `processAcceptedReceiptOutboxBatch` (consumes `MRA_EIS_ACCEPTED_RECEIPT_REQUESTED`)
- Models: `MraEisFiscalReceipt`, `MraEisQrEvidence`, `MraEisFiscalReceiptArtifact`, `MraEisReceiptRenderAttempt`
- Migration: `prisma/migrations/20260723010000_mra_eis_phase14_fiscal_receipt`
- Tests: `test/mraEis.phase14.fiscalReceipt.test.js`
- Storage: `storage/mra-eis/fiscal-receipts/{tenantId}/...` (private, immutable)

## Hard rules
- Only ACCEPTED transmissions create fiscal receipts
- HTTP 200 ≠ acceptance
- QR source is contract-driven (mock: validationUrl precedence)
- No invented production QR / local `/verify` URLs
- Validation URLs HTTPS + allowlisted hosts; no localhost/private/credentials
- QR decode must match exact source before completion
- Receipt Data from immutable snapshot + response only
- Original artifacts immutable; reprints separate
- No MRA Sales call, Journal, Stock Movement, snapshot/response/number mutation
- Production + live sandbox receipt generation **BLOCKED**

---
*Phase 14 implementation. Fiscal receipts and validation QR codes are created only from conclusively accepted MRA response evidence + immutable fiscal snapshots. HTTP 200 alone is not acceptance. No synthetic production QR. Validation URLs are allowlisted. Original artifacts are immutable. Reprints preserve fiscal number/MRA txn/QR source. No Journal/Stock Movement. No MRA Sales resubmit. Production/live-sandbox receipt generation BLOCKED until QR/receipt contracts are verified.*
