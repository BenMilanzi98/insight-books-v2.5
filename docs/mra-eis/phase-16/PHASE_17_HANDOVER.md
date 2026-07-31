# Phase 17 Handover

## Phase 17 implements
Complete Terminal blocking/unblocking, compliance suspensions, agent/device blocks, unblock-status queries, post-unblock config/credential/key revalidation, queue re-evaluation, emergency pause.

## Phase 17 receives from Phase 16
- Trusted Agent lifecycle (ACTIVE/SUSPENDED/BLOCKED/REVOKED/LOST/COMPROMISED)
- Offline capability + certification gates
- Connectivity + clock + limit policies
- Sealed envelopes + queue integrity
- Ordered upload unknown → Phase 15
- Terminal-block stop of new offline Sales
- Receipt pending vs accepted distinction

## Must preserve
Immutable snapshots, fiscal numbers, offline signatures, queue order, response evidence, original receipts, accounting/inventory isolation

---
*Phase 16 implementation. Offline mode is disabled by default. Production requires CERTIFIED_PRODUCTION + verified contracts. Browser-only authoritative fiscal signing/storage is prohibited. navigator.onLine / localStorage / IndexedDB are not certified offline. One network failure does not enable offline. Sealed envelopes and queue items are immutable. Upload never reposts Journal/Stock. Unknown uploads require Phase 15 reconciliation. Maintenance does not auto-enable offline. No credentials/JWT/private keys/BAC in evidence.*
