# API Authorisation Audit

## Patterns observed

1. **Modern:** `getAdminFromRequest` + `adminHasPermission(SYSTEM_ADMIN_PERMISSIONS.*)` — KEEP.
2. **Auth-only:** Any active admin — e.g. parts of dashboard — UNSAFE for sensitive payloads.
3. **Legacy JWT:** `jwt.verify` + `decoded.isAdmin` without DB reload — UNSAFE (deactivate lag).

`/api/admin` is excluded from tenant api-guard by design — handlers must be strict.

## Priority refactor set (Wave 2)

- `dashboard/stats` — apply metric permission filters
- Legacy analytics / users/create / users/bulk / maintenance / system/info
- All export and search routes — confirm permission + scope
- Support-access — SoD + caller ownership on end

**Target:** Single `requireAdminDecision` helper on every `/api/admin` mutation and sensitive read.
