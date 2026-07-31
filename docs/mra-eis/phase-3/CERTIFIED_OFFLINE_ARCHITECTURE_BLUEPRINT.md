# Certified Offline Architecture Blueprint

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Selected classification

**OFFLINE_NOT_CURRENTLY_FEASIBLE** for browser SaaS secret custody; optional future **DESKTOP_POS_AGENT / LOCAL_BRANCH_SERVICE** after MRA cert + KAT.

Default: online-only until certification. Do not put secretKey in browser IndexedDB (`offlineSalesQueue` ≠ MRA offline).

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
