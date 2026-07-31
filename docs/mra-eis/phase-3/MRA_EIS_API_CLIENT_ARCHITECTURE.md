# MRA EIS API Client Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

`MraEisClient` / `V1` + signer + parser + contract validator + endpoint registry.

Server-only. Environment base URL. Deterministic serialization. Endpoint-specific auth/sign. Timeouts. Safe retry class. Redaction. Circuit breaker.

Does not own eligibility, accounting, or total recalculation.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
