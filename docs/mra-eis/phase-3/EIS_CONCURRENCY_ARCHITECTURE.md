# EIS Concurrency Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Protect: duplicate finalize, duplicate snapshot, sequence race, dual workers, config/mapping change mid-snapshot, block mid-send, pause mid-claim.

Tools: unique constraints, row locks, optimistic version, status guards. Test each race.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
