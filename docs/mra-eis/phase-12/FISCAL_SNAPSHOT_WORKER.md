# Fiscal Snapshot Worker

Claims Phase 11 outbox / READY bridges; leases via outbox claim; multi-worker safe; never calls MRA; never reposts accounting/inventory.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
