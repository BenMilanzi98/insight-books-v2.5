// app/api/purchases/suppliers/[id]/expenses/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

async function resolveRouteParamId(rawParams) {
  const p = typeof rawParams?.then === 'function' ? await rawParams : rawParams;
  const id = p?.id;
  if (Array.isArray(id)) return id[0] ?? null;
  return id ?? null;
}

/**
 * GET /api/purchases/suppliers/[id]/expenses
 * Get expenses for a specific supplier
 */
export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supplierId = await resolveRouteParamId(params);
    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID required' }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const status = searchParams.get('status');

    // Verify supplier belongs to user's tenant
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: user.tenantId }
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Build where clause
    const whereClause = {
      tenantId: user.tenantId,
      supplierId,
      isDeleted: false
    };

    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) {
        whereClause.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.date.lte = new Date(dateTo);
      }
    }

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const totalCount = await prisma.expense.count({ where: whereClause });

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        submittedBy: {
          select: { id: true, name: true }
        },
        payments: {
          where: { status: 'Completed' },
          orderBy: { paymentDate: 'desc' },
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paymentDate: true,
            reference: true,
            status: true
          }
        }
      }
    });

    // Calculate summary statistics
    const summary = {
      totalExpenses: totalCount,
      totalAmount: expenses.reduce((sum, exp) => sum + Number(exp.amount), 0),
      fullyPaidCount: expenses.filter(exp => exp.paymentStatus === 'Fully paid').length,
      partiallyPaidCount: expenses.filter(exp => exp.paymentStatus === 'Partially').length,
      unpaidCount: expenses.filter(exp => exp.paymentStatus === 'Pending').length,
      totalPaid: expenses.reduce((sum, exp) => {
        const paidAmount = exp.payments?.reduce((pSum, p) => pSum + Number(p.amount), 0) || 0;
        return sum + paidAmount;
      }, 0),
      outstandingBalance: expenses.reduce((sum, exp) => {
        const paidAmount = exp.payments?.reduce((pSum, p) => pSum + Number(p.amount), 0) || 0;
        return sum + (Number(exp.amount) - paidAmount);
      }, 0)
    };

    // Get last payment date
    const lastPayment = await prisma.payment.findFirst({
      where: {
        expense: { supplierId },
        status: 'Completed'
      },
      orderBy: { paymentDate: 'desc' }
    });

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        supplierName: supplier.supplierName,
        supplierCode: supplier.supplierCode
      },
      expenses,
      summary: {
        ...summary,
        lastPaymentDate: lastPayment?.paymentDate || null
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching supplier expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier expenses. Please try again.' },
      { status: 500 }
    );
  }
}
