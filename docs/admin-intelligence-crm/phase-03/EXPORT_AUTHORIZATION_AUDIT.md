# Export Authorisation Audit

| Asset | Finding | Class |
|-------|---------|-------|
| `exportSafety` formula injection | Present | KEEP |
| Users export + permission | Present | KEEP |
| Billing `reportsExport` key | Exists; not universal | EXTEND |
| Watermark / audit on every export | Incomplete | AUDIT_GAP |
| Cross-tenant export for limited admins | Unscoped | CROSS_TENANT_RISK |

**Target:** Export permission + decision + AdminAuditLog + scope filter + no sensitive fields beyond projection.
