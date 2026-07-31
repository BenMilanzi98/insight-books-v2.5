# Inventory Integration Audit

## Finding

No `productId` / variant link on rental assets. Booking never creates stock movements (correct for reusable rentals). Consumables-as-add-ons are unsupported.

**Disposition:** `DISCONNECTED` → `EXTEND` for consumable lines via Sales/Inventory stock issue; reusable quantity checkout must not COGS.
