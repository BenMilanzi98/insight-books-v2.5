import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolveBranchId } from '@/lib/branchHelpers';
import { formatRentalTraceNote } from '@/lib/rentalSourceTags';
import { parseMoney, roundMoney } from '@/lib/money';
import { contextFromSessionUser } from '@/lib/accountingV2/domain/accountingContext';
import { MissingAccountMappingError } from '@/lib/accountingV2/domain/errors';
import { resolvePurposeAccount } from '@/lib/coaV2/application/accountMappingRegistry';

function canRecordRepair(user) {
  return (
    (hasPermission(user, 'rentals.update') || hasPermission(user, 'rentals.create')) &&
    hasPermission(user, 'expenses.create')
  );
}

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!canRecordRepair(user)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { transactionId, rentalAssetId, amount, description } = await request.json().catch(() => ({}));
    const total = roundMoney(parseMoney(amount));
    const label = String(description || '').trim();
    if (!rentalAssetId || !label || total <= 0) {
      return NextResponse.json(
        { error: 'rentalAssetId, a description, and a positive amount are required' },
        { status: 400 }
      );
    }

    const [asset, rentalTransaction, branchId] = await Promise.all([
      prisma.rentalAsset.findFirst({
        where: { id: rentalAssetId, tenantId: user.tenantId },
        select: { id: true },
      }),
      transactionId
        ? prisma.rentalTransaction.findFirst({
            where: { id: transactionId, tenantId: user.tenantId },
            select: { id: true, kind: true },
          })
        : null,
      resolveBranchId(user, undefined, user.tenantId),
    ]);
    if (!asset) {
      return NextResponse.json({ error: 'Rental asset not found' }, { status: 404 });
    }
    if (transactionId && !rentalTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    let repairAccount;
    try {
      repairAccount = await resolvePurposeAccount(
        contextFromSessionUser(user, { branchId, sourceChannel: 'api' }),
        'REPAIRS_AND_MAINTENANCE',
        { module: 'RENTALS', transactionType: 'REPAIR', branchId },
        prisma
      );
    } catch (error) {
      if (!(error instanceof MissingAccountMappingError || error?.code === 'MISSING_ACCOUNT_MAPPING')) {
        throw error;
      }
      repairAccount = await prisma.account.findFirst({
        where: {
          tenantId: user.tenantId,
          isActive: true,
          acceptsNewTransactions: true,
          OR: [
            { accountName: { startsWith: 'Repair', mode: 'insensitive' } },
            { name: { startsWith: 'Repair', mode: 'insensitive' } },
          ],
        },
        select: { id: true, accountName: true, name: true },
      });
      if (!repairAccount) {
        return NextResponse.json(
          {
            error:
              'Repair expense account is not configured. Configure REPAIRS_AND_MAINTENANCE for RENTALS/REPAIR in CoA mappings before recording a repair.',
            code: 'MISSING_ACCOUNT_MAPPING',
          },
          { status: 409 }
        );
      }
    }

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          description: label,
          amount: total,
          taxAmount: 0,
          taxRate: 0,
          date: new Date(),
          category: repairAccount.accountName || repairAccount.name || 'Repairs & Maintenance',
          expenseAccountId: repairAccount.id,
          paymentMethod: 'cash',
          status: 'Draft',
          paymentStatus: 'Pending',
          notes: formatRentalTraceNote({
            event: 'REPAIR',
            rentalTransactionId: rentalTransaction?.id,
            rentalAssetId: asset.id,
            rentalKind: rentalTransaction?.kind,
          }),
          submittedById: user.id,
          tenantId: user.tenantId,
          branchId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'RENTAL_REPAIR_EXPENSE_CREATED',
          entityType: 'EXPENSE',
          entityId: created.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            rentalTransactionId: rentalTransaction?.id || null,
            rentalAssetId: asset.id,
            amount: total,
          }),
        },
      });
      return created;
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error('[rentals repair charge]', error);
    return NextResponse.json({ error: error?.message || 'Failed to record repair expense' }, { status: 500 });
  }
}
