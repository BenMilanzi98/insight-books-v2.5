/**
 * Finalize an inventory supplier bill:
 * - Never increases stock (stock comes only from Goods Receipts)
 * - Under GRNI: requires goodsReceiptId; posts Dr GRNI / Cr AP via V2 engine
 * - Legacy (GRNI off): may post inventory/AP for direct bills without receipt (no stock)
 */

import { isPurchasesGrniEnabled, ensureGrniAccountExists, billShouldClearGrni } from '@/lib/purchases/grniPolicy';
import { isFlagEnabled, PURCHASES_FLAGS } from '@/lib/accountingV2/infrastructure/featureFlags';
import { matchSupplierBill } from '@/lib/purchases/threeWayMatching';

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {object} bill SupplierBill with items
 * @param {string} tenantId
 * @param {string} userId
 * @param {{ allowVarianceApproval?: boolean }} [opts]
 */
export async function finalizeInventoryBill(tx, bill, tenantId, userId, opts = {}) {
  const full = await tx.supplierBill.findFirst({
    where: { id: bill.id, tenantId },
    include: { items: true },
  });
  if (!full) throw new Error('Supplier bill not found');

  if (full.journalEntryId) {
    return { skipped: true, reason: 'already_posted', journalEntryId: full.journalEntryId };
  }

  const grniEnabled = await isPurchasesGrniEnabled(tx, tenantId);
  const matchingEnabled = await isFlagEnabled(tx, PURCHASES_FLAGS.MATCHING_V2, {
    tenantId,
    moduleKey: 'PURCHASES',
  });

  if (grniEnabled && !full.goodsReceiptId) {
    const err = new Error(
      'Inventory bills require a Goods Receipt when GRNI posting is enabled. Receive goods first, then bill against the receipt.'
    );
    err.code = 'RECEIPT_REQUIRED';
    throw err;
  }

  if (matchingEnabled && full.goodsReceiptId) {
    const match = await matchSupplierBill(tx, {
      tenantId,
      billId: full.id,
      requireReceiptForInventory: grniEnabled,
    });
    await tx.supplierBill.update({
      where: { id: full.id },
      data: { matchingStatus: match.matchingStatus },
    }).catch(() => {
      /* matchingStatus column may not exist until migration */
    });

    if (match.blocked && !opts.allowVarianceApproval) {
      const err = new Error(
        `Three-way match blocked (${match.matchingStatus}): ${match.issues.map((i) => i.message).join('; ')}`
      );
      err.code = 'MATCH_BLOCKED';
      err.match = match;
      throw err;
    }
  }

  if (grniEnabled) {
    await ensureGrniAccountExists(tx, tenantId);
  }

  // Posting engine rejects Draft — promote when explicitly finalizing
  if (String(full.status).toLowerCase() === 'draft') {
    await tx.supplierBill.update({
      where: { id: full.id },
      data: { status: 'Unpaid' },
    });
    full.status = 'Unpaid';
  }

  // Canonical bill posting (GRNI clear when receipt-linked + flag on)
  const { postSupplierBillAccounting } = await import(
    '@/lib/accountingV2/adapters/supplierBillAdapter.js'
  );
  const outcome = await postSupplierBillAccounting({
    db: tx,
    tenantId,
    userId,
    billId: full.id,
    currency: full.currency || 'MWK',
  });

  const journalId = outcome.result?.journalEntryId || null;
  if (journalId) {
    await tx.supplierBill.update({
      where: { id: full.id },
      data: {
        journalEntryId: journalId,
        finalizedAt: full.finalizedAt || new Date(),
        finalizedById: full.finalizedById || userId,
        postingStatus: 'POSTED',
      },
    }).catch(async () => {
      await tx.supplierBill.update({
        where: { id: full.id },
        data: {
          journalEntryId: journalId,
          finalizedAt: full.finalizedAt || new Date(),
          finalizedById: full.finalizedById || userId,
        },
      });
    });
  }

  // Supplier subledger denormalised balance when AP is recognised by the bill journal
  if (journalId) {
    await tx.supplier.update({
      where: { id: full.supplierId },
      data: {
        currentBalance: {
          increment: Number(full.totalAmount || 0),
        },
      },
    });
  }

  return {
    skipped: false,
    journalEntryId: journalId,
    stockIncreased: false,
    grniCleared: billShouldClearGrni(full, grniEnabled),
  };
}
