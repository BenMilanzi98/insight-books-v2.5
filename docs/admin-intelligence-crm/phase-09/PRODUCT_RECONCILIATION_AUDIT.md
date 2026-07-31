# Product Reconciliation Audit

| Pair | Status | Notes |
|------|--------|-------|
| Domain Invoice posts ↔ AnalyticsEvents | NOT_FOUND | Wave 1+ after producer |
| Phase 4 billing facts recon | READY pattern | Reuse reconcile helpers |
| Catalogue vs RBAC modules | PENDING Wave 1 | Matrix-driven |
| First-value facts vs source ids | NOT_FOUND | Wave 2 |

**Anti-pattern:** Recon that “fills” missing product events with Invoice counts without emitting idempotent events.
