# Tax Codes Default Inactive (Opt-In Activate)

**Date:** 2026-08-01  
**Status:** Approved  
**Decision:** All tax codes (`TaxType`) start as `Inactive`; users must Activate before transactional use. Mass-deactivate existing rows.

## Goals

1. New `TaxType` rows default to `Inactive` (schema + API + UI + Malawi seed).
2. One-shot: set every existing `TaxType` to `Inactive`.
3. Activate remains the only path into Active-only pickers/write APIs.
4. Seed/settings wiring for VAT GL parents still works when types are Inactive.

## Non-goals

- Auto-activating recommended VAT.
- Changing `TaxAccountMapping` status model.
- Soft-deleting or removing tax codes.

## Design

| Surface | Change |
|---------|--------|
| Prisma `TaxType.status` | `@default("Inactive")` |
| Data migration | `UPDATE` all rows → `Inactive` |
| `POST /api/tax-types` | always create as `Inactive` (body status ignored) |
| Tax Codes / POS / Invoice / Quote / Expenses / Rentals create | create as Inactive; do not auto-apply until Activate |
| Malawi seed create | `status: 'Inactive'`; do not force-activate on update |
| VAT settings lookup | find by `taxId` without requiring `Active` |
| Supersession new version | create as `Inactive` |

Historical documents with Inactive line taxes remain readable; PUT grandfathering unchanged.
