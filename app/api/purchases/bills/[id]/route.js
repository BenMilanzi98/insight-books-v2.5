// app/api/purchases/bills/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { updateAccountBalance } from '@/lib/core';
import { createTransactionReversal, validateReversalReason } from '@/lib/transactionReversalService';

const BILL_STATUSES = ['Draft', 'Approved', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];

function normalizePaymentMethod(method) {
  if (!method) return 'cash';
  return method.toString().trim().toLowerCase().replace(/\s+/g, '_') || 'cash';
}

async function findBill(id, tenantId) {
  const bill = await prisma.supplierBill.findFirst({
    where: { id, tenantId },
    include: {
      supplier: { select: { supplierName: true, supplierCode: true } },
      allocations: {
        include: {
          payment: { select: { paymentNumber: true, paymentDate: true } }
        }
      }
    }
  });

  if (!bill) return null;

  // Fetch items separately
  const items = await prisma.supplierBillItem.findMany({
    where: { billId: bill.id },
        include: {
          product: { select: { id: true, name: true, sku: true } }
        },
    orderBy: { lineNumber: 'asc' }
  });

  return {
    ...bill,
    items
  };
}

export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const bill = await findBill(params.id, user.tenantId);
    if (!bill) return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });

    return NextResponse.json({ bill });
  } catch (error) {
    console.error('Error fetching supplier bill:', error);
    return NextResponse.json({ error: 'Failed to fetch supplier bill.' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const bill = await findBill(params.id, user.tenantId);
    if (!bill) return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });

    const body = await request.json();
    const data = {
      billDate: body.billDate ? new Date(body.billDate) : bill.billDate,
      dueDate: body.dueDate ? new Date(body.dueDate) : bill.dueDate,
      notes: body.notes ?? bill.notes,
      paymentTerms: body.paymentTerms ?? bill.paymentTerms,
      currency: body.currency ?? bill.currency
    };

    if (body.taxAmount !== undefined) data.taxAmount = body.taxAmount;
    if (body.subtotal !== undefined) data.subtotal = body.subtotal;
    if (body.totalAmount !== undefined) {
      data.totalAmount = body.totalAmount;
      if (body.totalAmount < bill.amountPaid) {
        return NextResponse.json(
          { error: 'Total amount cannot be less than amount already paid.' },
          { status: 400 }
        );
      }
    }
    if (body.status && BILL_STATUSES.includes(body.status)) {
      data.status = body.status;
    }

    const updated = await prisma.supplierBill.update({
      where: { id: bill.id },
      data,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        allocations: {
          include: {
            payment: { select: { paymentNumber: true, paymentDate: true } }
          }
        }
      }
    });

    // Fetch items separately
    const items = await prisma.supplierBillItem.findMany({
      where: { billId: updated.id },
        include: {
          product: { select: { id: true, name: true, sku: true } }
        },
      orderBy: { lineNumber: 'asc' }
    });

    return NextResponse.json({ 
      bill: {
        ...updated,
        items
      }
    });
  } catch (error) {
    console.error('Error updating supplier bill:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update supplier bill.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const bill = await findBill(params.id, user.tenantId);
    if (!bill) return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const reasonValidation = validateReversalReason(body.reversalReason || body.reason || '');
    if (!reasonValidation.isValid) {
      return NextResponse.json(
        {
          error: reasonValidation.error,
          hint: 'Provide reversalReason (or reason) with at least 10 characters. Bills are cancelled, not hard-deleted, for audit.'
        },
        { status: 400 }
      );
    }
    const reversalReason = reasonValidation.reason;

    if (bill.status === 'Cancelled') {
      return NextResponse.json({ error: 'This bill is already cancelled.' }, { status: 400 });
    }

    // If payments were applied, auto-reverse them (when safe) so paid bills can be cancelled.
    // Safety rule: we only auto-reverse supplier payments that are allocated exclusively to THIS bill.
    if (Number(bill.amountPaid || 0) > 0) {
      await prisma.$transaction(async (tx) => {
        const allocations = await tx.supplierPaymentAllocation.findMany({
          where: {
            tenantId: user.tenantId,
            billId: bill.id,
            amount: { gt: 0 },
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
                currency: true,
              },
            },
          },
        });

        if (!allocations.length) {
          // amountPaid > 0 but no allocations found; don't guess.
          throw new Error(
            'This bill shows as paid but has no payment allocations. Please contact support or reverse the payment manually.'
          );
        }

        const paymentIds = Array.from(new Set(allocations.map((a) => a.paymentId)));
        for (const paymentId of paymentIds) {
          const paymentAllocCount = await tx.supplierPaymentAllocation.count({
            where: {
              tenantId: user.tenantId,
              paymentId,
              amount: { gt: 0 },
            },
          });

          if (paymentAllocCount > 1) {
            const p = allocations.find((a) => a.paymentId === paymentId)?.payment;
            throw new Error(
              `Cannot auto-cancel this paid bill because payment ${p?.paymentNumber || paymentId} was allocated across multiple bills. Reverse/unallocate that payment first, then cancel the bill.`
            );
          }

          const alloc = allocations.find((a) => a.paymentId === paymentId);
          const payment = alloc?.payment;
          const amountToReverse = Number(alloc?.amount || 0);
          if (!payment || amountToReverse <= 0) continue;

          // Reverse payment journal entry (cash/bank + AP) if posted.
          if (payment.journalEntryId) {
            const linkedPaymentTx = await tx.transaction.findFirst({
              where: { id: payment.journalEntryId, tenantId: user.tenantId },
              select: { id: true },
            });
            if (linkedPaymentTx) {
              const alreadyReversed = await tx.transaction.findFirst({
                where: {
                  tenantId: user.tenantId,
                  isReversal: true,
                  reversedTransactionId: linkedPaymentTx.id,
                },
                select: { id: true },
              });
              if (!alreadyReversed) {
                await createTransactionReversal({
                  transactionId: linkedPaymentTx.id,
                  reversalReason: `Supplier payment reversal for bill ${bill.billNumber || bill.id}: ${reversalReason}`,
                  userId: user.id,
                  tenantId: user.tenantId,
                });
              }
            }
          }

          // Reverse any tax-only transactions created at supplier payment time.
          const taxTxs = await tx.transaction.findMany({
            where: {
              tenantId: user.tenantId,
              sourceType: 'Tax-SupplierPayment',
              sourceId: payment.id,
              status: 'posted',
              isReversal: false,
            },
            select: { id: true },
          });
          for (const t of taxTxs) {
            const alreadyReversedTax = await tx.transaction.findFirst({
              where: {
                tenantId: user.tenantId,
                isReversal: true,
                reversedTransactionId: t.id,
              },
              select: { id: true },
            });
            if (!alreadyReversedTax) {
              await createTransactionReversal({
                transactionId: t.id,
                reversalReason: `Tax reversal for supplier payment ${payment.paymentNumber || payment.id}: ${reversalReason}`,
                userId: user.id,
                tenantId: user.tenantId,
              });
            }
          }

          // Create a reversal SupplierPayment row + opposite allocation for audit trail.
          await tx.supplierPayment.create({
            data: {
              tenantId: user.tenantId,
              supplierId: payment.supplierId,
              paymentNumber: `SP-REV-${Date.now()}-${String(payment.id).slice(-6)}`,
              paymentDate: new Date(),
              paymentMethod: payment.paymentMethod,
              bankAccountId: null,
              referenceNumber: `REV-${payment.paymentNumber || payment.id}`,
              totalAmount: -amountToReverse,
              currency: payment.currency || 'MWK',
              notes: `REVERSAL (bill cancel): ${bill.billNumber || bill.id} - ${reversalReason}`,
              createdById: user.id,
              isReversal: true,
              reversedTransactionId: payment.id,
              reversalReason,
              reversedAt: new Date(),
              reversedById: user.id,
              allocations: {
                create: [{
                  tenantId: user.tenantId,
                  billId: bill.id,
                  amount: -amountToReverse,
                }],
              },
            },
          });

          // Undo supplier balance effect of payment (payment reduced AP balance).
          await tx.supplier.update({
            where: { id: payment.supplierId },
            data: {
              currentBalance: {
                increment: amountToReverse,
              },
            },
          });

          // Undo the "account balance" shortcut used by the payments endpoint.
          try {
            const normalized = normalizePaymentMethod(payment.paymentMethod);
            await updateAccountBalance(user.tenantId, normalized, amountToReverse, 'add', tx);
          } catch (balErr) {
            console.warn('Bill cancel: failed to update account balance for payment reversal', balErr?.message || balErr);
          }

          // Reduce bill amountPaid back down.
          const currentBill = await tx.supplierBill.findFirst({
            where: { id: bill.id, tenantId: user.tenantId },
            select: { id: true, amountPaid: true, totalAmount: true, status: true },
          });
          if (currentBill) {
            const newAmountPaid = Math.max(0, Number(currentBill.amountPaid || 0) - amountToReverse);
            const total = Number(currentBill.totalAmount || 0);
            const newStatus =
              newAmountPaid <= 0 ? 'Unpaid' : newAmountPaid >= total ? 'Paid' : 'Partially Paid';
            await tx.supplierBill.update({
              where: { id: currentBill.id },
              data: { amountPaid: newAmountPaid, status: newStatus },
            });
          }
        }
      });

      // Re-fetch the bill after payment reversals so the rest of the flow sees the updated amounts/status.
      const refreshed = await findBill(params.id, user.tenantId);
      if (!refreshed) return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });
      // eslint-disable-next-line no-param-reassign
      bill.amountPaid = refreshed.amountPaid;
      // eslint-disable-next-line no-param-reassign
      bill.status = refreshed.status;
    }

    // Inventory safety checks: only reverse stock if FIFO batches from this bill
    // exist AND none of them have been consumed (qtyRemaining < qtyPurchased).
    // If already consumed, fully reversing requires cascading reversals of downstream sales/COGS.
    let fifoBatches = [];
    let inventoryBlockedReason = null;
    if (bill.billType === 'inventory' && !bill.goodsReceiptId) {
      fifoBatches = await prisma.inventoryBatch.findMany({
        where: {
          tenantId: user.tenantId,
          sourceType: 'SupplierBill',
          sourceId: bill.id
        },
        select: {
          id: true,
          productId: true,
          qtyPurchased: true,
          qtyRemaining: true
        }
      });

      const anyConsumed = (fifoBatches || []).some(
        (b) => Number(b.qtyRemaining || 0) < Number(b.qtyPurchased || 0)
      );

      if (anyConsumed) {
        inventoryBlockedReason =
          'Cannot cancel this inventory bill because its FIFO stock batches were already consumed (COGS generated). Reverse inventory/COGS and related sales first.';
      }
    }

    if (inventoryBlockedReason) {
      return NextResponse.json({ error: inventoryBlockedReason }, { status: 400 });
    }

    if (bill.journalEntryId) {
      // bill.journalEntryId may point to a Transaction or a JournalEntry depending on
      // which code path created the bill. Try Transaction first (current creation path),
      // then fall back to JournalEntry-based reversal, then skip if neither found.
      const linkedTransaction = await prisma.transaction.findFirst({
        where: { id: bill.journalEntryId, tenantId: user.tenantId },
        select: { id: true }
      });

      if (linkedTransaction) {
        const alreadyReversed = await prisma.transaction.findFirst({
          where: {
            tenantId: user.tenantId,
            isReversal: true,
            reversedTransactionId: linkedTransaction.id
          },
          select: { id: true }
        });
        if (!alreadyReversed) {
          await createTransactionReversal({
            transactionId: linkedTransaction.id,
            reversalReason: `${reversalReason} (Bill ${bill.billNumber || bill.id})`,
            userId: user.id,
            tenantId: user.tenantId
          });
        }
      } else {
        // journalEntryId might reference a JournalEntry record instead of a Transaction.
        // Look up the JournalEntry and reverse via its linked transactionId if available.
        const journalEntry = await prisma.journalEntry.findFirst({
          where: { id: bill.journalEntryId, tenantId: user.tenantId },
          select: { id: true, transactionId: true }
        });

        if (journalEntry?.transactionId) {
          const alreadyReversed = await prisma.transaction.findFirst({
            where: {
              tenantId: user.tenantId,
              isReversal: true,
              reversedTransactionId: journalEntry.transactionId
            },
            select: { id: true }
          });
          if (!alreadyReversed) {
            await createTransactionReversal({
              transactionId: journalEntry.transactionId,
              reversalReason: `${reversalReason} (Bill ${bill.billNumber || bill.id})`,
              userId: user.id,
              tenantId: user.tenantId
            });
          }
        } else {
          console.warn(
            `[Bill Reversal] No Transaction found for bill ${bill.id} journalEntryId=${bill.journalEntryId}. ` +
            `Proceeding with cancellation without accounting reversal.`
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (bill.supplierId) {
        await tx.supplier.update({
          where: { id: bill.supplierId },
          data: {
            currentBalance: {
              decrement: Number(bill.totalAmount || 0)
            }
          }
        });
      }

      // Reverse inventory stock effects only when safe/unconsumed.
      if (fifoBatches.length > 0) {
        const affectedProductIds = Array.from(new Set(fifoBatches.map((b) => b.productId)));
        const batchIds = fifoBatches.map((b) => b.id);

        // Remove stock batches introduced by this bill.
        await tx.inventoryBatchConsumption.deleteMany({
          where: { tenantId: user.tenantId, batchId: { in: batchIds } }
        });
        await tx.inventoryBatch.deleteMany({ where: { id: { in: batchIds } } });
        await tx.inventoryTransaction.deleteMany({
          where: {
            tenantId: user.tenantId,
            type: 'purchase',
            notes: { contains: `Purchase Bill ${bill.billNumber}`, mode: 'insensitive' }
          }
        });

        // Recompute stockLevel and stock valuation from remaining batches.
        for (const productId of affectedProductIds) {
          const remaining = await tx.inventoryBatch.findMany({
            where: { tenantId: user.tenantId, productId },
            select: { qtyRemaining: true, unitCost: true }
          });
          const newQty = remaining.reduce(
            (sum, b) => sum + Number(b.qtyRemaining || 0),
            0
          );
          const newValue = remaining.reduce(
            (sum, b) => sum + Number(b.qtyRemaining || 0) * Number(b.unitCost || 0),
            0
          );

          await tx.product.update({
            where: { id: productId },
            data: {
              stockLevel: newQty,
              totalStockValue: newValue
            }
          });
        }
      }

      await tx.supplierBill.update({
        where: { id: bill.id },
        data: {
          status: 'Cancelled',
          notes: [bill.notes, `CANCELLED (reversal): ${reversalReason}`].filter(Boolean).join('\n')
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'SUPPLIER_BILL_CANCELLED_WITH_REVERSAL',
          entityType: 'SUPPLIER_BILL',
          entityId: bill.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            billNumber: bill.billNumber,
            supplierId: bill.supplierId,
            totalAmount: bill.totalAmount,
            hadJournal: Boolean(bill.journalEntryId),
            reversedInventoryBatches: fifoBatches.length > 0,
            reversalReason
          })
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Supplier bill cancelled; accounting reversed where a journal was posted.',
      billId: bill.id,
      status: 'Cancelled'
    });
  } catch (error) {
    console.error('Error cancelling supplier bill:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel supplier bill.' },
      { status: 500 }
    );
  }
}

