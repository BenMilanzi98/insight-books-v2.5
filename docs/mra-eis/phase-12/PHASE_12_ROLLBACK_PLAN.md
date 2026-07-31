# Phase 12 Rollback Plan

Stop workers; leave completed snapshots intact (do not delete fiscal evidence); revert app code; do not rewind sequence nextValue.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
