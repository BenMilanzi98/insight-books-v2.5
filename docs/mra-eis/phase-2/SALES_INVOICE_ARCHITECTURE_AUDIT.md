# Sales Invoice Architecture Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

- Draft: no inventory/GL/EIS.
- Non-Draft create: inventory + journals + tax in tx; EIS after commit.
- PDF/email: separate routes after issue.
- Payment after issue must **not** create new EIS sale.
- Safe fiscalization event: **Invoice issued/posted (non-Draft) after accounting success**, not Draft, not payment.
- Status casing inconsistency (Draft vs draft) — integrity risk.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
