/**
 * Purchases GRNI (Goods Received Not Invoiced) policy helpers.
 * When enabled, inventory receipts credit GRNI; matched bills clear GRNI into AP.
 * When disabled, legacy AP-at-receipt behaviour remains.
 */

import { isFlagEnabled, PURCHASES_FLAGS } from '@/lib/accountingV2/infrastructure/featureFlags';

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
export async function isPurchasesGrniEnabled(db, tenantId) {
  if (!tenantId) return false;
  return isFlagEnabled(db, PURCHASES_FLAGS.GRNI_V2, {
    tenantId,
    moduleKey: 'PURCHASES',
  });
}

/**
 * Ensure blueprint account 2115 exists before GRNI posting.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
export async function ensureGrniAccountExists(db, tenantId) {
  if (!tenantId) return;
  const { ensureMissingBlueprintAccountsForTenant } = await import(
    '@/lib/chartOfAccountsInitialization'
  );
  await ensureMissingBlueprintAccountsForTenant(tenantId, db);
}

/**
 * Credit purpose for inventory goods receipt GL.
 * @param {boolean} grniEnabled
 * @returns {'GRNI' | 'ACCOUNTS_PAYABLE'}
 */
export function receiptCreditPurpose(grniEnabled) {
  return grniEnabled ? 'GRNI' : 'ACCOUNTS_PAYABLE';
}

/**
 * Whether a supplier bill should clear GRNI instead of debiting inventory/expense again.
 * @param {{ goodsReceiptId?: string | null, billType?: string | null, clearGrni?: boolean }} bill
 * @param {boolean} grniEnabled
 */
export function billShouldClearGrni(bill, grniEnabled) {
  if (!grniEnabled) return false;
  if (bill?.clearGrni === true) return true;
  if (bill?.goodsReceiptId) return true;
  const type = String(bill?.billType || '').toLowerCase();
  return type === 'inventory' && Boolean(bill?.goodsReceiptId);
}
