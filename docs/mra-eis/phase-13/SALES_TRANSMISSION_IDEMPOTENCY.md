# SALES TRANSMISSION IDEMPOTENCY

Unique (snapshotId,mode); outbox idempotency; one accepted attempt; Phase 14 key per attempt.

---
*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*
