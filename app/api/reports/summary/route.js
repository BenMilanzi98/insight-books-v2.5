// app/api/reports/summary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import { generateIncomeStatementFromAccounts } from '@/lib/incomeStatementService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    // Same logic as Income Statement (system rule): revenue and COGS system-generated; operating expenses drive structure
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true }
    });
    const statement = await generateIncomeStatementFromAccounts(
      user.tenantId,
      startDate,
      endDate,
      tenant?.name || 'Company',
      null,
      user.currentBranchId || null
    );
    const totalRevenue = Number(statement?.totalRevenue ?? 0);
    const totalExpenses = Number(statement?.totalOperatingExpenses ?? 0);
    const profit = Number(statement?.operatingIncome ?? statement?.netIncome ?? totalRevenue - totalExpenses);
    
    // Count outstanding invoices - filter by branch
    const outstandingInvoices = await prisma.invoice.aggregate({
      where: addBranchFilter(user, {
        tenantId: user.tenantId,
        status: 'Pending',
        dueDate: {
          lt: new Date() // Due date has passed
        }
      }),
      _count: true,
      _sum: {
        total: true
      }
    });
    
    const recentSales = await prisma.sale.count({
      where: addBranchFilter(user, {
        tenantId: user.tenantId,
        saleDate: {
          gte: new Date(new Date().setDate(new Date().getDate() - 7))
        }
      })
    });

    const allProducts = await prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        isService: false,
        stockLevel: { not: null }
      },
      select: { stockLevel: true, reorderPoint: true }
    });
    const lowStockProducts = allProducts.filter(p => {
      const level = p.stockLevel || 0;
      const reorder = p.reorderPoint || 10;
      return level === 0 || level <= reorder;
    }).length;

    const profitMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : 0;

    return NextResponse.json({
      revenue: totalRevenue.toFixed(2),
      expenses: totalExpenses.toFixed(2),
      profit: profit.toFixed(2),
      profitMargin: profitMargin,
      outstandingInvoices: {
        count: outstandingInvoices._count,
        total: (outstandingInvoices._sum.total || 0).toFixed(2)
      },
      recentSales: recentSales,
      lowStockProducts: lowStockProducts,
      timeframe: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error generating financial summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate financial summary. Please try again.' },
      { status: 500 }
    );
  }
}
