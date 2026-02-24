#!/usr/bin/env node
/**
 * Add PurchaseOrder / PurchaseOrderItem columns if missing (e.g. after restore from old dump).
 * Safe to run multiple times (idempotent).
 * Run: node scripts/add-po-columns-if-missing.js
 * Requires: DATABASE_URL in .env
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const dotenv = require('dotenv');
dotenv.config();

const sql = [
  `ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "supplierInvoiceUrl" TEXT`,
  `ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "taxTypeId" TEXT`,
];

const addFkAndIndex = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderItem_taxTypeId_fkey') THEN
    ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_taxTypeId_fkey"
      FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
`;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set. Load .env or set env.');
    process.exit(1);
  }
  console.log('Adding missing PO columns if not present...');
  for (const q of sql) {
    try {
      await prisma.$executeRawUnsafe(q);
      console.log('OK:', q.split('ADD COLUMN IF NOT EXISTS')[1]?.trim() || q.slice(0, 60));
    } catch (e) {
      if (e.message && e.message.includes('already exists')) {
        console.log('Skip (already exists):', q.slice(0, 60) + '...');
      } else {
        console.error('Error:', e.message);
        throw e;
      }
    }
  }
  try {
    await prisma.$executeRawUnsafe(addFkAndIndex);
    console.log('OK: FK PurchaseOrderItem.taxTypeId -> TaxType');
  } catch (e) {
    if (e.message && (e.message.includes('already exists') || e.message.includes('duplicate key'))) {
      console.log('Skip: FK already exists');
    } else {
      console.warn('FK optional (TaxType may be missing):', e.message);
    }
  }
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_taxTypeId_idx" ON "PurchaseOrderItem"("taxTypeId")`);
    console.log('OK: Index PurchaseOrderItem_taxTypeId_idx');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      console.log('Skip: Index already exists');
    } else {
      throw e;
    }
  }
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
