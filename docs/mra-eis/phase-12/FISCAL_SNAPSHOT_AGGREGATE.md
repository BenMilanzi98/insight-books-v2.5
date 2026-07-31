# Fiscal Snapshot Aggregate

Uses `MraEisSnapshot` statuses BUILDING / NUMBER_PENDING / COMPLETED / FAILED / … Unique `bridgeRecordId`. COMPLETED sets `immutableAt`. One completed active snapshot per bridge.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
