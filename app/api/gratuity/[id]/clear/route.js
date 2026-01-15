// app/api/gratuity/[id]/clear/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST - Clear gratuity account (reset all amounts to 0, keep account and rate)
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    const gratuityAccount = await prisma.gratuityAccount.findUnique({
      where: { id }
    });

    if (!gratuityAccount || gratuityAccount.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Gratuity account not found' },
        { status: 404 }
      );
    }

    // Delete all payment records first
    await prisma.gratuityPayment.deleteMany({
      where: { gratuityAccountId: id }
    });

    // Clear all amounts but keep the account and accrual rate
    const updated = await prisma.gratuityAccount.update({
      where: { id },
      data: {
        totalAccrued: 0,
        totalPaid: 0,
        outstandingAmount: 0,
        lastCalculatedAt: null
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
      gratuityAccount: updated,
      message: 'Gratuity account cleared successfully' 
    });

  } catch (error) {
    console.error('Error clearing gratuity account:', error);
    return NextResponse.json(
      { error: 'Failed to clear gratuity account', details: error.message },
      { status: 500 }
    );
  }
}

