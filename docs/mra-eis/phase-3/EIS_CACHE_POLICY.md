# EIS Cache Policy

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Cacheable: effective capability, active config version#, mapping completeness, terminal health, dashboards — keys include tenant+env+version.

Never cache decrypted JWT/secret/TAC/buyer auth.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
