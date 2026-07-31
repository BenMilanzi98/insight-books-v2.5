# Implementation Plan — MRA EIS Payment Plans

**Date:** 2026-07-28  
**Status:** Phase 0 complete · Plan modeling **A (EXTEND PlatformPlanVersion)** locked 2026-07-28  
**Source:** Master prompt + Phase 0 audits in this folder

## Reality check

The master prompt is a full commercial billing product (150+ steps, 100+ acceptance criteria). Delivery must be **phased**. Each phase ships production-usable value with tests; later phases deepen.

## Phase 0 — Audit (DONE)

Artifacts under `docs/mra-eis-payment-plans/*_AUDIT.md` and risk registers.

## Phase 1 — Foundation & safety (P0)

**Goal:** Make money paths safe and models ready.

1. Confirm Platform* migrations present in all envs; add FKs / planCategory fields  
2. Harden PayChangu create-session (server price, plan allow-list)  
3. Fix core+EIS coexistence (deactivate only same product family)  
4. Extend `PlatformPlanVersion` (or approved alternative) for MRA EIS metadata  
5. Plan state machine: DRAFT / APPROVED / PUBLISHED / SUSPENDED / RETIRED (+ versioning rules)  
6. Permissions: `systemAdmin.mraPlans.*` + harden eis-subscriptions APIs  
7. Wire payment success → PlatformPayment (idempotent) + optional entitlement request  

**Exit:** No client amount trust; no cross-product subscription wipe; published plans versioned.

## Phase 2 — Admin Plan management

1. Nav: MRA EIS Plans under Billing (distinct from Entitlement)  
2. Plan list / detail / create wizard (MVP steps)  
3. Features + limits catalogues (controlled codes)  
4. Public preview (draft-only for admins)  
5. Publish / suspend / retire / new version commands  

**Exit:** Admin can create and publish EIS plans without code changes.

## Phase 3 — Public + tenant commercial surfaces

1. Canonical pricing service (single calculator)  
2. Public `/mra-eis/pricing` (+ landing section) — published only  
3. Compare plans (responsive)  
4. Auth continuation preserving selection  
5. Tenant MRA EIS subscription panel on `/subscription` or `/subscription-management/mra-eis`  
6. Checkout for EIS (idempotent subscription + invoice + payment)  

**Exit:** Public price = checkout = invoice for same plan version + cycle.

## Phase 4 — Lifecycle

Trials, upgrade, downgrade, cycle change, proration, cancel, grace, suspension, reactivation — with Decimal math and change records.

## Phase 5 — Usage & overage

Metering with idempotency; exclude retries/reprints; overage invoice once; alerts at 75/90/100%.

## Phase 6 — Reconciliation, reports, import/export

Reconciliation centre checks from master prompt §45; reports; dry-run imports; secure exports.

## Phase 7 — Hardening

SoD, a11y, dual-language, performance, security suite, E2E scenarios 1–10, readiness decision.

## Explicit non-starts until Phase 1 approved

- Pretty pricing cards alone  
- New competing subscription system  
- Posting SaaS EIS charges into tenant sales AR  
- Auto-production entitlement on payment without policy  

## Immediate decision gate

Approve plan modeling approach (see FINAL_GAP_REGISTER.md) before Phase 1 schema work.
