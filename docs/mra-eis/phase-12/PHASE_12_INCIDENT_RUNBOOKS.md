# Phase 12 Incident Runbooks

| Incident | Action |
|---|---|
| Checksum mismatch | Integrity verify → Manual Review → never silent rewrite |
| Duplicate number attempt | Unique constraint + alert; do not reuse |
| Worker crash after reserve | Resume by idempotency key; gap if abandoned |
| Cross-tenant ID | Reject before load; audit |

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
