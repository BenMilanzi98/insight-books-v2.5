# Inventory Expiry Allocation Backfill Runbook

## Purpose
Use this once for legacy products that are perishable, have on-hand stock, but do not yet have open FIFO allocation batches.

## Preconditions
- Latest schema/migrations are applied.
- App API is reachable for the target environment.
- You have a tenant user with stock management privileges.

## Step 1: Identify affected products
- Query products where `isPerishable = true`, `stockLevel > 0`, and no open `InventoryBatch` rows (`qtyRemaining > 0`).
- Spot check that `Product.expiryDate` exists for records that should be alerted.

## Step 2: Run backfill endpoint
- Execute `POST /api/inventory/expiry-alerts/backfill`.
- Expected behavior:
  - Open batches missing `expiryDate` are updated from product-level expiry where available.
  - Products with stock and no open batches are hydrated by stock edit/update flow on next save.

## Step 3: Validate allocations
- Open `/stock`, edit a migrated product, and confirm `expiryAllocations` rows are shown.
- Confirm sum of allocation quantities equals product `quantityInStock`.
- Confirm per-row expiry dates are populated and editable.

## Step 4: Validate alert output
- Call `GET /api/inventory/expiry-alerts`.
- Verify `summary.expired`, `summary.urgent`, and `summary.early` match expected counts.
- Check dashboard expiry cards show the same numbers.

## Step 5: Accounting checks
- For expiry write-off, verify one posted journal entry per deterministic source identity.
- For manual stock-out/negative adjustments, verify expense posting is created in the same transaction path.

## Rollback notes
- There is no destructive backfill delete step in this runbook.
- If a product allocation is wrong, correct it from `/stock` by editing allocation rows and saving.
