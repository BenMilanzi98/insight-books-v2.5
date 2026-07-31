# Tenant Identity Transfer (Export / Import)

**Date:** 2026-07-28  
**Status:** Approved — pending implementation plan  
**Apps:** Insight Books v2.0 and v2.5 (`/insightbooks/`)  
**Format:** `insightbooks-tenant-identity-v1`

## Goals

- Export and import **tenant identity** between v2.0 and v2.5 (and same-app backup/restore).
- Preserve login credentials by transferring bcrypt password hashes unchanged.
- Support filters: active tenants, paid-but-inactive tenants, or a specific tenant.
- Import must not abort the batch on conflicts: **skip** existing tenants/users and report results.
- Preserve original tenant/user/role IDs when free; skip if ID or subdomain already exists.

## Non-goals

- Business data (clients, invoices, stock, journals, CoA balances, etc.).
- Platform `Admin` users (separate table).
- Live cross-database sync / service-to-service pull.
- Exporting EIS API secrets or other high-sensitivity secrets from `TenantSettings`.

## Approach

Shared portable JSON package + Admin UI in **both** apps:

- Page: `/insightbooks/tenant-identity-transfer`
- Export and Import tabs in v2.0 and v2.5
- Shared library modules per app (same contract): filter → serialize → validate → dry-run → import
- Manual download/upload (no DB coupling between environments)

## Export filters

| Filter | Rule |
|--------|------|
| **Active** | Derived subscription status is paid-active (`AccountSubscription`: `isActive`, `!isTrial`, `expiresAt > now`, status not cancelled/pending/expired) **and** tenant account status is not suspended/archived (`status` in `active` / `ACTIVE`, case-insensitive). |
| **Paid but inactive** | `paidBefore === true` (any non-trial subscription with payment evidence: `paymentDate` set, or `amount > 0`, or past/present `expiresAt`) **and** not currently paid-active. |
| **Specific tenant** | Exact match by `tenantId` **or** `subdomain`. |

**Defaults / notes:**

- Trial-only tenants (never paid) are **excluded** from Active and Paid-but-inactive.
- Export UI shows a preview table before download: name, subdomain, plan, derived `subscriptionStatus`, `paidBefore`, user count.

## Package format (`insightbooks-tenant-identity-v1`)

Top-level envelope:

```json
{
  "format": "insightbooks-tenant-identity-v1",
  "formatVersion": 1,
  "exportedAt": "ISO-8601",
  "sourceApp": "v2.0 | v2.5",
  "filter": { "mode": "active | paid_inactive | specific", "tenantId": null, "subdomain": null },
  "tenants": [ /* TenantPackage */ ]
}
```

Each `TenantPackage`:

| Section | Contents |
|---------|----------|
| `tenant` | `id`, `name`, `subdomain`, `status`, `subscriptionPlan`, branding fields, `ownerUserId`, `tpin`, `eisEnabled` (flag only), timestamps |
| `settings` | Overlapping **safe** `TenantSettings` scalars only (currency, tax defaults, modules, invoice prefixes, address, capital setup flags, etc.). **Omit** `eisApiKey`, `eisClientSecret`, and similar secrets. |
| `roles` | `id`, `name`, `description`, `permissions` (JSON) |
| `users` | `id`, `email`, `name`, `password` (bcrypt hash), `roleId`, `isActive`, `status`, `isEmailVerified`, `phone`, `department`, `authProvider`, `authProviderId`, `preferredLanguage` (if present), timestamps as needed |
| `memberships` | `id`, `userId`, `tenantId`, `roleId`, `status` |
| `subscriptions` | Full `AccountSubscription` history rows needed for entitlement continuity (`id`, `plan`, `txRef`, amounts, dates, `isActive`, `isTrial`, status, gateway metadata as stored) |
| `derived` | `{ "subscriptionStatus": "active\\|trial\\|expired\\|inactive", "paidBefore": boolean }` |

## Import rules

### Dry-run then commit

1. **Dry-run** validates package shape and computes per-tenant / per-row outcomes: `create` | `skip` | `invalid`.
2. **Commit** applies only `create` rows inside a per-tenant transaction where practical.

### Conflict policy (skip — never overwrite)

| Entity | Skip when |
|--------|-----------|
| Tenant | `id` exists **or** `subdomain` exists |
| Role | `id` exists (if tenant is being created, roles are created with preserved ids; if skip tenant, entire package skipped) |
| User | `id` exists **or** unique `(tenantId, email)` would collide |
| Membership | `id` exists **or** equivalent user/tenant/role membership already exists |
| Subscription | `id` exists **or** `txRef` exists |

Conflicts are **skips**, not batch failures. Validation errors (malformed package, missing required fields) are reported as `invalid` and do not create partial corrupt tenants.

### ID preservation

- Prefer creating with original `id` values when free.
- Remap is not used for skipped tenants; if tenant is created, child rows use package ids.
- `ownerUserId` must point at a user included in the package (or already present); if owner missing after skips, set `ownerUserId` to the first created/active owner-role user or leave null and report a warning.

### Cross-version settings / status

- Copy only known overlapping settings keys; apply **target** defaults for v2.5-only fields (`defaultLanguage`, rental flags, etc.).
- Normalize `Tenant.status` for login compatibility:
  - Map lifecycle enums `ACTIVE` → `active`, `SUSPENDED` → `suspended`, `ARCHIVED` → `archived` on export/import as needed so login checks that expect lowercase `active` continue to work.
  - Document exact mapping in implementation notes if v2.5 lifecycle helpers require uppercase for admin UI — prefer storing the value each app’s login path accepts, and keep admin lifecycle tooling in sync.

### Credentials

- Store and import `User.password` as the existing bcrypt hash string.
- Never log hashes.
- Clear OTP / reset tokens on import (do not copy ephemeral auth challenge fields).

## UI

**Route (both apps):** `/insightbooks/tenant-identity-transfer`

- **Export tab:** filter radios/select + optional tenant id/subdomain + Preview + Download JSON  
- **Import tab:** file upload → Dry-run report → Confirm Commit → result summary (created / skipped / invalid)  
- Security banner: package contains password hashes — treat as confidential  
- Nav: link near Tenant Management / system tools in admin sidebar  

Admin auth: same gate as other `/insightbooks` pages.

## APIs (both apps)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/admin/tenant-identity/export` | Body: filter → returns JSON package (or file download) |
| `POST` | `/api/admin/tenant-identity/import/dry-run` | Upload/parse package → preview outcomes |
| `POST` | `/api/admin/tenant-identity/import` | Commit creates with skip policy |

Audit:

- `TENANT_IDENTITY_EXPORTED` — filter, tenant ids exported, counts (no hashes)
- `TENANT_IDENTITY_IMPORTED` — created/skipped/invalid counts, tenant ids touched

## Library layout (per app)

Suggested modules (names may match local conventions):

- `lib/admin/tenantIdentity/filters.js` — active / paid_inactive / specific
- `lib/admin/tenantIdentity/serialize.js` — build package
- `lib/admin/tenantIdentity/validate.js` — envelope + row validation
- `lib/admin/tenantIdentity/import.js` — dry-run + commit
- `lib/admin/tenantIdentity/settingsFields.js` — allowlist of safe settings keys

Keep v2.0 and v2.5 implementations aligned on the **wire format**; app-specific Prisma field differences stay inside settings allowlists.

## Testing

- Unit: filter classification (active, paid-inactive, trial-only exclusion, specific)
- Unit: validate package; dry-run skip when id/subdomain exists
- Unit: import creates tenant+user and login hash compares successfully (bcrypt.compare against known fixture hash)
- Unit: subscription `txRef` conflict → skip that row only
- Smoke: export from one app, import into the other against local DBs

## Success criteria

- Operator can export Active, Paid-inactive, or one tenant from either app.
- Operator can import the file into the other app with dry-run then commit.
- Existing tenants are skipped without erroring the whole job.
- Newly imported users can sign in with their pre-migration passwords.
- No EIS secrets appear in the package.

## Implementation order (for plan)

1. Shared wire format + filters + serialize/validate unit tests  
2. Export API + UI export tab  
3. Import dry-run + commit API + UI import tab  
4. Nav + audit logs  
5. Cross-app smoke checklist  
