# Online Transmission Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Claim → capability → terminal → config → checksum → creds → map DTO → validate → serialize → sign/hash(if verified) → send → attempt → classify → validationURL → config refresh / block flags → receipt event → audit/metrics.

## POS UX default

**Option B (default):** local receipt with `EIS_PENDING`; update when accepted. Option A (wait) configurable if MRA/tenant requires. Never show MRA Validated while pending.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
