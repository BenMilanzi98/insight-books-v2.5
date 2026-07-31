# Fiscal Snapshot Transaction Boundary

Step A claim draft → Step B build in memory → Step C re-lock, reserve number, persist, bridge transition, Phase 13 outbox.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
