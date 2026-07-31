# Retry and Failure Mode Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

EIS today: log failure, keep sale — good for accounting independence; bad for durable retry (no outbox).

MRA writes need reconcile-before-retry (Phase 1). Reuse Accounting V2 registry pattern; do not blind-retry submit.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
