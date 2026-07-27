# Chart of Accounts Route Removal Audit

## Locked policy

1. **Remove** System Chart of Accounts from admin **navigation and page UI**.
2. **Redirect** `/insightbooks/chart-of-accounts` → `/insightbooks/dashboard?notice=coa-removed`.
3. **Keep** system-coa APIs and `SystemCoaDefinition` model for ops/migration.

## Current state

| Item | Path | Classification |
|------|------|----------------|
| Admin page | `app/insightbooks/chart-of-accounts/page.js` (~2k+ lines) | REMOVE (UI) — real editor, not a stub |
| Nav entry | AdminSidebar: “System chart of accounts” 📒 | REMOVE |
| Tenant CoA | `/chart-of-accounts` (tenant app) | KEEP — **out of scope**; must not break |
| APIs | `/api/admin/system-coa`, `system-coa/apply`, `system-coa/tenant-accounts`, `coa-migration` | KEEP |
| Model | `SystemCoaDefinition` | KEEP |
| Helper | `lib/systemCoaPayload` | KEEP |
| UI table | `SystemLedgerCoaTable` | LEGACY_READ_ONLY for admin; may remain for scripts/tools |

## Why remove the admin UI

- Confuses operators: system template vs tenant ledger (`/chart-of-accounts`).
- High-power apply/migrate actions belong behind explicit ops tooling + permissions, not a general sidebar item.
- Reimplementation focuses admin IA on tenancy, billing, EIS, mobile, security — not GL template editing in the main shell.
- APIs remain for controlled maintenance without exposing a full editor in production nav.

## Redirect specification

| From | To | Behavior |
|------|-----|----------|
| `/insightbooks/chart-of-accounts` | `/insightbooks/dashboard?notice=coa-removed` | Permanent product redirect (implement via `page.js` redirect or `next.config` redirect) |
| `/admin/chart-of-accounts` | Already rewritten by middleware to `/insightbooks/...` then same redirect | Covered |

### Dashboard notice

- `AdminNotice` / banner when `notice=coa-removed`:
  - Message: System Chart of Accounts UI has been removed from System Admin. Tenant charts remain under each business. Platform template maintenance is API/ops-only.
- Strip query after dismiss (client) optional.

## API retention matrix

| API | Keep? | Permission target |
|-----|-------|-------------------|
| `GET/PUT /api/admin/system-coa` | YES | `systemAdmin.coa.read` / `.apply` (or manage) |
| `POST /api/admin/system-coa/apply` | YES | `systemAdmin.coa.apply` + audit log |
| `GET /api/admin/system-coa/tenant-accounts` | YES | `systemAdmin.coa.read` |
| `/api/admin/coa-migration` | YES | Super Admin or dedicated migrate permission |

## Removal checklist (Phase 1)

- [ ] Remove sidebar item
- [ ] Replace page with redirect (+ notice query)
- [ ] Confirm tenant `/chart-of-accounts` unaffected
- [ ] Confirm APIs still authenticated
- [ ] Document ops runbook for API-only CoA maintenance
- [ ] Do **not** delete `SystemCoaDefinition` or payload helpers

## Classification

| Decision | Code |
|----------|------|
| Admin CoA page | REMOVE |
| Admin CoA nav | REMOVE |
| Redirect with notice | KEEP (policy) |
| system-coa APIs | KEEP |
| Tenant CoA | KEEP (separate product surface) |
