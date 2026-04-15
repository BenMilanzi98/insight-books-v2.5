import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatTx(payment, accountId, accountName) {
  const alloc = (payment.allocations || []).find((a) => a.paymentAccountId === accountId);
  const allocAmount = alloc ? Number(alloc.amount || 0) : null;
  const parts = [];
  if (payment.invoice?.invoiceNumber) parts.push(`Invoice ${payment.invoice.invoiceNumber}`);
  if (payment.sale?.saleNumber) parts.push(`Sale ${payment.sale.saleNumber}`);
  if (payment.type === 'transfer') parts.push('Transfer');
  if (payment.expenseId) parts.push('Expense');
  return {
    id: payment.id,
    paymentDate: payment.paymentDate,
    type: payment.type || payment.paymentMethod || 'payment',
    amount: Number(payment.amount || 0),
    allocationAmount: allocAmount,
    status: payment.status,
    reference: payment.reference || '',
    notes: payment.notes || '',
    paymentMethod: payment.paymentMethod,
    sourceAccount: payment.sourceAccount,
    destinationAccount: payment.destinationAccount,
    clientName: payment.invoice?.client?.name || null,
    invoiceNumber: payment.invoice?.invoiceNumber || null,
    saleNumber: payment.sale?.saleNumber || null,
    summary: parts.length ? parts.join(' · ') : (accountName ? `Activity — ${accountName}` : 'Payment'),
  };
}

/**
 * GET — transactions that touch this payment account (method, transfer leg, or allocation).
 */
export async function GET(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: accountId } = await context.params;
    if (!accountId) {
      return NextResponse.json({ error: 'Account id required' }, { status: 400 });
    }

    const account = await prisma.paymentAccount.findFirst({
      where: { id: accountId, tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true, accountType: true },
    });

    if (!account) {
      return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
    }

    const name = account.name || '';
    const where = {
      tenantId: user.tenantId,
      isReversal: false,
      OR: [
        { paymentMethod: accountId },
        { paymentMethod: { equals: name, mode: 'insensitive' } },
        { sourceAccount: accountId },
        { destinationAccount: accountId },
        { sourceAccount: { equals: name, mode: 'insensitive' } },
        { destinationAccount: { equals: name, mode: 'insensitive' } },
        {
          allocations: {
            some: { paymentAccountId: accountId },
          },
        },
      ],
    };

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      take: 300,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            client: { select: { name: true } },
          },
        },
        sale: { select: { saleNumber: true } },
        allocations: {
          include: {
            paymentAccount: { select: { id: true, name: true } },
          },
        },
      },
    });

    const transactions = payments.map((p) => formatTx(p, accountId, name));

    return NextResponse.json({
      success: true,
      account,
      transactions,
    });
  } catch (e) {
    console.error('payment-accounts/[id]/transactions', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to load transactions' },
      { status: 500 }
    );
  }
}
