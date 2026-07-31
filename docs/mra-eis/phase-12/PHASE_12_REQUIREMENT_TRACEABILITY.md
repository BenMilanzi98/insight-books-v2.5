# Phase 12 Requirement Traceability

| Requirement | Trace |
|---|---|
| Snapshot readiness | `snapshotReadiness.js` + Phase 11 bridge |
| Source reload | `sourceVerification.js` |
| Source finalization identity | Phase 11 identity + verify |
| Source checksum | `SOURCE_CHECKSUM_VERSION` + Phase 6 canonicalize |
| Accounting evidence | Soft verify Journal by sourceId — no create |
| Inventory evidence | Soft verify / stock-level fallback — no create |
| Seller/Buyer/Terminal/Location | `canonicalSnapshotBuilder.js` |
| Lines/tax/levy/payment/totals | Same |
| Canonical schema | `SNAPSHOT_SCHEMA_VERSION` |
| Checksum | Phase 6 `canonicalize` + SHA256_V1 |
| Number contract | `fiscalNumberContractRegistry.js` |
| Scope | `fiscalNumberScope.js` |
| Sequence/reserve | `fiscalSequenceService.js` FOR UPDATE |
| Phase 13 outbox | `MRA_EIS_SALES_PAYLOAD_REQUESTED` |
| Worker | `snapshotWorker.js` |
| UI | `/settings/integrations/mra-eis/fiscal-snapshots` |
| Blocked production format | Clarification Register / Phase 1 |

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
