# Tax and Levy Mapping Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Local tax type/rate ↔ MRA taxRateId (+ levy). No hardcoded rates as permanent truth.

Snapshot uses **stored sale tax amounts** + mapped MRA IDs. Material conflict blocks. VAT5 ≠ ordinary exemption.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
