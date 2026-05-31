// app/api/reports/balance-sheet/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateBalanceSheetFromAccounts } from '@/lib/balanceSheetService';
import { addMoney, multiplyMoney, parseMoney, subtractMoney } from '@/lib/money';

/**
 * Professional Balance Sheet (Statement of Financial Position) API
 * Generates comprehensive balance sheet with proper asset/liability categorization and financial ratios
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
    const asOfDate = searchParams.get('asOfDate');
    const compareYear = searchParams.get('compareYear') === 'true';
    
    // Validate date
    if (!asOfDate) {
      return NextResponse.json(
        { error: 'As of date is required' },
        { status: 400 }
      );
    }
    
    // Parse date properly to avoid timezone issues
    const [year, month, day] = asOfDate.split('-').map(Number);
    const reportDate = new Date(year, month - 1, day);
    reportDate.setHours(23, 59, 59, 999); // Include all transactions on this date
    
    // Get tenant name and logo
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true, logoUrl: true }
    });
    
    // Generate current balance sheet using Phase 2 enhanced service
    const currentBalanceSheet = await generateBalanceSheetFromAccounts(
      user.tenantId, 
      asOfDate, 
      tenant?.name || 'Company', 
      tenant?.logoUrl || null,
      user.currentBranchId || null
    );
    
    // Generate previous year balance sheet if requested
    let previousYearBalanceSheet = null;
    if (compareYear) {
      const prevYearDate = new Date(reportDate);
      prevYearDate.setFullYear(prevYearDate.getFullYear() - 1);
      const prevYearAsOfDate = prevYearDate.toISOString().split('T')[0];
      previousYearBalanceSheet = await generateBalanceSheetFromAccounts(
        user.tenantId, 
        prevYearAsOfDate, 
        tenant?.name || 'Company', 
        tenant?.logoUrl || null,
        user.currentBranchId || null
      );
    }
    
    return NextResponse.json({
      ...currentBalanceSheet,
      asOfDate: currentBalanceSheet?.asOfDate || asOfDate,
      previousYear: previousYearBalanceSheet,
      comparisonType: compareYear ? 'previousYear' : null
    });
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta
    });
    return NextResponse.json(
      { 
        error: 'Failed to generate balance sheet. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Generate balance sheet for a given date
 */
export async function generateBalanceSheet(tenantId, asOfDate, companyName = 'Company', logoUrl = null) {
  // Parse the date string properly to avoid timezone issues
  // asOfDate should be in YYYY-MM-DD format
  const [year, month, day] = asOfDate.split('-').map(Number);
  const reportDate = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
  reportDate.setHours(23, 59, 59, 999); // Set to end of day to include all transactions on that date
  
  console.log('Balance Sheet Generation - AsOfDate:', asOfDate, 'ReportDate:', reportDate.toISOString());
  
  // ========== ASSETS SECTION ==========
  const assets = {
    currentAssets: {
      cashAndCashEquivalents: 0,
      accountsReceivable: {
        total: 0,
        items: []
      },
      inventory: {
        total: 0,
        items: []
      },
      prepaidExpenses: 0,
      total: 0
    },
    nonCurrentAssets: {
      propertyPlantEquipment: {
        gross: 0,
        accumulatedDepreciation: 0,
        net: 0,
        items: []
      },
      intangibleAssets: 0,
      otherNonCurrentAssets: 0,
      total: 0
    },
    total: 0
  };
  
  // Calculate cash and cash equivalents as of the report date
  // We calculate this by taking current balances and subtracting transactions that occurred after the report date
  // This gives us the balance as it was on the report date
  
  // Get current account balances
  const accountBalances = await prisma.accountBalance.findMany({
    where: {
      tenantId
    }
  });
  
  const currentCashBalance = accountBalances.reduce(
    (sum, balance) => addMoney(sum, balance.balance), 0
  );
  
  // Calculate net cash flow from transactions AFTER the report date
  // These transactions need to be subtracted to get the historical balance
  const futureInflows = await prisma.payment.aggregate({
    where: {
      tenantId,
      status: 'Completed',
      paymentDate: { gt: reportDate },
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
      paymentDate: { gt: reportDate },
      OR: [
        { expenseId: { not: null } },
        { type: 'Asset Purchase' }
      ]
    },
    _sum: {
      amount: true
    }
  });
  
  // Historical cash = current cash - (future inflows - future outflows)
  // If future net is positive (more inflows than outflows), cash was lower in the past
  // If future net is negative (more outflows than inflows), cash was higher in the past
  const futureNetCashFlow = subtractMoney(futureInflows._sum.amount, futureOutflows._sum.amount);
  assets.currentAssets.cashAndCashEquivalents = Math.max(0, subtractMoney(currentCashBalance, futureNetCashFlow));
  
  // Get accounts receivable (unpaid invoices)
  const accountsReceivable = await prisma.invoice.findMany({
    where: {
      tenantId,
      status: { in: ['Unpaid', 'Pending', 'Partially Paid'] },
      issueDate: { lte: reportDate },
      voidedAt: null,
      refundedAt: null
    },
    include: {
      client: {
        select: {
          name: true
        }
      }
    }
  });
  
  accountsReceivable.forEach(invoice => {
    const balanceDue = parseMoney(invoice.remainingBalance) || subtractMoney(invoice.total, invoice.totalPaid);
    if (balanceDue > 0) {
      assets.currentAssets.accountsReceivable.total = addMoney(
        assets.currentAssets.accountsReceivable.total,
        balanceDue
      );
      assets.currentAssets.accountsReceivable.items.push({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client?.name || 'N/A',
        total: invoice.total,
        paid: invoice.totalPaid || 0,
        balanceDue: balanceDue,
        dueDate: invoice.dueDate
      });
    }
  });
  
  // Get inventory value
  const inventory = await prisma.product.findMany({
    where: {
      tenantId,
      isService: false,
      isDeleted: false
    },
    select: {
      id: true,
      name: true,
      stockLevel: true,
      cost: true
    }
  });
  
  inventory.forEach(product => {
    const productValue = multiplyMoney(product.stockLevel, product.cost);
    if (productValue > 0) {
      assets.currentAssets.inventory.total = addMoney(assets.currentAssets.inventory.total, productValue);
      assets.currentAssets.inventory.items.push({
        id: product.id,
        name: product.name,
        quantity: parseFloat(product.stockLevel) || 0,
        cost: product.cost || 0,
        value: productValue
      });
    }
  });
  
  // Get prepaid expenses (expenses paid in advance)
  const prepaidExpenses = await prisma.expense.findMany({
    where: {
      tenantId,
      date: { gt: reportDate },
      isDeleted: false
    }
  });
  
  // This is a simplified calculation - in practice, prepaid expenses would be tracked differently
  assets.currentAssets.prepaidExpenses = 0; // Placeholder - would need proper tracking
  
  assets.currentAssets.total = 
    assets.currentAssets.cashAndCashEquivalents +
    assets.currentAssets.accountsReceivable.total +
    assets.currentAssets.inventory.total +
    assets.currentAssets.prepaidExpenses;
  
  // Get Property, Plant & Equipment (PPE)
  // Get fixed assets (only those purchased on or before the report date)
  const fixedAssets = await prisma.asset.findMany({
    where: {
      tenantId,
      status: 'active',
      purchaseDate: { lte: reportDate } // Only include assets purchased on or before report date
    },
    include: {
      category: true,
      depreciationSchedules: {
        where: {
          periodEnd: { lte: reportDate }
        },
        orderBy: {
          periodEnd: 'desc'
        },
        take: 1
        }
    }
  });
  
  fixedAssets.forEach(asset => {
    const grossValue = asset.originalCost || 0;
    const accumulatedDepreciation = asset.accumulatedDepreciation || 0;
    const netValue = grossValue - accumulatedDepreciation;
    
    assets.nonCurrentAssets.propertyPlantEquipment.gross += grossValue;
    assets.nonCurrentAssets.propertyPlantEquipment.accumulatedDepreciation += accumulatedDepreciation;
    assets.nonCurrentAssets.propertyPlantEquipment.net += netValue;
    
    assets.nonCurrentAssets.propertyPlantEquipment.items.push({
      id: asset.id,
      name: asset.name,
      category: asset.category?.name || 'N/A',
      originalCost: grossValue,
      accumulatedDepreciation: accumulatedDepreciation,
      netBookValue: netValue,
      purchaseDate: asset.purchaseDate
    });
  });
  
  // Get other non-current assets from accounts
  const nonCurrentAssetAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Asset',
      accountCode: { not: { in: ['1000', '1100', '1200'] } } // Exclude cash, AR, inventory codes
    },
    include: {
      journalEntryLines: {
        where: {
          journalEntry: {
            entryDate: { lte: reportDate },
            status: 'Posted'
          }
        }
      }
    }
  });
  
  nonCurrentAssetAccounts.forEach(account => {
    const balance = account.journalEntryLines.reduce((sum, line) => {
      if (account.normalBalance === 'Debit') {
        return sum + line.debitAmount - line.creditAmount;
      } else {
        return sum + line.creditAmount - line.debitAmount;
      }
    }, 0);
    if (balance > 0) {
      assets.nonCurrentAssets.otherNonCurrentAssets += balance;
    }
  });
  
  assets.nonCurrentAssets.total = 
    assets.nonCurrentAssets.propertyPlantEquipment.net +
    assets.nonCurrentAssets.intangibleAssets +
    assets.nonCurrentAssets.otherNonCurrentAssets;
  
  assets.total = assets.currentAssets.total + assets.nonCurrentAssets.total;
  
  // ========== LIABILITIES SECTION ==========
  const liabilities = {
    currentLiabilities: {
      accountsPayable: {
        total: 0,
        items: []
      },
      shortTermLoans: 0,
      accruedExpenses: 0,
      total: 0
    },
    nonCurrentLiabilities: {
      longTermLoans: 0,
      bondsPayable: 0,
      otherNonCurrentLiabilities: 0,
      total: 0
    },
    total: 0
  };
  
  // Get accounts payable (unpaid expenses)
  const accountsPayable = await prisma.expense.findMany({
    where: {
      tenantId,
      paymentStatus: { in: ['Pending', 'Partially'] },
      date: { lte: reportDate },
      isDeleted: false
    },
    include: {
      submittedBy: {
        select: {
          name: true
        }
      }
    }
  });
  
  accountsPayable.forEach(expense => {
    const amount = parseMoney(expense.amount);
    const paid = parseMoney(expense.paidAmount);
    const balanceDue = subtractMoney(amount, paid);
    if (balanceDue > 0) {
      liabilities.currentLiabilities.accountsPayable.total = addMoney(
        liabilities.currentLiabilities.accountsPayable.total,
        balanceDue
      );
      liabilities.currentLiabilities.accountsPayable.items.push({
        id: expense.id,
        description: expense.description,
        date: expense.date,
        total: amount,
        paid: paid,
        balanceDue: balanceDue,
        merchant: expense.merchant || 'N/A'
      });
    }
  });
  
  // Get accounts payable from supplier bills (purchase module)
  const supplierBills = await prisma.supplierBill.findMany({
    where: {
      tenantId,
      status: { in: ['Unpaid', 'Partially Paid'] },
      billDate: { lte: reportDate }
    },
    include: {
      supplier: {
        select: {
          supplierName: true,
          supplierCode: true
        }
      }
    }
  });
  
  supplierBills.forEach(bill => {
    const total = parseMoney(bill.totalAmount);
    const paid = parseMoney(bill.amountPaid);
    const balanceDue = subtractMoney(total, paid);
    if (balanceDue > 0) {
      liabilities.currentLiabilities.accountsPayable.total = addMoney(
        liabilities.currentLiabilities.accountsPayable.total,
        balanceDue
      );
      liabilities.currentLiabilities.accountsPayable.items.push({
        id: bill.id,
        description: `Supplier Bill ${bill.billNumber}`,
        date: bill.billDate,
        total: total,
        paid: paid,
        balanceDue: balanceDue,
        merchant: bill.supplier?.supplierName || 'N/A'
      });
    }
  });
  
  // Get liabilities from liability management (only those that started on or before the report date)
  const dbLiabilities = await prisma.liability.findMany({
    where: {
      tenantId,
      status: { not: 'paid_off' }, // Only include active liabilities
      startDate: { lte: reportDate } // Only include liabilities that started on or before report date
    }
  });
  
  // Categorize liabilities by type and maturity
  // Track both current balance (for balance sheet) and total amount with interest (for disclosure)
  let totalLiabilitiesWithInterest = 0;
  
  dbLiabilities.forEach(liability => {
    const balance = liability.currentBalance || 0;
    const liabilityType = liability.liabilityType?.toLowerCase() || '';
    const maturityDate = liability.maturityDate ? new Date(liability.maturityDate) : null;
    const isShortTerm = maturityDate && maturityDate <= new Date(reportDate.getTime() + 365 * 24 * 60 * 60 * 1000); // Within 1 year
    
    // Calculate total amount with interest for this liability
    let liabilityTotalWithInterest = balance;
    if (liability.interestRate && liability.interestRate > 0) {
      if (maturityDate) {
        const startDate = new Date(liability.startDate);
        const maturity = new Date(maturityDate);
        const years = Math.max(0, (maturity - startDate) / (1000 * 60 * 60 * 24 * 365));
        const principal = liability.principalAmount || balance;
        const totalInterest = principal * (liability.interestRate / 100) * years;
        // Calculate remaining interest based on remaining principal
        const remainingInterest = balance * (liability.interestRate / 100) * Math.max(0, (maturity - reportDate) / (1000 * 60 * 60 * 24 * 365));
        liabilityTotalWithInterest = balance + remainingInterest;
      } else {
        // If no maturity date, estimate based on remaining balance and 1 year
        const estimatedInterest = balance * (liability.interestRate / 100);
        liabilityTotalWithInterest = balance + estimatedInterest;
      }
    }
    totalLiabilitiesWithInterest += liabilityTotalWithInterest;
    
    if (liabilityType.includes('loan')) {
      if (isShortTerm) {
        liabilities.currentLiabilities.shortTermLoans += balance;
      } else {
        liabilities.nonCurrentLiabilities.longTermLoans += balance;
      }
    } else if (liabilityType.includes('credit') || liabilityType.includes('card')) {
      liabilities.currentLiabilities.shortTermLoans += balance; // Credit cards are typically short-term
    } else if (liabilityType.includes('mortgage')) {
      liabilities.nonCurrentLiabilities.longTermLoans += balance; // Mortgages are long-term
    } else if (liabilityType.includes('bond')) {
      liabilities.nonCurrentLiabilities.bondsPayable += balance;
    } else {
      // Default based on maturity date
      if (isShortTerm) {
        liabilities.currentLiabilities.shortTermLoans += balance;
      } else {
        liabilities.nonCurrentLiabilities.otherNonCurrentLiabilities += balance;
      }
    }
  });
  
  // Get loans and other liabilities from accounts (for backward compatibility)
  const liabilityAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Liability'
    },
    include: {
      journalEntryLines: {
        where: {
          journalEntry: {
            entryDate: { lte: reportDate },
            status: 'Posted'
          }
        }
      }
    }
  });
  
  liabilityAccounts.forEach(account => {
    const balance = account.journalEntryLines.reduce((sum, line) => {
      if (account.normalBalance === 'Credit') {
        return sum + line.creditAmount - line.debitAmount;
      } else {
        return sum + line.debitAmount - line.creditAmount;
      }
    }, 0);
    
    const accountName = (account.accountName || account.name || '').toLowerCase();
    if (accountName.includes('loan') || accountName.includes('debt')) {
      if (accountName.includes('short') || accountName.includes('current')) {
        liabilities.currentLiabilities.shortTermLoans += balance;
      } else {
        liabilities.nonCurrentLiabilities.longTermLoans += balance;
      }
    } else if (accountName.includes('bond')) {
      liabilities.nonCurrentLiabilities.bondsPayable += balance;
    } else if (accountName.includes('accrued') || accountName.includes('payable')) {
      if (!accountName.includes('account')) {
        liabilities.currentLiabilities.accruedExpenses += balance;
      }
    } else {
      // Default to current if not specified
      liabilities.currentLiabilities.accruedExpenses += balance;
    }
  });
  
  liabilities.currentLiabilities.total = 
    liabilities.currentLiabilities.accountsPayable.total +
    liabilities.currentLiabilities.shortTermLoans +
    liabilities.currentLiabilities.accruedExpenses;
  
  liabilities.nonCurrentLiabilities.total = 
    liabilities.nonCurrentLiabilities.longTermLoans +
    liabilities.nonCurrentLiabilities.bondsPayable +
    liabilities.nonCurrentLiabilities.otherNonCurrentLiabilities;
  
  liabilities.total = liabilities.currentLiabilities.total + liabilities.nonCurrentLiabilities.total;
  
  // ========== EQUITY SECTION ==========
  const equity = {
    ownersCapital: 0,
    retainedEarnings: 0,
    currentYearProfitLoss: 0,
    total: 0
  };
  
  // Get equity accounts
  const equityAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Equity'
    },
    include: {
      journalEntryLines: {
        where: {
          journalEntry: {
            entryDate: { lte: reportDate },
            status: 'Posted'
          }
        }
      }
    }
  });
  
  equityAccounts.forEach(account => {
    const balance = account.journalEntryLines.reduce((sum, line) => {
      if (account.normalBalance === 'Credit') {
        return sum + line.creditAmount - line.debitAmount;
      } else {
        return sum + line.debitAmount - line.creditAmount;
      }
    }, 0);
    
    const accountName = (account.accountName || account.name || '').toLowerCase();
    if (accountName.includes('capital') || accountName.includes('share')) {
      equity.ownersCapital += balance;
    } else if (accountName.includes('retained')) {
      equity.retainedEarnings += balance;
    } else {
      equity.ownersCapital += balance; // Default to capital
    }
  });
  
  // Calculate current year profit/loss from income statement (with proper COGS)
  // Use the year of the report date, not the current year
  const reportYear = reportDate.getFullYear();
  const yearStart = new Date(reportYear, 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  
  // Get invoices and sales for the year up to the report date
  const yearInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      issueDate: { gte: yearStart, lte: reportDate },
      status: { in: ['Paid', 'Completed', 'Pending'] },
      voidedAt: null,
      refundedAt: null
    },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });
  
  const yearSales = await prisma.sale.findMany({
    where: {
      tenantId,
      saleDate: { gte: yearStart, lte: reportDate },
      status: 'completed',
      voidedAt: null,
      refundedAt: null
    },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });
  
  // Calculate revenue
  const yearRevenue = addMoney(
    yearInvoices.reduce((sum, inv) => addMoney(sum, inv.total), 0),
    yearSales.reduce((sum, sale) => addMoney(sum, sale.total), 0)
  );
  
  // Calculate COGS
  let yearCOGS = 0;
  yearSales.forEach(sale => {
    sale.items.forEach(item => {
      if (item.productId && item.product && !item.product.isService && item.product.cost) {
        yearCOGS += item.quantity * item.product.cost;
      }
    });
  });
  yearInvoices.forEach(invoice => {
    invoice.items.forEach(item => {
      if (item.productId && item.product && !item.product.isService && item.product.cost) {
        yearCOGS += item.quantity * item.product.cost;
      }
    });
  });
  
  // Get expenses (excluding COGS-related expenses like freight which are already in COGS)
  const yearExpenses = await prisma.expense.findMany({
    where: {
      tenantId,
      date: { gte: yearStart, lte: reportDate },
      isDeleted: false,
      category: { not: { in: ['Freight', 'Shipping', 'Delivery', 'Transport'] } }
    }
  });
  
  const yearExpensesTotal = yearExpenses.reduce((sum, exp) => addMoney(sum, exp.amount), 0);
  
  // Calculate net income for the year
  equity.currentYearProfitLoss = yearRevenue - yearCOGS - yearExpensesTotal;
  
  equity.total = equity.ownersCapital + equity.retainedEarnings + equity.currentYearProfitLoss;
  
  // ========== FINANCIAL RATIOS ==========
  // Quick Ratio = (Cash + Cash Equivalents + Accounts Receivable) ÷ Current Liabilities
  // This represents the most liquid assets that can be quickly converted to cash
  const quickAssets = assets.currentAssets.cashAndCashEquivalents + 
                      (assets.currentAssets.accountsReceivable?.total || 0);
  
  const ratios = {
    currentRatio: assets.currentAssets.total > 0 && liabilities.currentLiabilities.total > 0
      ? assets.currentAssets.total / liabilities.currentLiabilities.total
      : 0,
    quickRatio: quickAssets > 0 && liabilities.currentLiabilities.total > 0
      ? quickAssets / liabilities.currentLiabilities.total
      : 0,
    debtToEquity: equity.total > 0
      ? liabilities.total / equity.total
      : 0
  };
  
  // ========== VERIFICATION ==========
  const totalLiabilitiesAndEquity = liabilities.total + equity.total;
  const isBalanced = Math.abs(assets.total - totalLiabilitiesAndEquity) < 0.01; // Allow for rounding
  
  return {
    companyName,
    logoUrl,
    asOfDate,
    assets,
    liabilities,
    equity,
    totalLiabilitiesAndEquity,
    totalLiabilitiesWithInterest, // Total amount including future interest payments
    isBalanced,
    balanceDifference: assets.total - totalLiabilitiesAndEquity,
    ratios,
    period: {
      yearStart: yearStart.toISOString().split('T')[0],
      asOfDate
    }
  };
}
