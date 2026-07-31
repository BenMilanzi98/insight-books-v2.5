# Sales Total and Tax Consistency Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

Multiple calculation sites: POS client, sales API, invoice calculations, journals, EIS payload builder, reports.

Phase 3 rule: **one fiscal snapshot from server-finalized totals** — no sixth independent calc in client for MRA.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
