// lib/apAgingService.js
/**
 * Accounts Payable Aging Service
 * Enhanced to verify balances with transaction data from Phase 1 accounting foundation
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';
import { addMoney, parseMoney, subtractMoney } from './money';

/**
 * Generate AP Aging Report with transaction verification
 */
export async function generateAPAgingFromTransactions(tenantId, asOfDate, branchId = null) {
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
    const apBalanceDetails = await getAccountBalanceDetails(apAccount.id, tenantId, reportDate, prisma, branchId);
    apBalanceFromTransactions = Math.abs(apBalanceDetails.balance); // AP is a liability, so we use absolute value
  }

  // Get all unpaid or partially paid expenses - filter by branch
  let expenses = [];
  try {
    expenses = await prisma.expense.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
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
  } catch (expenseQueryError) {
    console.error('Error fetching expenses for AP aging:', expenseQueryError);
    expenses = [];
  }

  // Include unpaid supplier bills in AP sub-ledger
  let supplierBills = [];
  try {
    supplierBills = await prisma.supplierBill.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        status: { in: ['Unpaid', 'Partially Paid', 'Pending', 'Posted', 'Approved'] },
        billDate: { lte: reportDate },
      },
      include: {
        supplier: { select: { id: true, supplierName: true } },
        payments: {
          where: { status: 'Completed', paymentDate: { lte: reportDate } },
          select: { amount: true },
        },
      },
    });
  } catch (billErr) {
    console.warn('Supplier bills omitted from AP aging:', billErr?.message);
  }

  const billDetails = supplierBills
    .map((bill) => {
      const totalPaid = (bill.payments || []).reduce((sum, p) => addMoney(sum, p.amount), 0);
      const balanceDue = subtractMoney(bill.totalAmount || 0, totalPaid);
      return {
        id: bill.id,
        billNumber: bill.billNumber || bill.id.substring(0, 8),
        vendorId: bill.supplierId,
        vendor: { id: bill.supplierId, name: bill.supplier?.supplierName || 'Supplier', email: null },
        date: bill.billDate,
        dueDate: bill.dueDate || bill.billDate,
        daysPastDue: 0,
        amount: balanceDue,
        agingBucket: 'current',
        totalExpense: bill.totalAmount,
        totalPaid,
      };
    })
    .filter((b) => b.amount > 0.01);

  // Calculate aging for each expense
  const expenseDetails = expenses.map(expense => {
    const dueDate = expense.date ? new Date(expense.date) : null;
    
    // Calculate balance from payments
    const totalPaid = expense.payments.reduce((sum, p) => addMoney(sum, p.amount), 0);
    const balanceDue = subtractMoney(expense.amount, totalPaid);
    
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
  const outstandingExpenses = [...expenseDetails.filter((exp) => exp.amount > 0.01), ...billDetails];

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
      vendorGroups[vendorId].current = addMoney(vendorGroups[vendorId].current, expense.amount);
    } else if (expense.agingBucket === 'days1to30') {
      vendorGroups[vendorId].days1to30 = addMoney(vendorGroups[vendorId].days1to30, expense.amount);
    } else if (expense.agingBucket === 'days31to60') {
      vendorGroups[vendorId].days31to60 = addMoney(vendorGroups[vendorId].days31to60, expense.amount);
    } else if (expense.agingBucket === 'days61to90') {
      vendorGroups[vendorId].days61to90 = addMoney(vendorGroups[vendorId].days61to90, expense.amount);
    } else {
      vendorGroups[vendorId].daysOver90 = addMoney(vendorGroups[vendorId].daysOver90, expense.amount);
    }
    
    vendorGroups[vendorId].total = addMoney(vendorGroups[vendorId].total, expense.amount);
    vendorGroups[vendorId].expenses.push(expense);
  });

  // Convert to array
  const items = Object.values(vendorGroups).map(vendor => ({
    id: vendor.vendorId,
    name: vendor.vendorName,
    current: parseMoney(vendor.current),
    days1to30: parseMoney(vendor.days1to30),
    days31to60: parseMoney(vendor.days31to60),
    days61to90: parseMoney(vendor.days61to90),
    daysOver90: parseMoney(vendor.daysOver90),
    total: parseMoney(vendor.total)
  }));

  // Calculate totals
  const totals = {
    current: items.reduce((sum, item) => addMoney(sum, item.current), 0),
    days1to30: items.reduce((sum, item) => addMoney(sum, item.days1to30), 0),
    days31to60: items.reduce((sum, item) => addMoney(sum, item.days31to60), 0),
    days61to90: items.reduce((sum, item) => addMoney(sum, item.days61to90), 0),
    daysOver90: items.reduce((sum, item) => addMoney(sum, item.daysOver90), 0),
    total: items.reduce((sum, item) => addMoney(sum, item.total), 0)
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
      amount: parseMoney(exp.amount),
      totalExpense: exp.totalExpense,
      totalPaid: exp.totalPaid
    })),
    verification: {
      apBalanceFromTransactions: apBalanceFromTransactions,
      totalExpenseBalance: totals.total,
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










