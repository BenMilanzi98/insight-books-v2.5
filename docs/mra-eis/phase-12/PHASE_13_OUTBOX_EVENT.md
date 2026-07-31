# Phase 13 Outbox Event

Event `MRA_EIS_SALES_PAYLOAD_REQUESTED`: fiscalSnapshotId, version, snapshotChecksum, fiscalNumberAssignmentId, environment, correlationId. No full snapshot, credentials, or BAC.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
