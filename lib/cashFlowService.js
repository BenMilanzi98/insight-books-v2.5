// lib/cashFlowService.js
/**
 * Cash Flow Statement Service
 * Generates cash flow statement from Transaction/TransactionLine data using Phase 1 accounting foundation
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';

/**
 * Generate cash flow statement from account transactions
 */
export async function generateCashFlowFromAccounts(
  tenantId,
  startDate,
  endDate,
  companyName = 'Company',
  branchId = null
) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get all cash and cash equivalent accounts
  const cashAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Asset',
      isActive: true,
      OR: [
        { accountName: { contains: 'Cash', mode: 'insensitive' } },
        { accountName: { contains: 'Bank', mode: 'insensitive' } },
        { accountSubtype: { contains: 'Cash', mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true
    }
  });

  // Get opening and closing cash balances
  const startDateMinusOne = new Date(start);
  startDateMinusOne.setDate(startDateMinusOne.getDate() - 1);

  let openingCashBalance = 0;
  let closingCashBalance = 0;

  for (const account of cashAccounts) {
    const openingBalance = await getAccountBalanceDetails(account.id, tenantId, startDateMinusOne, prisma, branchId);
    const closingBalance = await getAccountBalanceDetails(account.id, tenantId, end, prisma, branchId);
    openingCashBalance += openingBalance.balance;
    closingCashBalance += closingBalance.balance;
  }

  // Get all transactions in the period that affect cash accounts - filter by branch
  const cashTransactions = await prisma.transactionLine.findMany({
    where: {
      accountId: { in: cashAccounts.map(acc => acc.id) },
      transaction: {
        tenantId,
        status: 'posted',
        date: { gte: start, lte: end },
        ...(branchId ? { branchId } : {})
      }
    },
    include: {
      transaction: {
        select: {
          id: true,
          date: true,
          description: true,
          reference: true,
          sourceType: true,
          sourceId: true
        }
      },
      account: {
        select: {
          id: true,
          accountName: true,
          accountCode: true
        }
      }
    },
    orderBy: {
      transaction: {
        date: 'asc'
      }
    }
  });

  // Categorize cash flows
  const operatingActivities = {
    cashInflows: {
      customerPayments: 0,
      otherOperatingReceipts: 0,
      total: 0,
      details: []
    },
    cashOutflows: {
      supplierPayments: 0,
      salaryPayments: 0,
      rentPayments: 0,
      taxPayments: 0,
      otherOperatingPayments: 0,
      total: 0,
      details: []
    },
    netCashFlow: 0
  };

  const investingActivities = {
    cashInflows: {
      assetSales: 0,
      investmentReturns: 0,
      total: 0,
      details: []
    },
    cashOutflows: {
      assetPurchases: 0,
      investments: 0,
      total: 0,
      details: []
    },
    netCashFlow: 0
  };

  const financingActivities = {
    cashInflows: {
      loans: 0,
      capitalContributions: 0,
      total: 0,
      details: []
    },
    cashOutflows: {
      loanRepayments: 0,
      dividends: 0,
      total: 0,
      details: []
    },
    netCashFlow: 0
  };

  // Process each transaction line
  for (const line of cashTransactions) {
    const amount = parseFloat(line.debitAmount || 0) - parseFloat(line.creditAmount || 0);
    const isInflow = amount > 0;
    const absAmount = Math.abs(amount);

    // Determine activity type based on transaction source and description
    const sourceType = line.transaction.sourceType || '';
    const description = (line.transaction.description || '').toLowerCase();
    const reference = line.transaction.reference || '';

    // Operating Activities
    if (sourceType === 'Sale' || sourceType === 'Invoice' || 
        description.includes('payment') || description.includes('revenue') ||
        description.includes('sale') || description.includes('invoice')) {
      if (isInflow) {
        operatingActivities.cashInflows.customerPayments += absAmount;
        operatingActivities.cashInflows.total += absAmount;
        operatingActivities.cashInflows.details.push({
          date: line.transaction.date,
          description: line.transaction.description,
          reference: line.transaction.reference,
          amount: absAmount,
          account: line.account.accountName
        });
      } else {
        // Operating outflows
        if (description.includes('supplier') || description.includes('purchase') || 
            description.includes('expense') || sourceType === 'Expense') {
          operatingActivities.cashOutflows.supplierPayments += absAmount;
        } else if (description.includes('salary') || description.includes('wage') || 
                   description.includes('payroll')) {
          operatingActivities.cashOutflows.salaryPayments += absAmount;
        } else if (description.includes('rent')) {
          operatingActivities.cashOutflows.rentPayments += absAmount;
        } else if (description.includes('tax')) {
          operatingActivities.cashOutflows.taxPayments += absAmount;
        } else {
          operatingActivities.cashOutflows.otherOperatingPayments += absAmount;
        }
        operatingActivities.cashOutflows.total += absAmount;
        operatingActivities.cashOutflows.details.push({
          date: line.transaction.date,
          description: line.transaction.description,
          reference: line.transaction.reference,
          amount: absAmount,
          account: line.account.accountName
        });
      }
    }
    // Investing Activities
    else if (sourceType === 'Asset' || description.includes('asset') || 
             description.includes('equipment') || description.includes('property')) {
      if (isInflow) {
        investingActivities.cashInflows.assetSales += absAmount;
        investingActivities.cashInflows.total += absAmount;
      } else {
        investingActivities.cashOutflows.assetPurchases += absAmount;
        investingActivities.cashOutflows.total += absAmount;
      }
    }
    // Financing Activities
    else if (description.includes('loan') || description.includes('capital') || 
             description.includes('equity') || description.includes('dividend')) {
      if (isInflow) {
        if (description.includes('loan')) {
          financingActivities.cashInflows.loans += absAmount;
        } else {
          financingActivities.cashInflows.capitalContributions += absAmount;
        }
        financingActivities.cashInflows.total += absAmount;
      } else {
        if (description.includes('loan') || description.includes('repay')) {
          financingActivities.cashOutflows.loanRepayments += absAmount;
        } else {
          financingActivities.cashOutflows.dividends += absAmount;
        }
        financingActivities.cashOutflows.total += absAmount;
      }
    }
    // Default to operating if unclear
    else {
      if (isInflow) {
        operatingActivities.cashInflows.otherOperatingReceipts += absAmount;
        operatingActivities.cashInflows.total += absAmount;
      } else {
        operatingActivities.cashOutflows.otherOperatingPayments += absAmount;
        operatingActivities.cashOutflows.total += absAmount;
      }
    }
  }

  // Calculate net cash flows
  operatingActivities.netCashFlow = 
    operatingActivities.cashInflows.total - operatingActivities.cashOutflows.total;
  investingActivities.netCashFlow = 
    investingActivities.cashInflows.total - investingActivities.cashOutflows.total;
  financingActivities.netCashFlow = 
    financingActivities.cashInflows.total - financingActivities.cashOutflows.total;

  const netIncreaseDecrease = 
    operatingActivities.netCashFlow + 
    investingActivities.netCashFlow + 
    financingActivities.netCashFlow;

  // Verify: Opening + Net Change = Closing
  const calculatedClosing = openingCashBalance + netIncreaseDecrease;
  const difference = Math.abs(calculatedClosing - closingCashBalance);

  return {
    companyName,
    period: {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    },
    cashBalances: {
      openingBalance: openingCashBalance,
      closingBalance: closingCashBalance,
      netIncreaseDecrease,
      calculatedClosing,
      difference,
      isReconciled: difference < 0.01
    },
    operatingActivities,
    investingActivities,
    financingActivities,
    summary: {
      netCashFromOperating: operatingActivities.netCashFlow,
      netCashFromInvesting: investingActivities.netCashFlow,
      netCashFromFinancing: financingActivities.netCashFlow,
      netIncreaseDecrease,
      openingCashBalance,
      closingCashBalance
    },
    metadata: {
      cashAccounts: cashAccounts.length,
      transactionsProcessed: cashTransactions.length,
      generatedAt: new Date().toISOString()
    }
  };
}










