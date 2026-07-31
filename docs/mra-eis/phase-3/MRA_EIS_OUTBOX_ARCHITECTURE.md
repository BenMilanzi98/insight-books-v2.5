# MRA EIS Outbox Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Events: EIS_SNAPSHOT_REQUESTED, EIS_TRANSMISSION_QUEUED, EIS_CONFIGURATION_REFRESH_REQUESTED, EIS_RECONCILIATION_REQUESTED, EIS_OFFLINE_UPLOAD_REQUESTED, EIS_RECEIPT_UPDATE_REQUESTED, EIS_ALERT_REQUESTED

Atomic with business change; claim via `FOR UPDATE SKIP LOCKED` + lease; no secrets in payload.

**Decision:** Prefer dedicated `MraEisOutbox` (or typed rows) with a **production dispatcher** — Phase 2 showed `AcctV2Outbox` writes without drain. May share claim infrastructure patterns with Accounting V2.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
