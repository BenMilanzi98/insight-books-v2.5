# Tenant Subscription UI Audit

**Date:** 2026-07-28

## Routes

| Route | Classification |
|-------|----------------|
| `/subscription` (+ cancel/error) | KEEP / EXTEND — primary checkout |
| `/subscription-management/**` | GAP — does not exist |
| `/settings/subscription` | GAP |
| Tenant `/billing` | GAP |
| `/settings/integrations/mra-eis/**` | KEEP — ops, not commercial plans |

## EIS purchase UI

**None.** Tenant cards use public core plans only. EIS activation is admin-side (UI currently hidden).

## Gaps for master prompt

- Distinguish Core vs MRA EIS subscription on one management surface  
- Plans / current / usage / invoices / payments / change-plan  
- Status chips: Subscription Active · Entitlement Pending · Configuration Incomplete · Ready  
- Server-validated pricing (never trust client amount)  
