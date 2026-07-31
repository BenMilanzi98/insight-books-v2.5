# Integration Inventory

| Integration | Status | Notes |
|---|---|---|
| MRA EIS | CONTROLS_READY_PRODUCTION_BLOCKED | Phases 19–21 delivered; no live sandbox/prod enablement |
| Bank statement import | PARTIALLY_IMPLEMENTED | Bank reconciliation module |
| Email / notifications | PARTIALLY_IMPLEMENTED | Must not duplicate on retry |
| Webhooks | PARTIALLY_IMPLEMENTED | Verify signature + idempotency |
| Payment callbacks | PARTIALLY_IMPLEMENTED | Must map to posting idempotency keys |
| AI advisory (planning / loan) | COMPLETE_REQUIRES_TESTING | Must never post GL (REG-PLAN-NOGL / REG-LRD-NOGL) |
