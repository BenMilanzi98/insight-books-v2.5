# Terminal Activation State Machine

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

States: DRAFT → READINESS_INCOMPLETE → TAC_REQUIRED → ACTIVATION_REQUEST_PENDING → ACTIVATION_IN_PROGRESS → ACTIVATION_RESPONSE_RECEIVED → CREDENTIALS_PERSISTED → CONFIRMATION_PENDING → CONFIRMATION_IN_PROGRESS → ACTIVE · failures · TOKEN_EXPIRED · REACTIVATION_REQUIRED · BLOCKED · REVOKED

Commands/events as in Phase 3 prompt.

**Conditional:** activation timeout recovery (lost response after MRA activated) — Phase 1 Q-016 — mark ACTIVATION_FAILED / MANUAL_REVIEW; do not invent recovery endpoint.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
