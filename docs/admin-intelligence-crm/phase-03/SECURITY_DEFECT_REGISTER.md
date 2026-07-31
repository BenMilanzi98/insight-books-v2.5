# Security Defect Register — Phase 3

**Opened:** 2026-07-28

| ID | Severity | Defect | Evidence | Wave | Status |
|----|----------|--------|----------|------|--------|
| P3-D01 | Critical | Middleware accepts any `admin_token` string without JWT verify | `middleware.js` | 2 | Mitigated (edge JWT verify) |
| P3-D02 | Critical | Legacy admin APIs skip DB reload / permissions | analytics, users/create, bulk, … | 2 | Partial (analytics migrated; others remain) |
| P3-D03 | High | Sensitive dashboard stats auth-only (no metric filters) | `dashboard/stats` | 2 | Mitigated (`projectDashboardStats`) |
| P3-D04 | High | Support access does not constrain tenant data / no real impersonation | supportAccess API | 3 | Open |
| P3-D05 | High | `AdminTenantAccess` unused → implicit cross-tenant visibility | schema vs code | 2 | Partial (`withAdminTenantFilter` on tenants GET) |
| P3-D06 | High | Super Admin bypass without break-glass audit | `adminHasPermission` | 1 | Mitigated (`breakGlass` on decision) |
| P3-D07 | High | Possible self-escalation via `changeRole` to Super Admin | users/actions | 3 | Mitigated (`assertRoleChangeSafe`) |
| P3-D08 | Medium | No admin session revoke / MFA | security/sessions 501 | 3 | Open |
| P3-D09 | Medium | No platform SoD hard blocks | billing keys only | 3 | Partial (`assertSoD` helper; wire billing routes next) |
| P3-D10 | Medium | No field projection / masking | API payloads | 4 | Open |
| P3-D11 | Medium | Search/export lack tenant allow-list | adminSearch / exports | 4 | Open |
| P3-D12 | Medium | Stale permission risk (no permissionVersion) | JWT claims | 3–4 | Open |
| P3-D13 | Low | Notification deep-link policy absent | notification foundation | 4 | Open |
| P3-D14 | Low | Access review / dormant privileged users absent | — | 5 | Open |
| P3-D15 | Info | Stale Phase 2 permission audit docs | docs | 0 | Closed (refreshed) |

**Exit criterion:** No open Critical/High before Phase 3 close.
