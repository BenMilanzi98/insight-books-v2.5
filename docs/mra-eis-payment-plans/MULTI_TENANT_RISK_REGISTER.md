# Multi-Tenant Risk Register

**Date:** 2026-07-28

| ID | Risk | Severity | Status |
|----|------|----------|--------|
| MT-01 | Checkout/subscription IDOR if tenantId not reloaded server-side | Critical | Mitigate in design |
| MT-02 | Admin APIs listing without tenant scoping for support ops — acceptable if admin-only | Medium | Monitor |
| MT-03 | Cache leakage of pricing/capability across tenants | High | Design required |
| MT-04 | Export/import without tenant filter | High | Design required |
| MT-05 | Notification deep links wrong tenant | Medium | Design required |
