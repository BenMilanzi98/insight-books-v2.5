# Atomic Fiscal Number Reservation

`SELECT … FOR UPDATE` then increment nextValue. Never MAX+1. Concurrent workers get unique values.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
