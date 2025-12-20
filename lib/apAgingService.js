// lib/apAgingService.js
/**
 * Accounts Payable Aging Service
 * Enhanced to verify balances with transaction data from Phase 1 accounting foundation
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';

/**
 * Generate AP Aging Report with transaction verification
 */
export async function generateAPAgingFromTransactions(tenantId, asOfDate) {
  const reportDate = new Date(asOfDate);
  reportDate.setHours(23, 59, 59, 999);

  // Get Accounts Payable account
  const apAccount = await prisma.account.findFirst({
    where: {
      tenantId,
      accountType: 'Liability',
      isActive: true,
      OR: [
        { accountName: { contains: 'Accounts Payable', mode: 'insensitive' } },
        { accountName: { contains: 'Payable', mode: 'insensitive' } },
        { accountSubtype: { contains: 'Payable', mode: 'insensitive' } }
      ]
    }
  });

  // Get AP balance from transactions
  let apBalanceFromTransactions = 0;
  if (apAccount) {
    const apBalanceDetails = await getAccountBalanceDetails(apAccount.id, tenantId, reportDate, prisma);
    apBalanceFromTransactions = Math.abs(apBalanceDetails.balance); // AP is a liability, so we use absolute value
  }

  // Get all unpaid or partially paid expenses
  const expenses = await prisma.expense.findMany({
    where: {
      tenantId,
      paymentStatus: { in: ['Pending', 'Partially'] },
      isDeleted: false,
      date: { lte: reportDate }
    },
    include: {
      payments: {
        where: {
          status: 'Completed',
          paymentDate: { lte: reportDate }
        },
        select: {
          amount: true,
          paymentDate: true
        }
      }
    },
    orderBy: {
      date: 'asc'
    }
  });

  // Calculate aging for each expense
  const expenseDetails = expenses.map(expense => {
    const dueDate = expense.date ? new Date(expense.date) : null;
    
    // Calculate balance from payments
    const totalPaid = expense.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balanceDue = expense.amount - totalPaid;
    
    let daysPastDue = 0;
    if (dueDate && !isNaN(dueDate.getTime())) {
      const diffTime = reportDate.getTime() - dueDate.getTime();
      daysPastDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // Determine aging bucket
    let agingBucket = 'current';
    if (daysPastDue <= 0) {
      agingBucket = 'current';
    } else if (daysPastDue <= 30) {
      agingBucket = 'days1to30';
    } else if (daysPastDue <= 60) {
      agingBucket = 'days31to60';
    } else if (daysPastDue <= 90) {
      agingBucket = 'days61to90';
    } else {
      agingBucket = 'daysOver90';
    }
    
    return {
      id: expense.id,
      billNumber: expense.paymentReference || expense.id.substring(0, 8) || 'N/A',
      vendorId: expense.merchant || 'unknown',
      vendor: { 
        id: expense.merchant || 'unknown', 
        name: expense.merchant || 'Unknown Vendor', 
        email: null 
      },
      date: expense.date,
      dueDate: expense.date, // Using expense date as due date
      daysPastDue: daysPastDue > 0 ? daysPastDue : 0,
      amount: balanceDue,
      agingBucket,
      totalExpense: expense.amount,
      totalPaid
    };
  });

  // Filter out expenses with zero balance
  const outstandingExpenses = expenseDetails.filter(exp => exp.amount > 0.01);

  // Group by vendor/merchant
  const vendorGroups = {};
  
  outstandingExpenses.forEach(expense => {
    const vendorId = expense.vendorId || 'unknown';
    const vendorName = expense.vendor?.name || 'Unknown Vendor';
    
    if (!vendorGroups[vendorId]) {
      vendorGroups[vendorId] = {
        vendorId,
        vendorName,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        daysOver90: 0,
        total: 0,
        expenses: []
      };
    }
    
    // Add to appropriate bucket
    if (expense.agingBucket === 'current') {
      vendorGroups[vendorId].current += expense.amount;
    } else if (expense.agingBucket === 'days1to30') {
      vendorGroups[vendorId].days1to30 += expense.amount;
    } else if (expense.agingBucket === 'days31to60') {
      vendorGroups[vendorId].days31to60 += expense.amount;
    } else if (expense.agingBucket === 'days61to90') {
      vendorGroups[vendorId].days61to90 += expense.amount;
    } else {
      vendorGroups[vendorId].daysOver90 += expense.amount;
    }
    
    vendorGroups[vendorId].total += expense.amount;
    vendorGroups[vendorId].expenses.push(expense);
  });

  // Convert to array
  const items = Object.values(vendorGroups).map(vendor => ({
    id: vendor.vendorId,
    name: vendor.vendorName,
    current: Number(vendor.current) || 0,
    days1to30: Number(vendor.days1to30) || 0,
    days31to60: Number(vendor.days31to60) || 0,
    days61to90: Number(vendor.days61to90) || 0,
    daysOver90: Number(vendor.daysOver90) || 0,
    total: Number(vendor.total) || 0
  }));

  // Calculate totals
  const totals = {
    current: items.reduce((sum, item) => sum + (Number(item.current) || 0), 0),
    days1to30: items.reduce((sum, item) => sum + (Number(item.days1to30) || 0), 0),
    days31to60: items.reduce((sum, item) => sum + (Number(item.days31to60) || 0), 0),
    days61to90: items.reduce((sum, item) => sum + (Number(item.days61to90) || 0), 0),
    daysOver90: items.reduce((sum, item) => sum + (Number(item.daysOver90) || 0), 0),
    total: items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  };

  // Verify total matches AP account balance (with tolerance)
  const difference = Math.abs(totals.total - apBalanceFromTransactions);
  const isReconciled = difference < 0.01;

  return {
    asOfDate: reportDate.toISOString(),
    items,
    totals,
    invoices: outstandingExpenses.map(exp => ({
      id: exp.id,
      billNumber: exp.billNumber,
      vendorId: exp.vendorId,
      vendor: exp.vendor,
      date: exp.date,
      dueDate: exp.dueDate,
      daysPastDue: exp.daysPastDue,
      amount: Number(exp.amount) || 0,
      totalExpense: exp.totalExpense,
      totalPaid: exp.totalPaid
    })),
    verification: {
      apAccountBalance: apBalanceFromTransactions,
      calculatedTotal: totals.total,
      difference,
      isReconciled,
      apAccount: apAccount ? {
        id: apAccount.id,
        accountCode: apAccount.accountCode,
        accountName: apAccount.accountName
      } : null
    },
    metadata: {
      totalExpenses: outstandingExpenses.length,
      totalVendors: items.length,
      generatedAt: new Date().toISOString()
    }
  };
}










