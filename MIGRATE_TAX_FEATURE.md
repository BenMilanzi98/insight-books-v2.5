# Tax Feature Migration Guide

## ⚠️ CRITICAL: Run This Migration First

The tax feature requires database tables that don't exist yet. **You MUST run the migration before using the feature.**

## Quick Start

```bash
npx prisma migrate dev --name add_product_tax_management
```

## What This Migration Creates

1. **ProductTax** table - Links products to tax types (many-to-many)
2. **SaleItemTax** table - Stores individual tax records per sale item

## Verification

After migration, verify tables exist:

```bash
npx prisma studio
```

Look for:
- `ProductTax` table
- `SaleItemTax` table

## Current Status

✅ **Code is ready** - All functionality implemented
⚠️ **Database not ready** - Migration needed
✅ **Error handling** - Code gracefully handles missing tables

## What Works Without Migration

- Tax type creation/management
- POS tax calculation (uses product.taxRate fallback)
- Basic receipt display

## What Requires Migration

- Assigning multiple taxes to products
- Detailed tax breakdown on receipts
- Historical tax tracking per sale item

## Troubleshooting

If you see errors like:
- "Unknown model ProductTax"
- "Table does not exist"
- "Unknown field itemTaxes"

**Solution**: Run the migration above.

