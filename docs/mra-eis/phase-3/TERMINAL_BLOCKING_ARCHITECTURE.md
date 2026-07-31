# Terminal Blocking Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

On shouldBlockTerminal: persist → BLOCKED → stop claims → optional stop new snapshots → fetch message → critical audit/alert → no bypass via other terminal · offline only if MRA allows (default no) → poll unblock → config refresh → health check → resume.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
