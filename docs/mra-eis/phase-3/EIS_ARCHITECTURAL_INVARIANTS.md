# EIS Architectural Invariants

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Invariants 1–30 from Phase 3 prompt are adopted as executable future tests.

Additional:
31. EligibleSaleFinalized does not call posting engine.
32. Browser bundles do not import TerminalCredentialVault or MraEisClient.
33. FiscalNumberAllocator refuses to run until algorithmVersion verified.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
