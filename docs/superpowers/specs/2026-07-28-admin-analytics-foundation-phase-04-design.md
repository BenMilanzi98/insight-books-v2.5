# Admin Analytics Foundation Phase 4 — Design

**Status:** Approved via plan execution  
**Date:** 2026-07-28

## Goal

Rebuildable analytics plane: outbox → versioned events → idempotent consumers → facts/snapshots → reconciliation + pipeline health UI.

## Decisions

- Separate Prisma models (not AcctV2/MraEis outboxes)
- Same-DB dispatcher v1
- Verified producers only; CRM events catalogue-only
- SaaS money facts from Platform* / AccountSubscription only
- Admin APIs via `authorizeAdminDecision` + `health.view`

## Non-goals

KPI dashboards, invented history, billing/accounting logic changes.
