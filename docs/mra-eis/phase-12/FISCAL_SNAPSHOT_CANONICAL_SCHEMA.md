# Fiscal Snapshot Canonical Schema

Schema version `phase12-fiscal-snapshot-schema-v1`: snapshotIdentity, source, seller, buyer, terminal, location, configuration, transaction, lines[], taxSummary[], levySummary[], payment, currency, totals, complianceEvidence, fiscalNumber.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
