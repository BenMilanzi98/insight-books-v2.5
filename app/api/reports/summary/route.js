// app/api/reports/summary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import { generateIncomeStatementFromAccounts } from '@/lib/incomeStatementService';
import { addMoney, parseMoney } from '@/lib/money';
<<<<<<< Updated upstream
=======
import {
  applyIncomeStatementCogsPolicy,
  tenantIncludesCogsInReports,
} from '@/lib/tenantCogsReporting';
import { resolveReportTenantScope } from '@/lib/reportTenantScope';
import { generateScopedIncomeStatement } from '@/lib/reportingEngine/multiTenantReporting';
import { logReportAccess } from '@/lib/reportAuditLog';
>>>>>>> Stashed changes

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const scopeResult = await resolveReportTenantScope(request, user);
    if (!scopeResult.ok) {
      return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status });
    }
    const {
      tenantIds,
      tenants,
      scope,
      tw,
      userQ,
      branchScoped,
      branchId,
      reportingCurrency,
    } = scopeResult;
    const primaryTenantId = tenantIds[0];
    const reportBranchId = branchScoped ? branchId : null;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

<<<<<<< Updated upstream
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
=======
    let statement;
    if (tenantIds.length > 1) {
      statement = await generateScopedIncomeStatement({
        tenantIds,
        tenants,
        startDate,
        endDate,
        branchId: reportBranchId,
        scope,
        reportingCurrency,
      });
    } else {
      const tenant = tenants[0];
      const statementRaw = await generateIncomeStatementFromAccounts(
        primaryTenantId,
        startDate,
        endDate,
        tenant?.name || 'Company',
        null,
        reportBranchId
      );
      const includeCogs = await tenantIncludesCogsInReports(prisma, primaryTenantId);
      statement = applyIncomeStatementCogsPolicy(statementRaw, includeCogs);
    }

    const includeCogsInReports =
      tenantIds.length === 1
        ? await tenantIncludesCogsInReports(prisma, primaryTenantId)
        : true;
>>>>>>> Stashed changes
    const totalRevenue = parseMoney(statement?.totalRevenue);
    const cogsAmount = parseMoney(
      statement?.cogs?.total ?? statement?.cogs?.costOfProductsSold ?? 0
    );
    const operatingExpenses = parseMoney(statement?.totalOperatingExpenses);
    const totalCosts = addMoney(cogsAmount, operatingExpenses);
    const profit = parseMoney(statement?.netIncome ?? statement?.operatingIncome);
    
    const outstandingInvoices = await prisma.invoice.aggregate({
      where: addBranchFilter(userQ, {
        ...tw,
        status: 'Pending',
        dueDate: { lt: new Date() },
      }),
      _count: true,
      _sum: { total: true },
    });
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    const recentSales = await prisma.sale.count({
      where: addBranchFilter(userQ, {
        ...tw,
        status: 'completed',
        voidedAt: null,
        refundedAt: null,
        saleDate: { gte: weekAgo },
      }),
    });

    const allProducts = await prisma.product.findMany({
      where: {
        ...tw,
        isDeleted: false,
        isService: false,
        stockLevel: { not: null },
      },
      select: { stockLevel: true, reorderPoint: true },
    });
    const lowStockProducts = allProducts.filter((p) => {
      const level = Number(p.stockLevel ?? 0);
      const reorder = Number(p.reorderPoint ?? 10);
      return level === 0 || level <= reorder;
    }).length;

    const profitMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : 0;

    await logReportAccess({
      userId: user.id,
      tenantId: primaryTenantId,
      reportType: 'summary',
      action: 'REPORT_GENERATED',
      tenantIds,
      businessNames: scope.businessNames,
      filters: { startDate, endDate },
    });

    return NextResponse.json({
      revenue: totalRevenue.toFixed(2),
      costOfGoodsSold: cogsAmount.toFixed(2),
      operatingExpenses: operatingExpenses.toFixed(2),
      expenses: totalCosts.toFixed(2),
      profit: profit.toFixed(2),
      profitMargin: profitMargin,
      outstandingInvoices: {
        count: outstandingInvoices._count,
        total: parseMoney(outstandingInvoices._sum.total).toFixed(2)
      },
      recentSales: recentSales,
      lowStockProducts: lowStockProducts,
      timeframe: {
        startDate,
        endDate
<<<<<<< Updated upstream
      }
=======
      },
      reporting: statement?.reporting || { includeCogsInReports },
      scope,
      byTenant: statement?.byTenant || null,
>>>>>>> Stashed changes
    });
  } catch (error) {
    console.error('Error generating financial summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate financial summary. Please try again.' },
      { status: 500 }
    );
  }
}
