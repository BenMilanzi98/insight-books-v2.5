# Database Model Audit (Platform Admin)

Source of truth: `prisma/schema.prisma`.

## Admin identity & access

### `Admin` — KEEP / EXTEND

| Field | Notes |
|-------|-------|
| `id`, `email` (unique), `name`, `password` | Core identity |
| `role` String default `"Super Admin"` | Free-string; Super Admin bypass in `adminHasPermission` |
| `permissions` Json default `{}` | Untyped nested `{ category: { action: true } }` — **no `systemAdmin.*` catalog** |
| `isActive`, `lastLogin`, profile fields | Operational |
| Relations | `AdminAuditLog`, `AdminTenantAccess`, `EmailLog` (as sender) |

### `AdminTenantAccess` — KEEP / INCOMPLETE

Scoped admin↔tenant grants (`accessLevel`, `expiresAt`, `isActive`). Underused by most `/api/admin` routes (most ops are global Super Admin). CROSS_TENANT_RISK if partially enforced later without full adoption.

### `AdminAuditLog` — KEEP

Structured admin actions (`action`, `entityType`, `entityId`, ip/ua). Canonical for platform audit page.

### `AdminActivityLog` — REFACTOR / DISCONNECTED

`adminId` relates to **`User`**, not `Admin` — legacy naming smell; do not treat as platform admin audit source of truth.

## Tenancy & subscriptions

### `Tenant` — KEEP

Primary multi-tenant root. Heavily related (settings, memberships, subscriptions, EIS, etc.).

### `AccountSubscription` — KEEP

Platform SaaS subscription per tenant: `plan`, `txRef` unique, `amount`, `currency`, `status`, trial fields, `gatewayResponse`, `isActive`, dates. Linked to `eisInvoices EISInvoice[]`.

### `BranchSubscription` — KEEP / EXTEND

Per-branch paid capacity; admin APIs under `branch-subscriptions*`.

## Affiliates

### `Affiliate`, `AffiliateReferral`, `AffiliatePayout` — KEEP

Real commission/referral/payout model backing `/insightbooks/affiliate` and `/api/admin/affiliate*`.

## Mobile

### `MobileAppConfig` — KEEP

Singleton-style `id = "global"`: version codes, APK URL, grace windows, `forceLock`, `websiteDownloadLocked`, `maintenanceLock`, broadcast message.

### `MobileAppClientEvent` — KEEP

Anonymous telemetry for version checks / OTA funnel.

## Email

### `EmailLog` — KEEP / EXTEND

Recipient, template, status, `sentByAdmin` → `Admin`, optional `tenantId`. Backs email-management history.

## System chart of accounts

### `SystemCoaDefinition` — KEEP (API)

| Field | Notes |
|-------|-------|
| `id` default `"default"` | Singleton template |
| `payload` Json | System CoA definition |
| `updatedByEmail` | Audit-ish |
| map | `system_coa_definition` |

Tenant ledgers use `Account` (tenant-scoped) — not the same as platform template. Admin **UI** for editing template is removed; model + APIs remain.

## MRA EIS (`MraEis*`) — KEEP / EXTEND

Large platform control plane: `MraEisPlatformSetting`, entitlements, participation, terminals, credentials (references), configuration snapshots/activations, mappings, catalogue, transmissions, reconciliation, migration, encryption metadata, etc. Admin surfaces under `/insightbooks/mra-eis/*` and `/api/admin/mra-eis/*`. Permissions in `lib/mraEis/domain/permissions.js` (`system.eis.*`).

**Do not confuse** with legacy `EISInvoice` / `EISConfiguration` (tenant fiscal/invoice submission artifacts).

## Security governance (`SecV2*`) — EXTEND / INCOMPLETE (admin UI)

Includes sessions, API keys, service accounts, approval policies/requests, SoD rules, audit events/integrity runs, alerts/incidents, impersonation, emergency access, MFA, exports, etc. Admin security pages partially surface monitoring; full SecV2 admin UX is incomplete.

## Billing / invoices — critical gaps

### Tenant `Invoice` — DUPLICATE_BILLING_RISK if used as platform billing

AR invoices between tenant and their clients. **`/api/admin/invoices` currently `findMany` on `prisma.invoice`** — wrong domain for “platform subscription invoices”.

### `EISInvoice` — KEEP (tenant fiscal) / not PlatformInvoice

MRA-related invoice submission records linked optionally to `AccountSubscription`. Not a platform billing ledger.

### `PlatformInvoice` — MISSING

**No Prisma model** named `PlatformInvoice` (or equivalent platform billing invoice/payment tables) exists. Consequences:

- Admin invoices/payments pages are STUB
- Risk of operators treating tenant `Invoice` rows as InsightBooks SaaS invoices
- Phase 5 must introduce explicit platform billing schema (name TBD; preferred `PlatformInvoice` + payments) **separate** from tenant AR and EIS fiscal invoices

## Classification summary

| Model | Classification |
|-------|----------------|
| Admin | KEEP / EXTEND |
| AdminTenantAccess | KEEP / INCOMPLETE |
| AdminAuditLog | KEEP |
| AdminActivityLog | REFACTOR / DISCONNECTED |
| Tenant | KEEP |
| AccountSubscription | KEEP |
| BranchSubscription | KEEP |
| Affiliate* | KEEP |
| MobileAppConfig / MobileAppClientEvent | KEEP |
| EmailLog | KEEP / EXTEND |
| SystemCoaDefinition | KEEP (API) |
| Account (tenant CoA) | Out of admin UI scope after CoA removal |
| MraEis* | KEEP / EXTEND |
| SecV2* | EXTEND / INCOMPLETE |
| Invoice (tenant) | DUPLICATE_BILLING_RISK if used as platform billing |
| EISInvoice | KEEP (tenant/fiscal) — not platform billing |
| PlatformInvoice | MISSING → REIMPLEMENT schema in Phase 5 |
