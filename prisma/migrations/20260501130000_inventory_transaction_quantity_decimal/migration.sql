-- InventoryTransaction.quantity: Int cannot hold fractional goods receipt quantities (Prisma client rejects floats).
ALTER TABLE "InventoryTransaction" ALTER COLUMN "quantity" TYPE DECIMAL(18,4) USING ("quantity"::numeric);
