/**
 * Self-heal: InvoiceItem.accountId exists in Prisma schema but was missing on some deployments.
 * Applies the same DDL as migration 20260621180000_invoice_item_account_id when absent.
 */
import prisma from '@/lib/prisma';

/** @type {boolean | null} */
let cachedHasColumn = null;
/** @type {Promise<boolean> | null} */
let ensurePromise = null;

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function hasInvoiceItemAccountIdColumn(db = prisma) {
  if (cachedHasColumn !== null) return cachedHasColumn;
  try {
    const rows = await db.$queryRaw`
      SELECT 1 AS ok
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'InvoiceItem'
        AND column_name = 'accountId'
      LIMIT 1`;
    cachedHasColumn = Array.isArray(rows) && rows.length > 0;
    if (cachedHasColumn) return true;
  } catch (err) {
    console.warn('[ensureInvoiceItemAccountId] column check failed:', err?.message || err);
  }
  return false;
}

/**
 * Add InvoiceItem.accountId if missing. Safe to call repeatedly.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db]
 * @returns {Promise<boolean>} true when column is present after this call
 */
export async function ensureInvoiceItemAccountIdColumn(db = prisma) {
  if (cachedHasColumn === true) return true;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    if (await hasInvoiceItemAccountIdColumn(db)) return true;

    console.warn('[ensureInvoiceItemAccountId] Adding missing InvoiceItem.accountId column…');

    await db.$executeRawUnsafe(`
      ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "InvoiceItem_accountId_idx" ON "InvoiceItem"("accountId");
    `);
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceItem_accountId_fkey'
        ) THEN
          ALTER TABLE "InvoiceItem"
            ADD CONSTRAINT "InvoiceItem_accountId_fkey"
            FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    cachedHasColumn = true;
    console.warn('[ensureInvoiceItemAccountId] InvoiceItem.accountId column is now available.');
    return true;
  })();

  try {
    return await ensurePromise;
  } catch (err) {
    ensurePromise = null;
    cachedHasColumn = null;
    console.error('[ensureInvoiceItemAccountId] failed:', err?.message || err);
    return false;
  }
}

/**
 * Build invoice line create payload — omits accountId when column still unavailable.
 * @param {object} item
 * @param {boolean} includeAccountId
 */
export function buildInvoiceItemCreateData(item, includeAccountId) {
  const base = {
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    taxRate: Number(item.taxRate || 0),
    discountRate: Number(item.discountRate || 0),
    discountAmount: Number(item.discountAmount || 0),
    netAmount: Number(item.netAmount ?? 0),
    amount: Number(item.amount),
    productId: item.productId || null,
  };
  if (includeAccountId && item.accountId) {
    base.accountId = item.accountId;
  }
  return base;
}

/** Reset cache (tests only). */
export function resetInvoiceItemAccountIdCache() {
  cachedHasColumn = null;
  ensurePromise = null;
}

const MISSING_COLUMN_MESSAGE =
  'Database schema is out of date (missing column: accountId on InvoiceItem). Run: npm run db:sync-schema-gaps or npm run db:migrate:deploy';

/**
 * Ensure column exists; returns NextResponse 503 when still missing (for route handlers).
 * @returns {Promise<{ ok: true, hasColumn: boolean } | { ok: false, response: import('next/server').NextResponse }>}
 */
export async function requireInvoiceItemAccountIdColumn() {
  const hasColumn = await ensureInvoiceItemAccountIdColumn();
  if (hasColumn) return { ok: true, hasColumn: true };
  const stillMissing = !(await hasInvoiceItemAccountIdColumn());
  if (stillMissing) {
    const { NextResponse } = await import('next/server');
    return {
      ok: false,
      response: NextResponse.json(
        { error: MISSING_COLUMN_MESSAGE, code: 'P2022' },
        { status: 503 },
      ),
    };
  }
  return { ok: true, hasColumn: false };
}
