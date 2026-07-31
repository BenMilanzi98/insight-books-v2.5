# Site and Branch Mapping Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Map: Tenant(=Business) + Branch (+ optional InventoryLocation) → mraTin + mraSiteId + terminal.

Sale must resolve **exactly one** site; ambiguity blocks fiscalization. Historical snapshot freezes siteMappingId.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
