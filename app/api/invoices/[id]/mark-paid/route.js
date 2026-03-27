import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { POST as postPartialPayment } from '../../partial-payment/route.js';

/**
 * POST /api/invoices/:id/mark-paid
 * Records a payment for the full remaining balance (same effect as partial-payment with amount = balance).
 */
export async function POST(request, { params }) {
  try {
    const { id: invoiceId } = await params;
    const body = await request.json().catch(() => ({}));
    const paymentMethod = body.paymentMethod || 'cash';

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: user.tenantId },
      include: {
        payments: {
          where: { status: 'Completed' },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = invoice.total - totalPaid;
    if (remainingBalance <= 0) {
      return NextResponse.json(
        { error: 'Invoice is already fully paid' },
        { status: 400 }
      );
    }

    const inner = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        invoiceId,
        amount: remainingBalance,
        paymentMethod,
      }),
    });

    return postPartialPayment(inner);
  } catch (error) {
    console.error('mark-paid error:', error);
    return NextResponse.json(
      { error: 'Failed to mark invoice as paid' },
      { status: 500 }
    );
  }
}
