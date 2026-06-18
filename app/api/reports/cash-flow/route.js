// app/api/reports/cash-flow/route.js
import { NextResponse } from 'next/server';
import { generateCashFlowFromAccounts } from '@/lib/cashFlowService';
import { addMoney, roundMoney } from '@/lib/money';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';

function consolidateCashFlows(flows) {
  const primary = flows[0]?.flow || {};
  const sumField = (path) => {
    let total = 0;
    for (const { flow } of flows) {
      const parts = path.split('.');
      let val = flow;
      for (const p of parts) val = val?.[p];
      total = addMoney(total, val ?? 0);
    }
    return roundMoney(total);
  };

  return {
    ...primary,
    companyName: 'Consolidated — Multiple Businesses',
    cashInflows: {
      ...primary.cashInflows,
      cashFromCustomerPayments: sumField('cashInflows.cashFromCustomerPayments'),
      otherCashReceipts: sumField('cashInflows.otherCashReceipts'),
      total: sumField('cashInflows.total'),
      lineItems: [],
      details: [],
    },
    cashOutflows: {
      ...primary.cashOutflows,
      paymentsToSuppliers: sumField('cashOutflows.paymentsToSuppliers'),
      salaryPayments: sumField('cashOutflows.salaryPayments'),
      rentPayments: sumField('cashOutflows.rentPayments'),
      otherExpensePayments: sumField('cashOutflows.otherExpensePayments'),
      assetPurchases: sumField('cashOutflows.assetPurchases'),
      loanPayments: sumField('cashOutflows.loanPayments'),
      loanPrincipalPaid: sumField('cashOutflows.loanPrincipalPaid'),
      loanInterestPaid: sumField('cashOutflows.loanInterestPaid'),
      total: sumField('cashOutflows.total'),
      lineItems: [],
      details: [],
    },
    netCashFlow: sumField('netCashFlow'),
    openingCashBalance: sumField('openingCashBalance'),
    closingCashBalance: sumField('closingCashBalance'),
    summary: {
      netIncreaseDecrease: sumField('summary.netIncreaseDecrease'),
      openingCashBalance: sumField('summary.openingCashBalance'),
      closingCashBalance: sumField('summary.closingCashBalance'),
    },
    cashBalances: {
      ...primary.cashBalances,
      openingBalance: sumField('cashBalances.openingBalance'),
      closingBalance: sumField('cashBalances.closingBalance'),
      netIncreaseDecrease: sumField('cashBalances.netIncreaseDecrease'),
    },
    metadata: {
      ...(primary.metadata || {}),
      multiTenant: true,
      tenantCount: flows.length,
    },
  };
}

/**
 * Professional Cash Flow Statement API
 * Generates cash flow statement from actual transaction data
 */
export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, scope, tenantIds, tenants, primaryTenantId, reportBranchId } = boot;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    let cashFlow;
    let byTenant = null;

    if (tenantIds.length > 1) {
      const tMap = new Map(tenants.map((t) => [t.id, t]));
      const flows = await Promise.all(
        tenantIds.map(async (tenantId) => {
          const tenant = tMap.get(tenantId);
          const flow = await generateCashFlowFromAccounts(
            tenantId,
            startDate,
            endDate,
            tenant?.name || 'Company',
            tenant?.logoUrl || null,
            reportBranchId
          );
          return { tenantId, tenantName: tenant?.name || tenantId, flow };
        })
      );
      cashFlow = consolidateCashFlows(flows);
      byTenant = flows.map(({ tenantId, tenantName, flow }) => ({
        tenantId,
        tenantName,
        netCashFlow: flow.netCashFlow,
        openingCashBalance: flow.openingCashBalance,
        closingCashBalance: flow.closingCashBalance,
        totalInflows: flow.cashInflows?.total ?? 0,
        totalOutflows: flow.cashOutflows?.total ?? 0,
      }));
    } else {
      const tenant = tenants[0];
      cashFlow = await generateCashFlowFromAccounts(
        primaryTenantId,
        startDate,
        endDate,
        tenant?.name || 'Company',
        tenant?.logoUrl || null,
        reportBranchId
      );
    }

    await auditReportAccess({
      user,
      reportType: 'cash-flow',
      tenantIds,
      scope,
      filters: { startDate, endDate },
    });

    return NextResponse.json({ ...cashFlow, scope, byTenant });
  } catch (error) {
    console.error('Error generating cash flow statement:', error);
    console.error('Cash flow error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      {
        error: 'Failed to generate cash flow statement. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
