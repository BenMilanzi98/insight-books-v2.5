# Rollback Strategy

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **DRAFT** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

Tier 1: restore backup; Tier 2: domain reverse; Tier 3: forward recovery. Rollback drill **NOT MET** (<4h target per QA readiness).
