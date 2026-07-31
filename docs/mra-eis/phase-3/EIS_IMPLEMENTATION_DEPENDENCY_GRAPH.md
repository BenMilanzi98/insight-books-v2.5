# EIS Implementation Dependency Graph

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

```
Phase1 clarifications (crypto/number/terminal/offline)
        \
Phase2 blockers (idempotency, secrets, outbox drain, session, entitlement fix)
         \
Phase4 Entitlement/flags ──> Phase5 Schema/SMs ──> Phase6 Crypto/Vault
                              └─> Phase7 Activation (needs vault + terminal ID answer)
Phase8 Config sync ──> Phase9 Mappings ──> Phase10 Product sync
Phase11 Eligibility adapters ──> Phase12 Snapshot+numbering ──> Phase13 Online transmit
Phase14 Receipt/QR ──> Phase15 Retry/recon ──> Phase16 Offline(gated)
Phase17 Blocks ──> Phase18 Admin UI/reports ──> Phase19 Migration ──> Phase20 Tests ──> Phase21 Cert/rollout
```

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
