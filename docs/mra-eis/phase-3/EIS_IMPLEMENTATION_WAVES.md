# EIS Implementation Waves

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

| Phase | Focus | Hard deps | Blocked if |
|---|---|---|---|
| 4 | Entitlement + ops controls + flags | P2 entitlement/session fixes recommended | — |
| 5 | Schema + aggregates + SMs | Phase 3 blueprint | — |
| 6 | Vault + crypto foundation | Encryption key ops | message-hash still interface-only |
| 7 | Terminal activation | Vault + MAC/SaaS answer | Q-016/017 |
| 8 | Config sync | Active terminal | — |
| 9 | Site/tax/payment maps | Config | payment enums RC |
| 10 | Product sync/map | Config | GET/POST clarified |
| 11 | Eligibility adapters + sale idempotency | Maps | — |
| 12 | Snapshot + fiscal numbering | Number KAT | **Q-021** |
| 13 | Online transmission worker | Snapshot + client | hash if required |
| 14 | Receipt/QR projection | Accept path | — |
| 15 | Retry/unknown/recon | Transmit | — |
| 16 | Offline | Cert + KAT + agent | **BLOCKED now** |
| 17 | Terminal block | Transmit | — |
| 18 | Admin/UI/reports/obs | Prior | — |
| 19 | Migration | Policy | No auto history |
| 20 | Full test/security | Prior | — |
| 21 | Sandbox cert + pilot + prod | MRA approval | — |

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
