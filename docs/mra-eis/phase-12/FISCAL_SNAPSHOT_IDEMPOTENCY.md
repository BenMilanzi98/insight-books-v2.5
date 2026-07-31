# Fiscal Snapshot Idempotency

Unique bridgeRecordId + completed/number-pending short-circuit. Duplicate workers return existing. Reservation idempotencyKey unique.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
