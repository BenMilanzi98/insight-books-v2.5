# Task P16-3 Review — Wave 3 Subscription / entitlements / billing / payment / activation

**Mode:** Spec + quality (read-only)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Brief / report:** `task-p16-3-brief.md` / `task-p16-3-report.md`  
**Date:** 2026-07-31  
**Vitest:** Not re-run (per instructions); claimed 8 Wave 3 (+ Wave 1–2 → 29); source has **8** `it(...)` matching brief TDD list  

---

### Spec Compliance: ✅

| Criterion | Status | Notes |
|-----------|--------|-------|
| Interfaces (sub/entitlements/billing/payment/activation) | ✅ | Exported via `lib/admin/crm` + conversions barrel; `wave3Runner` wires spine |
| Entitlement qty ≤ accepted; no hidden features | ✅ | `entitlement_qty_exceeds_accepted` / `hidden_entitlement_forbidden` |
| Invoice from accepted snapshot; idempotent | ✅ | Totals from snapshot; `source: ACCEPTED_SNAPSHOT`; exact key → same id |
| Payment initiation ≠ PAID | ✅ | `PENDING` or `NOT_CONFIGURED`; `fabricatedPaid: false`; never PAID |
| Activation prerequisites; Closed Won ≠ ACTIVE | ✅ | Runner hardcodes `paymentSuccessful: false`; sub `PENDING_ACTIVATION` / `isActive: false` |
| Expansion no duplicate Tenant | ✅ | AMEND path; tenant count unchanged |
| Platform Invoice → no Tenant GL | ✅ | `assertNoTenantAccountingSideEffects` after create; tested |
| Orchestrator after Wave 2 | ✅ | `ensureWave3Steps` + `runWave3ProvisionSpine` when Wave 2 not blocked |
| SQL / Prisma | ✅ | `PlatformBillingAccount` / `Schedule` / `CrmConversionActivationAttempt` |
| No commit | ✅ | WORKING_TREE |
| Vitest Wave 3 PASS (claim) | ✅ | Report 8/8; source case list matches brief TDD |

### Global constraints spot-check

- Entitlement qty ≤ accepted — **held**
- Invoice from accepted snapshot; idempotent — **held**
- Payment initiation ≠ PAID — **held**
- Activation prerequisites; Closed Won ≠ ACTIVE — **held** (orchestrator path)
- No Tenant GL; no commit — **held**

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

1. **Blocked activation attempts poison exact idempotencyKey** — `lib/admin/crm/conversions/activation.js` (~141–155, ~163–180)  
   AFTER_PAYMENT failure writes `CrmConversionActivationAttempt` with `activated: false`. Exact retry (`act:${conversionId}`) replays the failure forever and never re-evaluates after payment truth arrives. Additionally `COMPLETED_WITH_WARNING` is treated as completed (`isStepCompleted`), so the Wave 3 spine will not re-enter ACTIVATE. Only success should short-circuit; blocked/deferred attempts must remain re-evaluable (or use a distinct success key).

2. **AFTER_PAYMENT trusts `evidence.paymentSuccessful` boolean without payment truth** — `activation.js` (~56–68, ~190–208)  
   Hard rule is no fabricate PAID/ACTIVE. A caller can pass `paymentSuccessful: true` (no `paymentId`) and get ACTIVE. Platform payment verification runs only when `paymentId` is present. Require a successful `platformPayment` (or equivalent verified receipt) for AFTER_PAYMENT; do not treat a bare boolean as payment truth.

3. **Entitlement / Activate steps can stick `IN_PROGRESS` when `subscriptionId` is missing** — `wave3Runner.js` (~282–283, ~606)  
   `beginStep` marks IN_PROGRESS, then the body is gated on `subscriptionId`. Subscription `NOT_AVAILABLE` (typed soft path, not blocked) leaves `subscriptionId` null → PROVISION_ENTITLEMENTS / ACTIVATE_SUBSCRIPTION never complete. Skip or `COMPLETED_WITH_WARNING` before/instead of begin when prerequisites are absent.

4. **Activation promotes all PENDING entitlements for the tenant** — `activation.js` (~255–274)  
   `findMany({ where: { tenantId } })` activates every pending row, not only this conversion’s set. Scope by conversion resource entitlement ids / subscription linkage to avoid cross-conversion side effects.

#### Minor (Nice to Have)

1. **Payment step failure does not set `blocked`** — runner continues to activation; OK for AFTER_PAYMENT default, surprising for other policies if payment hard-fails.
2. **`paymentBoundary.js` dead ternary** — `idempotencyKey: payIdem === idempotencyKey ? idempotencyKey : idempotencyKey` always stores conversion key; `payIdem` unused.
3. **Billing account LINK path not idempotent** — `existingBillingAccountId` returns LINK without persisting `idempotencyKey`/resource; retry can CREATE a second account.
4. **Invoice create + boundary fail → retry returns ok** — boundary checked only on first create; idempotent replay skips re-check (low risk if invoice itself never posts GL).
5. **Entitlement quantity not on `PlatformFeatureEntitlement`** — qty only in reason/`metaJson` (schema has no quantity field); acceptable until taxonomy gains a qty column.
6. **`PENDING_ACTIVATION` vs legacy `"Pending"`** — report concern #2; UI/reporting must treat both as non-active.
7. **Prisma EPERM / SQL fallback** — apply `scripts/sql/crm-conversion-phase16-wave3.sql` before runtime.
8. **Orchestrator returns `ok: true` when `blocked: true`** — same Wave 1–2 pattern; callers must check `blocked` / step status.

---

### Acceptance checklist (brief)

- [x] Vitest Wave 3 PASS (claimed 8/8; not re-run; source matches TDD)
- [x] Subscription pending until activation policy
- [x] Invoice idempotent; payment honesty
- [x] No Tenant GL; no commit
- [~] Activation deferred honesty — orchestrator path OK; API boolean + blocked-attempt idempotency gaps (Important #1–#2)

### Assessment

Wave 3 modules, SQL/Prisma, orchestrator wiring, and claimed TDD coverage meet the brief on the happy path and hard commercial rules (qty cap, snapshot invoice, payment ≠ PAID, Closed Won ≠ ACTIVE, no Tenant GL). Quality is **not** approved until deferred activation can succeed after payment (no poisoned idempotency), AFTER_PAYMENT requires verified payment truth, missing-subscription steps cannot stick IN_PROGRESS, and entitlement activation is conversion-scoped.

**Spec:** ✅  
**Task quality:** Not approved  
**Findings:** Critical 0 · Important 4 · Minor 8  

**Review path:** `.superpowers/sdd/task-p16-3-review.md`

---

## RE-REVIEW (post Important fixes)

**Date:** 2026-07-31  
**Mode:** Spec + quality (read-only; implementation not mutated)  
**Vitest:** Not re-run; source has **12** `it(...)` (matches report claim 12/12)

### Important #1–4 verification

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | Poisoned activation idempotency | **FIXED** | `activation.js`: short-circuit only when `priorAttempt.activated === true`; blocked upserts supersede via `upsertActivationAttempt`; Wave 3 ACTIVATE deferred → `FAILED_RETRYABLE` (not `COMPLETED_WITH_WARNING`) |
| 2 | AFTER_PAYMENT trusts caller boolean | **FIXED** | `resolveAuthoritativePaymentSuccess` + `paymentVerified` only; `paymentSuccessful`/`paymentCompleted` cleared before `evaluateActivationPolicy` |
| 3 | Missing `subscriptionId` sticky `IN_PROGRESS` | **FIXED** | `wave3Runner.js`: PROVISION_ENTITLEMENTS / ACTIVATE_SUBSCRIPTION complete as `FAILED_RETRYABLE` + `subscriptionId_required` |
| 4 | Activates all tenant PENDING entitlements | **FIXED** | `resolveScopedEntitlementIds` — `args.entitlementIds` or `ENTITLEMENT_SET` meta; empty → promote none |

New Wave 3 cases cover re-eval after payment, boolean forgery, scoped promote, missing-subscriptionId. Orchestrator still wires `ensureWave3Steps` + `runWave3ProvisionSpine` after Wave 2.

### Residual

Prior **Minor** items remain (dead ternary in `paymentBoundary.js`, LINK billing idempotency, etc.) — none block approval.

### Assessment

**Spec:** ✅  
**Quality Approved?** ✅ Yes  
**Findings:** Critical 0 · Important 0 (prior 4 fixed) · Minor 8 (unchanged)  
**Review path:** `.superpowers/sdd/task-p16-3-review.md`
