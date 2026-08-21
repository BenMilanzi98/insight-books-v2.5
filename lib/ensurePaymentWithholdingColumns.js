/**
 * Self-heal: Payment WHT / cash-received columns exist in Prisma schema but may be
 * missing on deployments that have not yet applied
 * 20260821120000_payment_withholding_columns.
 */
import prisma from '@/lib/prisma';

/** @type {boolean | null} */
let cachedReady = null;
/** @type {Promise<boolean> | null} */
let ensurePromise = null;

const REQUIRED = ['cashReceivedAmount', 'withholdingAmount', 'withholdingPercent'];

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function ensurePaymentWithholdingColumns(db = prisma) {
  if (cachedReady === true) return true;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      const rows = await db.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Payment'
          AND column_name IN ('cashReceivedAmount', 'withholdingAmount', 'withholdingPercent')
      `;
      const have = new Set((rows || []).map((r) => String(r.column_name)));
      const missing = REQUIRED.filter((c) => !have.has(c));
      if (missing.length === 0) {
        cachedReady = true;
        return true;
      }

      console.warn(
        '[ensurePaymentWithholdingColumns] adding missing Payment columns:',
        missing.join(', ')
      );

      await db.$executeRawUnsafe(
        `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cashReceivedAmount" DECIMAL(18,2)`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "withholdingAmount" DECIMAL(18,2)`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "withholdingPercent" DECIMAL(8,4)`
      );

      cachedReady = true;
      return true;
    } catch (err) {
      console.error(
        '[ensurePaymentWithholdingColumns] failed:',
        err?.message || err
      );
      cachedReady = null;
      return false;
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}
