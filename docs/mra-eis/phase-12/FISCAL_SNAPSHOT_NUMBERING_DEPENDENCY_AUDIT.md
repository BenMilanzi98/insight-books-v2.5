# Fiscal Snapshot & Numbering Dependency Audit

| Mechanism | Classification | Notes |
|---|---|---|
| Phase 5 `MraEisSnapshot` | EXTEND | Added bridge/identity/checksum versions |
| Phase 5 `MraEisFiscalSequence` (daily) | LEGACY_READ_ONLY | Not used for Phase 12 allocation |
| Phase 5 `MraEisFiscalNumberAllocation` | WRAP | Still records uniqueness for formatted number |
| Phase 12 `MraEisFiscalSequenceScope` | REUSE/NEW | Authoritative nextValue |
| Phase 12 reservations | NEW | Append-only gap evidence |
| POS sale numbers | NOT_APPLICABLE | Local document numbers only |
| Invoice numbers | NOT_APPLICABLE | Must not become MRA fiscal numbers |
| Phase 6 canonicalize | REUSE | Snapshot + section checksums |
| Phase 11 bridge/outbox | EXTEND | Consumed by Phase 12 worker |
| Browser-submitted snapshot fields | UNSAFE | Rejected by API |
| MAX(number)+1 | UNSAFE / PROHIBITED | Not used |

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
