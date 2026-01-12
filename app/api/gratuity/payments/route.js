// app/api/gratuity/payments/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST - Record a gratuity payment
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { gratuityAccountId, amount, paymentDate, reference, notes } = body;

    if (!gratuityAccountId || !amount || !paymentDate) {
      return NextResponse.json(
        { error: 'Gratuity account ID, amount, and payment date are required' },
        { status: 400 }
      );
    }

    // Verify gratuity account belongs to tenant
    const gratuityAccount = await prisma.gratuityAccount.findUnique({
      where: { id: gratuityAccountId }
    });

    if (!gratuityAccount || gratuityAccount.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Gratuity account not found' },
        { status: 404 }
      );
    }

    // Create payment
    const payment = await prisma.gratuityPayment.create({
      data: {
        gratuityAccountId,
        amount: Number(amount),
        paymentDate: new Date(paymentDate),
        reference: reference || null,
        notes: notes || null
      }
    });

    // Update gratuity account totals
    const totalPaid = gratuityAccount.totalPaid + Number(amount);
    const outstandingAmount = Math.max(0, gratuityAccount.totalAccrued - totalPaid);

    const updatedAccount = await prisma.gratuityAccount.update({
      where: { id: gratuityAccountId },
      data: {
        totalPaid: totalPaid,
        outstandingAmount: outstandingAmount
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true
          }
        }
      }
    });

    return NextResponse.json({
      payment,
      gratuityAccount: updatedAccount
    });

  } catch (error) {
    console.error('Error recording gratuity payment:', error);
    return NextResponse.json(
      { error: 'Failed to record gratuity payment', details: error.message },
      { status: 500 }
    );
  }
}

