# MRA EIS Payment Plans — Phase 1 Implementation Plan

> Agentic workers: implement task-by-task.

**Goal:** Extend `PlatformPlanVersion` for MRA_EIS, harden PayChangu pricing/coexistence, subscription-first entitlement pending, admin MRA EIS Plans MVP.

**Locked:** Model A (EXTEND PlatformPlanVersion) · Entitlement subscription-first.

**Tech:** Prisma, Next.js admin APIs/UI, PayChangu, existing platformBilling + entitlementService.

## Tasks

1. Schema + migrate PlatformPlanVersion fields  
2. Catalog helpers (`lib/admin/mraEisPlans.js`) + seed categorization  
3. Harden create-session + callback (price, category-scoped deactivate, PlatformPayment, entitlement pending)  
4. Admin API `/api/admin/platform-billing/mra-eis-plans`  
5. Admin UI + nav + permissions  
6. Vitest smoke tests  
