// app/api/reports/cash-flow/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateCashFlowFromAccounts } from '@/lib/cashFlowService';

/**
 * Professional Cash Flow Statement API
 * Generates cash flow statement from actual transaction data
 */
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    // Get tenant name and logo
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true, logoUrl: true }
    });
    
    // Generate cash flow statement using Phase 2 enhanced service
    const cashFlow = await generateCashFlowFromAccounts(
      user.tenantId, 
      startDate, 
      endDate, 
      tenant?.name || 'Company',
      tenant?.logoUrl || null,
      user.currentBranchId || null
    );
    
    return NextResponse.json(cashFlow);
  } catch (error) {
    console.error('Error generating cash flow statement:', error);
    return NextResponse.json(
      { error: 'Failed to generate cash flow statement. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Generate cash flow statement for a given period
 */
async function generateCashFlowStatement(tenantId, startDate, endDate, companyName = 'Company') {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // ========== CASH INFLOWS ==========
  const cashInflows = {
    customerPayments: 0,
    otherCashReceipts: 0,
    total: 0,
    details: []
  };
  
  // Get customer payments (from invoices and sales)
  const invoicePayments = await prisma.payment.findMany({
    where: {
      tenantId,
      invoiceId: { not: null },
      paymentDate: { gte: start, lte: end },
      status: 'Completed'
    },
    include: {
      invoice: {
        include: {
          client: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
  
  invoicePayments.forEach(payment => {
    cashInflows.customerPayments += payment.amount || 0;
    cashInflows.details.push({
      type: 'customer_payment',
      id: payment.id,
      date: payment.paymentDate,
      description: `Payment from ${payment.invoice?.client?.name || 'Customer'}`,
      reference: payment.invoice?.invoiceNumber || payment.reference || 'N/A',
      amount: payment.amount || 0
    });
  });
  
  // Get sales payments (POS transactions)
  const salePayments = await prisma.payment.findMany({
    where: {
      tenantId,
      saleId: { not: null },
      paymentDate: { gte: start, lte: end },
      status: 'Completed'
    },
    include: {
      sale: {
        include: {
          client: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
  
  salePayments.forEach(payment => {
    cashInflows.customerPayments += payment.amount || 0;
    cashInflows.details.push({
      type: 'sale_payment',
      id: payment.id,
      date: payment.paymentDate,
      description: `Sale payment from ${payment.sale?.client?.name || 'Walk-in Customer'}`,
      reference: payment.sale?.saleNumber || payment.reference || 'N/A',
      amount: payment.amount || 0
    });
  });
  
  // Get other cash receipts (could be from other income, loans, etc.)
  // This would typically come from transactions or other sources
  // For now, we'll check for payments not linked to invoices or sales
  const otherPayments = await prisma.payment.findMany({
    where: {
      tenantId,
      invoiceId: null,
      saleId: null,
      expenseId: null,
      paymentDate: { gte: start, lte: end },
      status: 'Completed',
      type: { in: ['Income', 'Loan', 'Investment', 'Other'] }
    }
  });
  
  otherPayments.forEach(payment => {
    cashInflows.otherCashReceipts += payment.amount || 0;
    cashInflows.details.push({
      type: 'other_receipt',
      id: payment.id,
      date: payment.paymentDate,
      description: payment.notes || payment.type || 'Other Cash Receipt',
      reference: payment.reference || 'N/A',
      amount: payment.amount || 0
    });
  });
  
  cashInflows.total = cashInflows.customerPayments + cashInflows.otherCashReceipts;
  
  // ========== CASH OUTFLOWS ==========
  const cashOutflows = {
    supplierPayments: 0,
    salaryPayments: 0,
    rentPayments: 0,
    otherExpensePayments: 0,
    assetPurchases: 0,
    loanPayments: 0,
    total: 0,
    details: []
  };
  
  // Get expense payments
  const expensePayments = await prisma.payment.findMany({
    where: {
      tenantId,
      expenseId: { not: null },
      paymentDate: { gte: start, lte: end },
      status: 'Completed',
      NOT: {
        type: 'Loan Payment'
      }
    },
    include: {
      expense: true
    }
  });
  
  expensePayments.forEach(payment => {
    const expense = payment.expense;
    const amount = payment.amount || 0;
    const category = expense?.category || '';
    const normalizedCategory = category.toLowerCase();
    
    if (normalizedCategory.includes('salary') || normalizedCategory.includes('wage') || normalizedCategory.includes('payroll')) {
      cashOutflows.salaryPayments += amount;
    } else if (normalizedCategory.includes('rent')) {
      cashOutflows.rentPayments += amount;
    } else if (normalizedCategory.includes('supplier') || normalizedCategory.includes('vendor')) {
      cashOutflows.supplierPayments += amount;
    } else {
      cashOutflows.otherExpensePayments += amount;
    }
    
    cashOutflows.details.push({
      type: 'expense_payment',
      id: payment.id,
      date: payment.paymentDate,
      description: expense?.description || 'Expense Payment',
      category: category,
      reference: payment.reference || expense?.paymentReference || 'N/A',
      amount: amount
    });
  });
  
  // Get asset purchases
  const assetPurchases = await prisma.asset.findMany({
    where: {
      tenantId,
      purchaseDate: { gte: start, lte: end }
    },
    include: {
      category: true
    }
  });
  
  assetPurchases.forEach(asset => {
    const amount = asset.originalCost || 0;
    cashOutflows.assetPurchases += amount;
    cashOutflows.details.push({
      type: 'asset_purchase',
      id: asset.id,
      date: asset.purchaseDate,
      description: `Purchase of ${asset.name}`,
      category: asset.category?.name || 'Asset',
      reference: asset.serialNumber || 'N/A',
      amount: amount
    });
  });
  
  // Get loan payments (from transactions or payments with type 'Loan Payment')
  const loanPayments = await prisma.payment.findMany({
    where: {
      tenantId,
      paymentDate: { gte: start, lte: end },
      status: 'Completed',
      type: 'Loan Payment'
    }
  });
  
  loanPayments.forEach(payment => {
    cashOutflows.loanPayments += payment.amount || 0;
    cashOutflows.details.push({
      type: 'loan_payment',
      id: payment.id,
      date: payment.paymentDate,
      description: payment.notes || 'Loan Payment',
      reference: payment.reference || 'N/A',
      amount: payment.amount || 0
    });
  });
  
  cashOutflows.total = 
    cashOutflows.supplierPayments +
    cashOutflows.salaryPayments +
    cashOutflows.rentPayments +
    cashOutflows.otherExpensePayments +
    cashOutflows.assetPurchases +
    cashOutflows.loanPayments;
  
  // ========== NET CASH FLOW ==========
  const netCashFlow = cashInflows.total - cashOutflows.total;
  
  // ========== CASH BALANCES ==========
  // Get current account balances (this represents the closing balance as of now)
  // AccountBalance stores balances by payment method (cash, bank_transfer, airtel_money, mpamba, paychangu, etc.)
  const accountBalances = await prisma.accountBalance.findMany({
    where: {
      tenantId
    }
  });
  
  const currentCashBalance = accountBalances.reduce(
    (sum, balance) => sum + (balance.balance || 0), 0
  );
  
  // Calculate closing balance: current balance minus transactions after end date
  // Get transactions after the period end date
  const futureInflows = await prisma.payment.aggregate({
    where: {
      tenantId,
      status: 'Completed',
      paymentDate: { gt: end },
      OR: [
        { invoiceId: { not: null } },
        { saleId: { not: null } }
      ]
    },
    _sum: {
      amount: true
    }
  });
  
  const futureOutflows = await prisma.payment.aggregate({
    where: {
      tenantId,
      status: 'Completed',
      paymentDate: { gt: end },
      OR: [
        { expenseId: { not: null } },
        { type: 'Asset Purchase' }
      ]
    },
    _sum: {
      amount: true
    }
  });
  
  // Get asset purchases after end date
  const futureAssetPurchases = await prisma.asset.aggregate({
    where: {
      tenantId,
      purchaseDate: { gt: end }
    },
    _sum: {
      originalCost: true
    }
  });
  
  // Get loan payments after end date
  const futureLoanPayments = await prisma.payment.aggregate({
    where: {
      tenantId,
      paymentDate: { gt: end },
      status: 'Completed',
      type: 'Loan Payment'
    },
    _sum: {
      amount: true
    }
  });
  
  // Calculate net cash flow from future transactions
  const futureNetCashFlow = (futureInflows._sum.amount || 0) - 
                           (futureOutflows._sum.amount || 0) - 
                           (futureAssetPurchases._sum.originalCost || 0) - 
                           (futureLoanPayments._sum.amount || 0);
  
  // Closing balance = current balance - future transactions
  const closingBalance = Math.max(0, currentCashBalance - futureNetCashFlow);
  
  // Opening balance = closing balance - net cash flow during period
  // This ensures: Closing = Opening + Net Cash Flow
  const openingBalance = closingBalance - netCashFlow;
  
  return {
    companyName,
    period: {
      startDate,
      endDate
    },
    cashInflows: {
      customerPayments: cashInflows.customerPayments,
      otherCashReceipts: cashInflows.otherCashReceipts,
      total: cashInflows.total,
      details: cashInflows.details
    },
    cashOutflows: {
      supplierPayments: cashOutflows.supplierPayments,
      salaryPayments: cashOutflows.salaryPayments,
      rentPayments: cashOutflows.rentPayments,
      otherExpensePayments: cashOutflows.otherExpensePayments,
      assetPurchases: cashOutflows.assetPurchases,
      loanPayments: cashOutflows.loanPayments,
      total: cashOutflows.total,
      details: cashOutflows.details
    },
    netCashFlow,
    openingCashBalance: openingBalance,
    closingCashBalance: closingBalance
  };
}
