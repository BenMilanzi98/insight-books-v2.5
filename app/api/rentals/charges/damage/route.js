import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolveBranchId } from '@/lib/branchHelpers';
import { allocateNextInvNumberReliable, formatDatedDocumentNumber } from '@/lib/documentSequences';
import { postInvoiceAccounting } from '@/lib/accountingV2/adapters';
import { contextFromSessionUser } from '@/lib/accountingV2/domain/accountingContext';
import { MissingAccountMappingError } from '@/lib/accountingV2/domain/errors';
import { resolvePurposeAccount } from '@/lib/coaV2/application/accountMappingRegistry';
import {
  buildInvoiceItemCreateData,
  requireInvoiceItemAccountIdColumn,
} from '@/lib/ensureInvoiceItemAccountId';
import { formatRentalTraceNote } from '@/lib/rentalSourceTags';
import { parseMoney, roundMoney } from '@/lib/money';

function canRecordDamage(user) {
  return (
    (hasPermission(user, 'rentals.update') || hasPermission(user, 'rentals.create')) &&
    hasPermission(user, 'invoices.create')
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
    if (!canRecordDamage(user)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { transactionId, amount, description } = await request.json().catch(() => ({}));
    const total = roundMoney(parseMoney(amount));
    const label = String(description || '').trim();
    if (!transactionId || !label || total <= 0) {
      return NextResponse.json(
        { error: 'transactionId, a description, and a positive amount are required' },
        { status: 400 }
      );
    }

    const rentalTransaction = await prisma.rentalTransaction.findFirst({
      where: { id: transactionId, tenantId: user.tenantId },
      select: { id: true, clientId: true, kind: true },
    });
    if (!rentalTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const columnCheck = await requireInvoiceItemAccountIdColumn();
    if (!columnCheck.ok) return columnCheck.response;

    const [branchId, tenantSettings] = await Promise.all([
      resolveBranchId(user, undefined, user.tenantId),
      prisma.tenantSettings.findFirst({
        where: { tenantId: user.tenantId },
        select: { invoicePrefix: true },
      }),
    ]);
    let damageRecoveryAccount;
    try {
      damageRecoveryAccount = await resolvePurposeAccount(
        contextFromSessionUser(user, { branchId, sourceChannel: 'api' }),
        'OTHER_INCOME',
        { module: 'RENTALS', transactionType: 'DAMAGE', branchId },
        prisma
      );
    } catch (error) {
      if (error instanceof MissingAccountMappingError || error?.code === 'MISSING_ACCOUNT_MAPPING') {
        return NextResponse.json(
          {
            error:
              'Configure OTHER_INCOME for RENTALS/DAMAGE in CoA mappings before recording a damage charge.',
            code: 'MISSING_ACCOUNT_MAPPING',
          },
          { status: 409 }
        );
      }
      throw error;
    }
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);
    const traceNote = formatRentalTraceNote({
      event: 'DAMAGE',
      rentalTransactionId: rentalTransaction.id,
      rentalKind: rentalTransaction.kind,
    });

    const invoice = await prisma.$transaction(async (tx) => {
      const prefix = tenantSettings?.invoicePrefix || 'INV';
      const sequence = await allocateNextInvNumberReliable(tx, user.tenantId, { prefix, issueDate });
      const invoiceNumber = formatDatedDocumentNumber(prefix, issueDate, sequence);
      const item = {
        description: label,
        quantity: 1,
        unitPrice: total,
        taxRate: 0,
        discountRate: 0,
        discountAmount: 0,
        netAmount: total,
        amount: total,
        accountId: damageRecoveryAccount.id,
        productId: null,
        itemTaxes: [],
      };
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          title: 'Rental damage charge',
          orderNumber: rentalTransaction.id,
          clientId: rentalTransaction.clientId,
          createdById: user.id,
          issueDate,
          dueDate,
          discount: 0,
          subtotal: total,
          taxAmount: 0,
          totalDiscountAmount: 0,
          total,
          totalPaid: 0,
          remainingBalance: total,
          originalTotal: total,
          status: 'Pending',
          notes: traceNote,
          tenantId: user.tenantId,
          branchId,
          isRentalInvoice: true,
          items: { create: [buildInvoiceItemCreateData(item, columnCheck.hasColumn)] },
        },
      });
      await postInvoiceAccounting({
        db: tx,
        tenantId: user.tenantId,
        userId: user.id,
        invoiceId: created.id,
      });
      await tx.auditLog.create({
        data: {
          action: 'RENTAL_DAMAGE_INVOICE_CREATED',
          entityType: 'INVOICE',
          entityId: created.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({ rentalTransactionId: rentalTransaction.id, amount: total }),
        },
      });
      return created;
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('[rentals damage charge]', error);
    return NextResponse.json({ error: error?.message || 'Failed to record damage charge' }, { status: 500 });
  }
}
