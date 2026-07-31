# Fiscal Sequence Reset Policy

Contract resetPolicy PER_BUSINESS_DAY for synthetic scope key (new scopeKey per day). No in-place nextValue rewind.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
