# Transmission State Machine

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Transitions for queue, claim, validate, send, accept, reject, retry schedule, unknown, reconcile, manual review, dead-letter, offline path, block, cancel-before-submit.

Each transition: preconditions, lock, idempotency key, side effects, audit, metrics. Invalid transitions rejected.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
