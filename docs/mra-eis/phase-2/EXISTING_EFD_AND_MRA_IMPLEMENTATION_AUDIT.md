# Existing EFD and MRA Implementation Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

| Component | Classification |
|---|---|
| lib/eisConfig.js | REUSABLE_WITH_CHANGES |
| lib/eisService.js | UNSAFE for prod fiscal (rewrite) |
| app/api/eis/* | REUSABLE_WITH_CHANGES / UI bridge |
| Prisma EIS* | REUSABLE_WITH_CHANGES |
| Post-commit submit in sales/invoices | DEPRECATED pattern |
| offlineSalesQueue MRA thresholds | LEGACY / do not equate to MRA offline |
| EFD runtime | NOT_AVAILABLE |
| docs/MRA_EIS_Documentation.md | SUPERSEDED |

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
