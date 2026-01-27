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
  logoUrl = null,
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
        { accountSubtype: { contains: 'Cash', mode: 'insensitive' } },
        { accountCode: { in: ['1000', '1010', '1020', '1030', '1040', '1050'] } }
      ]
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true
    }
  });

  // Get current cash balances from AccountBalance table (more reliable for cash accounts)
  const cashAccountCodes = ['1000', '1010', '1020', '1030', '1040', '1050'];
  const accountBalances = await prisma.accountBalance.findMany({
    where: {
      tenantId,
      account: { in: cashAccountCodes }
    }
  });

  // Calculate current cash balance (as of now)
  let currentCashBalance = accountBalances.reduce(
    (sum, balance) => sum + parseFloat(balance.balance || 0), 
    0
  );

  // Also add balances from Account table for cash accounts not in AccountBalance
  for (const account of cashAccounts) {
    const hasAccountBalance = accountBalances.some(ab => ab.account === account.accountCode);
    if (!hasAccountBalance) {
      try {
        const accountBalance = await getAccountBalanceDetails(account.id, tenantId, null, prisma, branchId);
        currentCashBalance += accountBalance.balance || 0;
      } catch (error) {
        console.warn(`Could not get balance for account ${account.accountCode}:`, error);
      }
    }
  }

  // Calculate net cash flow from transactions AFTER the end date
  // These need to be subtracted to get the balance as of the end date
  const futureInflows = await prisma.payment.aggregate({
    where: {
      tenantId,
      status: 'Completed',
      paymentDate: { gt: end },
      OR: [
        { invoiceId: { not: null } },
        { saleId: { not: null } }
      ],
      ...(branchId ? { branchId } : {})
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
        { type: 'Asset Purchase' },
        { type: 'Loan Payment' },
        { type: 'Loan Repayment' }
      ],
      ...(branchId ? { branchId } : {})
    },
    _sum: {
      amount: true
    }
  });

  // Get future supplier payments
  const futureSupplierPayments = await prisma.supplierPayment.aggregate({
    where: {
      tenantId,
      paymentDate: { gt: end },
      ...(branchId ? { branchId } : {})
    },
    _sum: {
      totalAmount: true
    }
  });

  // Calculate net cash flow from future transactions
  const futureNetCashFlow = (futureInflows._sum.amount || 0) - 
                           (futureOutflows._sum.amount || 0) - 
                           (futureSupplierPayments._sum.totalAmount || 0);

  // Closing balance = current balance - future transactions
  const closingCashBalance = Math.max(0, currentCashBalance - futureNetCashFlow);

  // Get actual payments from Payment table (more accurate than transaction lines)
  const payments = await prisma.payment.findMany({
    where: {
      tenantId,
      status: 'Completed',
      paymentDate: { gte: start, lte: end },
      ...(branchId ? { branchId } : {})
    },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          client: {
            select: {
              name: true
            }
          }
        }
      },
      sale: {
        select: {
          id: true,
          saleNumber: true,
          client: {
            select: {
              name: true
            }
          }
        }
      },
      expense: {
        select: {
          id: true,
          description: true,
          category: true
        }
      }
    },
    orderBy: {
      paymentDate: 'asc'
    }
  });

  // Get supplier payments (from SupplierPayment model)
  const supplierPayments = await prisma.supplierPayment.findMany({
    where: {
      tenantId,
      paymentDate: { gte: start, lte: end },
      ...(branchId ? { branchId } : {})
    },
    include: {
      supplier: {
        select: {
          supplierName: true
        }
      },
      allocations: {
        include: {
          bill: {
            select: {
              billNumber: true
            }
          }
        }
      }
    },
    orderBy: {
      paymentDate: 'asc'
    }
  });

  // Get all transactions in the period that affect cash accounts - filter by branch
  // This is for non-payment transactions (journal entries, etc.)
  const cashTransactions = await prisma.transactionLine.findMany({
    where: {
      accountId: { in: cashAccounts.map(acc => acc.id) },
      transaction: {
        tenantId,
        status: 'posted',
        date: { gte: start, lte: end },
        sourceType: { notIn: ['Payment', 'Invoice', 'Sale', 'Expense'] }, // Exclude payment-related transactions
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

  // Dynamic cash flow structure with line items
  const cashInflows = {
    lineItems: [],
    total: 0,
    details: []
  };

  const cashOutflows = {
    lineItems: [],
    total: 0,
    details: []
  };

  // Group inflows and outflows by category dynamically
  const inflowsByCategory = {};
  const outflowsByCategory = {};

  // Process payments (actual cash movements)
  payments.forEach(payment => {
    const amount = parseFloat(payment.amount || 0);
    const paymentDate = payment.paymentDate;
    
    // Determine category based on payment source
    let category = 'Other';
    let description = '';
    let reference = '';
    
    if (payment.invoiceId && payment.invoice) {
      category = 'Customer Payments';
      description = `Payment for Invoice ${payment.invoice.invoiceNumber}`;
      reference = payment.invoice.invoiceNumber;
    } else if (payment.saleId && payment.sale) {
      category = 'Customer Payments';
      description = `Payment for Sale ${payment.sale.saleNumber}`;
      reference = payment.sale.saleNumber;
    } else if (payment.expenseId && payment.expense) {
      const expenseCategory = payment.expense.category || 'Other Expenses';
      category = expenseCategory;
      description = payment.expense.description || 'Expense Payment';
      reference = payment.expense.id;
    } else if (payment.type === 'Asset Purchase') {
      category = 'Asset Purchases';
      description = payment.description || 'Asset Purchase';
      reference = payment.reference || payment.id;
    } else if (payment.type === 'Loan Payment' || payment.type === 'Loan Repayment') {
      category = 'Loan Payments';
      description = payment.description || 'Loan Payment';
      reference = payment.reference || payment.id;
    } else {
      category = payment.description || 'Other';
      description = payment.description || 'Payment';
      reference = payment.reference || payment.id;
    }
    
    // Determine if this is an inflow or outflow based on payment source, not amount sign
    // Inflows: Customer payments (invoices, sales), income, loans received
    // Outflows: Expense payments, asset purchases, loan payments, etc.
    const paymentType = (payment.type || '').toLowerCase();
    const isInflow = (payment.invoiceId || payment.saleId) && !payment.expenseId && 
                     !paymentType.includes('expense') && 
                     !paymentType.includes('asset') && 
                     !paymentType.includes('loan');
    const isOutflow = payment.expenseId || 
                     paymentType.includes('expense') ||
                     paymentType === 'asset purchase' || 
                     paymentType === 'loan payment' || 
                     paymentType === 'loan repayment' ||
                     amount < 0; // Negative amounts are always outflows
    
    if (isInflow && amount > 0) {
      // Cash inflow
      if (!inflowsByCategory[category]) {
        inflowsByCategory[category] = {
          amount: 0,
          details: []
        };
      }
      inflowsByCategory[category].amount += amount;
      inflowsByCategory[category].details.push({
        date: paymentDate,
        description: description,
        reference: reference,
        amount: amount,
        type: payment.invoiceId ? 'customer_payment' : payment.saleId ? 'sale_payment' : 'other_receipt',
        clientName: payment.invoice?.client?.name || payment.sale?.client?.name || 'N/A'
      });
      cashInflows.total += amount;
      cashInflows.details.push({
        date: paymentDate,
        description: description,
        reference: reference,
        amount: amount,
        type: payment.invoiceId ? 'customer_payment' : payment.saleId ? 'sale_payment' : 'other_receipt'
      });
    } else if (isOutflow) {
      // Cash outflow - use absolute value
      const absAmount = Math.abs(amount);
      if (!outflowsByCategory[category]) {
        outflowsByCategory[category] = {
          amount: 0,
          details: []
        };
      }
      outflowsByCategory[category].amount += absAmount;
      outflowsByCategory[category].details.push({
        date: paymentDate,
        description: description,
        reference: reference,
        amount: absAmount,
        type: payment.expenseId ? 'expense_payment' : payment.type === 'Asset Purchase' ? 'asset_purchase' : payment.type === 'Loan Payment' || payment.type === 'Loan Repayment' ? 'loan_payment' : 'other_payment',
        category: category
      });
      cashOutflows.total += absAmount;
      cashOutflows.details.push({
        date: paymentDate,
        description: description,
        reference: reference,
        amount: absAmount,
        type: payment.expenseId ? 'expense_payment' : payment.type === 'Asset Purchase' ? 'asset_purchase' : payment.type === 'Loan Payment' || payment.type === 'Loan Repayment' ? 'loan_payment' : 'other_payment',
        category: category
      });
    }
  });

  // Process supplier payments (from SupplierPayment model)
  supplierPayments.forEach(supplierPayment => {
    const amount = parseFloat(supplierPayment.totalAmount || 0);
    const paymentDate = supplierPayment.paymentDate;
    const category = 'Supplier Payments';
    
    // Build description from allocations
    const billNumbers = supplierPayment.allocations.map(a => a.bill.billNumber).join(', ');
    const description = billNumbers 
      ? `Payment for Bills ${billNumbers}`
      : `Payment to ${supplierPayment.supplier?.supplierName || 'Supplier'}`;
    const reference = supplierPayment.referenceNumber || supplierPayment.paymentNumber || supplierPayment.id;
    
    // Supplier payments are outflows (negative)
    if (amount > 0) {
      if (!outflowsByCategory[category]) {
        outflowsByCategory[category] = {
          amount: 0,
          details: []
        };
      }
      outflowsByCategory[category].amount += amount;
      outflowsByCategory[category].details.push({
        date: paymentDate,
        description: description,
        reference: reference,
        amount: amount,
        type: 'supplier_payment',
        category: category,
        supplierName: supplierPayment.supplier?.supplierName || 'N/A'
      });
      cashOutflows.total += amount;
      cashOutflows.details.push({
        date: paymentDate,
        description: description,
        reference: reference,
        amount: amount,
        type: 'supplier_payment',
        category: category
      });
    }
  });

  // Process non-payment transactions (journal entries, etc.)
  for (const line of cashTransactions) {
    const amount = parseFloat(line.debitAmount || 0) - parseFloat(line.creditAmount || 0);
    const isInflow = amount > 0;
    const absAmount = Math.abs(amount);

    const sourceType = line.transaction.sourceType || '';
    const description = (line.transaction.description || '').toLowerCase();
    const reference = line.transaction.reference || '';
    
    let category = 'Other';
    
    // Categorize based on transaction type
    if (sourceType === 'Asset' || description.includes('asset') || description.includes('equipment')) {
      category = isInflow ? 'Asset Sales' : 'Asset Purchases';
    } else if (description.includes('loan') || description.includes('capital') || description.includes('equity')) {
      category = isInflow ? 'Loans Received' : 'Loan Payments';
    } else if (description.includes('dividend')) {
      category = 'Dividends';
    } else {
      category = isInflow ? 'Other Receipts' : 'Other Payments';
    }
    
    if (isInflow) {
      if (!inflowsByCategory[category]) {
        inflowsByCategory[category] = {
          amount: 0,
          details: []
        };
      }
      inflowsByCategory[category].amount += absAmount;
      inflowsByCategory[category].details.push({
        date: line.transaction.date,
        description: line.transaction.description,
        reference: reference,
        amount: absAmount,
        type: 'other_receipt',
        account: line.account.accountName
      });
      cashInflows.total += absAmount;
      cashInflows.details.push({
        date: line.transaction.date,
        description: line.transaction.description,
        reference: reference,
        amount: absAmount,
        type: 'other_receipt'
      });
    } else {
      if (!outflowsByCategory[category]) {
        outflowsByCategory[category] = {
          amount: 0,
          details: []
        };
      }
      outflowsByCategory[category].amount += absAmount;
      outflowsByCategory[category].details.push({
        date: line.transaction.date,
        description: line.transaction.description,
        reference: reference,
        amount: absAmount,
        type: 'other_payment',
        category: category,
        account: line.account.accountName
      });
      cashOutflows.total += absAmount;
      cashOutflows.details.push({
        date: line.transaction.date,
        description: line.transaction.description,
        reference: reference,
        amount: absAmount,
        type: 'other_payment',
        category: category
      });
    }
  }

  // Convert to line items arrays (sorted by amount descending)
  cashInflows.lineItems = Object.entries(inflowsByCategory)
    .map(([category, data]) => ({
      key: `inflow-${category.toLowerCase().replace(/\s+/g, '-')}`,
      label: category,
      value: data.amount,
      details: data.details || []
    }))
    .sort((a, b) => b.value - a.value)
    .filter(item => item.value > 0.000001);

  cashOutflows.lineItems = Object.entries(outflowsByCategory)
    .map(([category, data]) => ({
      key: `outflow-${category.toLowerCase().replace(/\s+/g, '-')}`,
      label: category,
      value: data.amount,
      details: data.details || []
    }))
    .sort((a, b) => b.value - a.value)
    .filter(item => item.value > 0.000001);

  // Calculate net cash flow during the period
  const netCashFlow = cashInflows.total - cashOutflows.total;
  const netIncreaseDecrease = netCashFlow;

  // Opening balance = Closing balance - Net cash flow during period
  // This ensures: Closing = Opening + Net Cash Flow
  const openingCashBalance = Math.max(0, closingCashBalance - netCashFlow);

  // Verify: Opening + Net Change = Closing
  const calculatedClosing = openingCashBalance + netIncreaseDecrease;
  const difference = Math.abs(calculatedClosing - closingCashBalance);

  return {
    companyName,
    logoUrl,
    period: {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    },
    openingCashBalance,
    closingCashBalance,
    netCashFlow,
    cashInflows,
    cashOutflows,
    cashBalances: {
      openingBalance: openingCashBalance,
      closingBalance: closingCashBalance,
      netIncreaseDecrease,
      calculatedClosing,
      difference,
      isReconciled: difference < 0.01
    },
    // Legacy structure for backward compatibility
    operatingActivities: {
      cashInflows: {
        total: cashInflows.total,
        details: cashInflows.details
      },
      cashOutflows: {
        total: cashOutflows.total,
        details: cashOutflows.details
      },
      netCashFlow: netCashFlow
    },
    summary: {
      netCashFromOperating: netCashFlow,
      netCashFromInvesting: 0,
      netCashFromFinancing: 0,
      netIncreaseDecrease,
      openingCashBalance,
      closingCashBalance
    },
    metadata: {
      cashAccounts: cashAccounts.length,
      paymentsProcessed: payments.length,
      transactionsProcessed: cashTransactions.length,
      generatedAt: new Date().toISOString()
    }
  };
}










