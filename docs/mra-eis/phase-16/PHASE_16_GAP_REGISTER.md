# Phase 16 Gap Register

| ID | Gap | Severity | Status |
|---|---|---|---|
| G16-001 | Live/production offline mode contract unverified | CRITICAL | OPEN — blocked |
| G16-002 | Production signature algorithm / KAT (Q-040) | CRITICAL | OPEN — blocked |
| G16-003 | Offline numbering scope vs online (MRA) | HIGH | OPEN — mock separate; prod blocked |
| G16-004 | Offline QR / receipt live semantics | HIGH | OPEN — pending wording only |
| G16-005 | Offline upload endpoint/batch semantics | HIGH | OPEN — mock only |
| G16-006 | Full encrypted SQLite / TPM agent binary | HIGH | OPEN — architecture selected; runtime deferred |
| G16-007 | Last Offline live query | HIGH | OPEN — Phase 15 carry-forward |
| G16-008 | CERTIFIED_PRODUCTION evidence pipeline UX | MEDIUM | Foundation; no self-declare |

---
*Phase 16 implementation. Offline mode is disabled by default. Production requires CERTIFIED_PRODUCTION + verified contracts. Browser-only authoritative fiscal signing/storage is prohibited. navigator.onLine / localStorage / IndexedDB are not certified offline. One network failure does not enable offline. Sealed envelopes and queue items are immutable. Upload never reposts Journal/Stock. Unknown uploads require Phase 15 reconciliation. Maintenance does not auto-enable offline. No credentials/JWT/private keys/BAC in evidence.*
