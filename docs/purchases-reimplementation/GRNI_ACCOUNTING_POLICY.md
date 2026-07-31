# GRNI Accounting Policy

## Target

| Event | Debit | Credit |
|-------|-------|--------|
| Inventory goods receipt (accepted) | Inventory Asset | **GRNI (2115)** |
| Matched inventory supplier bill | **GRNI** (+ Input VAT, ± PPV) | Accounts Payable (2110) |
| Supplier payment | Accounts Payable | Cash / Bank |

## Feature flag

| Flag | Key | Default |
|------|-----|---------|
| GRNI V2 | `purchasesGrniV2Enabled` (`PURCHASES_FLAGS.GRNI_V2`) | **ON** (unless explicitly disabled in `AcctV2FeatureFlag`) |
| Matching V2 | `purchasesThreeWayMatchV2Enabled` | **ON** |

Disable per tenant only for legacy repair windows via `AcctV2FeatureFlag` (`enabled: false`).

## CoA

| Code | Name | Purpose |
|------|------|---------|
| 2115 | Goods Received Not Invoiced (GRNI) | `GRNI` |

Gap-fill: `ensureMissingBlueprintAccountsForTenant` / `ensureGrniAccountExists`.  
Legacy resolve code: `LEGACY_MAPPING_CODES.GRNI = '2115'`.

## Code paths

| Path | Behaviour when flag ON |
|------|------------------------|
| `buildInventoryReceivedDraft` | Cr GRNI |
| `buildSupplierBillDraft` + `goodsReceiptId` | Dr GRNI, Cr AP (no inventory re-debit) |
| `autoCreateBillFromReceipt` | Draft bill, no shared JE, no `currentBalance` increment |

When flag OFF: legacy Dr Inventory / Cr AP at receipt; auto-bill Unpaid with shared JE.

## Historical data

Tenants with AP-at-receipt history must not be silently rewritten. Migration/repair script is a separate task (see `REIMPLEMENTATION_PLAN.md` Phase 2).

## Implementation status

| Item | Status |
|------|--------|
| Purpose + blueprint 2115 | Done |
| Flag | Done |
| Receipt / bill templates | Done (flag-gated) |
| Auto-bill decoupling | Done (flag-gated) |
| Matching / PPV / landed cost | Not done |
| Tenant enablement + recon | Not done |
