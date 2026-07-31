# Phase 13 Handover

## What Phase 13 receives
- Completed `MraEisSnapshot` with canonicalSnapshot + snapshotChecksum
- schemaVersion / canonicalizationVersion / checksumAlgorithmVersion
- Fiscal number assignment (sandbox synthetic until contract verified)
- Seller/buyer/terminal/location/lines/tax/levy/payment/totals/complianceEvidence
- Outbox event `MRA_EIS_SALES_PAYLOAD_REQUESTED` (references only)

## Phase 13 must
- Reload snapshot by ID; verify checksum
- Map to MRA Sales payload DTOs
- Use Secret Provider + message hash + Authorization header
- Submit Sales; parse outcomes; never create Journals/Stock Movements
- Not trust mutable master data

## Blockers carried in
- Production fiscal number format/scope (G12-001)
- Offline (G12-002)
- Last TX endpoints (G12-003)
- VAT5 live validation / Buyer Authorization
- Split-payment unsupported cases

## Acceptance for Phase 13 start
`READY_FOR_PHASE_13_WITH_BLOCKERS` — payload mapping may proceed in sandbox; production transmission gated.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
