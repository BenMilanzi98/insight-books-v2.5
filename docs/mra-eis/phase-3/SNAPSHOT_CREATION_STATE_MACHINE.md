# Snapshot Creation State Machine

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

REQUESTED → VALIDATING → MAPPINGS_RESOLVED → NUMBER_RESERVED → CREATED → QUEUED · FAILED · SUPERSEDED · CANCELLED_BEFORE_QUEUE · MANUAL_REVIEW

Failure reasons: missing terminal/site/mappings, invalid TIN/auth/VAT5, total mismatch, journal missing, business mismatch, period conflict, number allocation failure.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
