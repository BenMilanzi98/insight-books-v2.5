# Concurrency Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

Risks: double POS submit; multi-replica fiscal sequence; config change mid-submit; mapping change mid-submit; period close race.

Need: per-terminal sequence locks (advisory/row), unique constraints, optimistic version on snapshot — **not** global lock.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
