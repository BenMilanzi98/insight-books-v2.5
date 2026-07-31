# Queue and Worker Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

- No Bull/Redis job queue as product infrastructure.
- Vercel crons: eis-sync every 30m, others.
- Offline sales queue is browser IndexedDB.

Classification: **CLOUD_PARTIAL / REQUIRES durable worker** for EIS transmission, per-terminal ordering, backpressure.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
