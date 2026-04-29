import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

function getExpenseReferenceForJournal(sourceType, sourceId) {
  if (!sourceId) return null;
  if (sourceType === 'InventoryExpiryWriteOff') return `inventory-writeoff:${sourceId}`;
  if (sourceType === 'InventoryManualStockOut') return `inventory-stockout:${sourceId}`;
  return null;
}

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const journals = await prisma.journalEntry.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'Posted',
        sourceType: { in: ['InventoryExpiryWriteOff', 'InventoryManualStockOut'] },
        sourceId: { not: null },
      },
      include: {
        lines: {
          select: {
            accountId: true,
            debitAmount: true,
            creditAmount: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const existing = await prisma.expense.findMany({
      where: {
        tenantId: user.tenantId,
        isDeleted: false,
        OR: [
          { originalReference: { startsWith: 'inventory-writeoff:' } },
          { originalReference: { startsWith: 'inventory-stockout:' } },
        ],
      },
      select: { originalReference: true },
    });
    const existingRefs = new Set(existing.map((e) => e.originalReference).filter(Boolean));

    const toCreate = [];
    for (const journal of journals) {
      const expenseRef = getExpenseReferenceForJournal(journal.sourceType, journal.sourceId);
      if (!expenseRef || existingRefs.has(expenseRef)) continue;

      const debitLine = (journal.lines || []).find((l) => Number(l.debitAmount || 0) > 0);
      const amount = (journal.lines || []).reduce((sum, l) => sum + Number(l.debitAmount || 0), 0);
      if (!(amount > 0)) continue;

      toCreate.push({
        tenantId: user.tenantId,
        submittedById: journal.createdById || user.id,
        branchId: journal.branchId || null,
        description: journal.description || 'Inventory Adjustment Loss',
        amount,
        date: journal.entryDate || journal.postedDate || journal.createdAt || new Date(),
        category: 'Inventory Adjustment Loss',
        expenseAccountId: debitLine?.accountId || null,
        status: 'Approved',
        paymentStatus: 'Fully paid',
        paymentMethod: 'journal',
        paidAmount: amount,
        originalReference: expenseRef,
        notes: `Backfilled from journal ${journal.referenceNumber || journal.id}`,
      });
      existingRefs.add(expenseRef);
    }

    let created = 0;
    if (toCreate.length > 0) {
      const result = await prisma.expense.createMany({ data: toCreate });
      created = result.count || 0;
    }

    return NextResponse.json({
      message: 'Inventory loss expenses backfill completed',
      scannedJournals: journals.length,
      createdExpenses: created,
      skippedExisting: Math.max(0, journals.length - toCreate.length),
    });
  } catch (error) {
    console.error('[expenses/backfill/inventory-losses]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to backfill inventory loss expenses' },
      { status: 500 }
    );
  }
}

