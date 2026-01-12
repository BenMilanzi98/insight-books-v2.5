// app/api/gratuity/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Get specific gratuity account
 */
export async function GET(request, { params }) {
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
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            grossSalary: true,
            salary: true,
            startDate: true
          }
        },
        payments: {
          orderBy: {
            paymentDate: 'desc'
          }
        }
      }
    });

    if (!gratuityAccount || gratuityAccount.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Gratuity account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ gratuityAccount });

  } catch (error) {
    console.error('Error fetching gratuity account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gratuity account', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update gratuity account
 */
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();

    const gratuityAccount = await prisma.gratuityAccount.findUnique({
      where: { id }
    });

    if (!gratuityAccount || gratuityAccount.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Gratuity account not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.gratuityAccount.update({
      where: { id },
      data: {
        accrualRate: body.accrualRate !== undefined ? body.accrualRate : gratuityAccount.accrualRate,
        notes: body.notes !== undefined ? body.notes : gratuityAccount.notes
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

    return NextResponse.json({ gratuityAccount: updated });

  } catch (error) {
    console.error('Error updating gratuity account:', error);
    return NextResponse.json(
      { error: 'Failed to update gratuity account', details: error.message },
      { status: 500 }
    );
  }
}

