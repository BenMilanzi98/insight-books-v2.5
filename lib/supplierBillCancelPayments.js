import { createTransactionReversal } from '@/lib/transactionReversalService';
import { createSupplierPaymentSliceReversalEntry } from '@/lib/purchaseAccounting';
import { updateAccountBalance } from '@/lib/core';

function normalizePaymentMethod(method) {
  if (!method) return 'cash';
  return method.toString().trim().toLowerCase().replace(/\s+/g, '_') || 'cash';
}

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

async function resolveSupplierPaymentTransactionId(tx, payment, tenantId) {
  if (!payment.journalEntryId) return null;
  const direct = await tx.transaction.findFirst({
    where: { id: payment.journalEntryId, tenantId },
    select: { id: true }
  });
  if (direct) return direct.id;
  const je = await tx.journalEntry.findFirst({
    where: { id: payment.journalEntryId, tenantId },
    select: { transactionId: true }
  });
  return je?.transactionId || null;
}

/**
 * Unwinds supplier payments linked to a bill before the bill is cancelled.
 * - Single-bill payment: full GL reversal via createTransactionReversal.
 * - Multi-bill payment: slice journal (DR cash / CR AP) for this bill's allocation only + tax reversals matching the bill.
 *
 * Always creates a negative SupplierPayment + allocation row and updates supplier + payment-method balances.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @returns {Promise<Array<{ paymentNumber?: string, mode: string, amount: number }>>}
 */
export async function reverseBillLinkedPaymentsInTx(tx, {
  bill,
  tenantId,
  userId,
  reversalReason
}) {
  const summary = [];
  if (Number(bill.amountPaid || 0) <= 0) return summary;

  const allocations = await tx.supplierPaymentAllocation.findMany({
    where: {
      tenantId,
      billId: bill.id,
      amount: { gt: 0 }
    },
    include: {
      payment: {
        select: {
          id: true,
          supplierId: true,
          paymentNumber: true,
          paymentMethod: true,
          totalAmount: true,
          journalEntryId: true,
          currency: true
        }
      }
    }
  });

  if (!allocations.length) {
    throw new Error(
      'This bill shows as paid but has no payment allocations. Please contact support or fix payment allocations.'
    );
  }

  const supplierLabel = bill.supplier?.supplierName || 'Supplier';
  const billRef = bill.billNumber || bill.id;

  const byPayment = new Map();
  for (const a of allocations) {
    if (!byPayment.has(a.paymentId)) byPayment.set(a.paymentId, []);
    byPayment.get(a.paymentId).push(a);
  }

  for (const [, allocList] of byPayment) {
    const payment = allocList[0].payment;
    const amountToReverse = roundMoney(
      allocList.reduce((s, x) => s + Number(x.amount || 0), 0)
    );
    if (amountToReverse <= 0) continue;

    const allPositive = await tx.supplierPaymentAllocation.findMany({
      where: { tenantId, paymentId: payment.id, amount: { gt: 0 } },
      select: { billId: true, amount: true }
    });
    const onlyThisBill =
      allPositive.length > 0 && allPositive.every((row) => row.billId === bill.id);

    const paymentTxnId = await resolveSupplierPaymentTransactionId(tx, payment, tenantId);

    if (paymentTxnId && onlyThisBill) {
      const alreadyReversed = await tx.transaction.findFirst({
        where: {
          tenantId,
          isReversal: true,
          reversedTransactionId: paymentTxnId
        },
        select: { id: true }
      });
      if (!alreadyReversed) {
        await createTransactionReversal({
          transactionId: paymentTxnId,
          reversalReason: `Supplier payment reversal for bill ${billRef}: ${reversalReason}`,
          userId,
          tenantId
        });
      }
      const taxTxs = await tx.transaction.findMany({
        where: {
          tenantId,
          sourceType: 'Tax-SupplierPayment',
          sourceId: payment.id,
          status: 'posted',
          isReversal: false
        },
        select: { id: true }
      });
      for (const t of taxTxs) {
        const alreadyRev = await tx.transaction.findFirst({
          where: {
            tenantId,
            isReversal: true,
            reversedTransactionId: t.id
          },
          select: { id: true }
        });
        if (!alreadyRev) {
          await createTransactionReversal({
            transactionId: t.id,
            reversalReason: `Tax reversal for supplier payment ${payment.paymentNumber || payment.id}: ${reversalReason}`,
            userId,
            tenantId
          });
        }
      }
      summary.push({
        paymentNumber: payment.paymentNumber,
        mode: 'full_payment_gl',
        amount: amountToReverse
      });
    } else if (paymentTxnId && !onlyThisBill) {
      await createSupplierPaymentSliceReversalEntry({
        tenantId,
        userId,
        amount: amountToReverse,
        paymentMethod: payment.paymentMethod,
        supplierName: `${supplierLabel} — ${billRef} (partial of ${payment.paymentNumber || payment.id})`,
        reference: payment.paymentNumber || String(payment.id),
        sourceBillId: bill.id,
        reversalReason,
        tx
      });

      const billNum = bill.billNumber || '';
      let taxTxs = [];
      if (billNum) {
        taxTxs = await tx.transaction.findMany({
          where: {
            tenantId,
            sourceType: 'Tax-SupplierPayment',
            sourceId: payment.id,
            status: 'posted',
            isReversal: false,
            description: { contains: billNum, mode: 'insensitive' }
          },
          select: { id: true }
        });
      } else {
        console.warn(
          `[Bill cancel] Skipping input-tax reversal for payment ${payment.id}: bill ${bill.id} has no billNumber (multi-bill payment). Review tax GL manually.`
        );
      }
      for (const t of taxTxs) {
        const alreadyRev = await tx.transaction.findFirst({
          where: {
            tenantId,
            isReversal: true,
            reversedTransactionId: t.id
          },
          select: { id: true }
        });
        if (!alreadyRev) {
          await createTransactionReversal({
            transactionId: t.id,
            reversalReason: `Tax reversal (bill ${billRef}) for payment ${payment.paymentNumber || payment.id}: ${reversalReason}`,
            userId,
            tenantId
          });
        }
      }
      summary.push({
        paymentNumber: payment.paymentNumber,
        mode: 'payment_slice_gl',
        amount: amountToReverse
      });
    } else {
      summary.push({
        paymentNumber: payment.paymentNumber,
        mode: 'subledger_only',
        amount: amountToReverse
      });
    }

    await tx.supplierPayment.create({
      data: {
        tenantId,
        supplierId: payment.supplierId,
        paymentNumber: `SP-REV-${Date.now()}-${String(payment.id).slice(-6)}`,
        paymentDate: new Date(),
        paymentMethod: payment.paymentMethod,
        bankAccountId: null,
        referenceNumber: `REV-${payment.paymentNumber || payment.id}`,
        totalAmount: -amountToReverse,
        currency: payment.currency || 'MWK',
        notes: `REVERSAL (bill cancel): ${billRef} — ${reversalReason}`,
        createdById: userId,
        isReversal: true,
        reversedTransactionId: payment.id,
        reversalReason,
        reversedAt: new Date(),
        reversedById: userId,
        allocations: {
          create: [
            {
              tenantId,
              billId: bill.id,
              amount: -amountToReverse
            }
          ]
        }
      }
    });

    await tx.supplier.update({
      where: { id: payment.supplierId },
      data: {
        currentBalance: {
          increment: amountToReverse
        }
      }
    });

    try {
      const normalized = normalizePaymentMethod(payment.paymentMethod);
      await updateAccountBalance(tenantId, normalized, amountToReverse, 'add', tx);
    } catch (balErr) {
      console.warn('Bill cancel: failed to update account balance for payment reversal', balErr?.message || balErr);
    }

    const currentBill = await tx.supplierBill.findFirst({
      where: { id: bill.id, tenantId },
      select: { id: true, amountPaid: true, totalAmount: true, status: true }
    });
    if (currentBill) {
      const newAmountPaid = Math.max(0, Number(currentBill.amountPaid || 0) - amountToReverse);
      const total = Number(currentBill.totalAmount || 0);
      const newStatus =
        newAmountPaid <= 0 ? 'Unpaid' : newAmountPaid >= total ? 'Paid' : 'Partially Paid';
      await tx.supplierBill.update({
        where: { id: currentBill.id },
        data: { amountPaid: newAmountPaid, status: newStatus }
      });
    }
  }

  return summary;
}
