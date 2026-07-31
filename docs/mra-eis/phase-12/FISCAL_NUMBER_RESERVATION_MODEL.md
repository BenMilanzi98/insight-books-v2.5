# Fiscal Number Reservation Model

Append-only RESERVED/ASSIGNED/VOIDED/ABANDONED. Unique (sequenceScopeId, reservationValue) and formattedFiscalNumber.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
