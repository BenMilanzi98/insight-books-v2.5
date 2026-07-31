# Architectural Principles

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

1–40 as stated in Phase 3 prompt are adopted.

InsightBooks-specific additions:

41. Tenant = Business (`tenantId` / `businessId` alias) until a true multi-business tenant model exists.
42. Prefer extending `AcctV2Outbox` + dispatcher over inventing a second undrained outbox — or dedicated `MraEisOutbox` with identical atomic claim semantics.
43. Replace post-commit `eisService.submitInvoice` fire-and-forget; keep accounting independence.
44. Money in fiscal snapshots must use decimal strings / Decimal types — not IEEE Float from Sale rows without normalization.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
