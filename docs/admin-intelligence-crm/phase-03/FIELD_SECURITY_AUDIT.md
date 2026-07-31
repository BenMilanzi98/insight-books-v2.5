# Field Security Audit

| Finding | Class |
|---------|-------|
| Server-side field projection for admin APIs | MISSING |
| UI hide of sensitive columns | CLIENT_ONLY_SECURITY |
| Secrets in PlatformGlobalSettings | SECURITY_RESTRICTED — verify API redaction | EXTEND |
| PII on tenant/user lists | Full payloads common | EXTEND |

**Sensitivity classes (target):** PUBLIC_META · INTERNAL_OPS · FINANCE · SECURITY · PII · SECRET  

**Target:** `projectAdminFields(resource, decision)` redacts before JSON serialise.
