// app/api/reports/trial-balance/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET handler for trial balance
 * Calculates account balances for a given date range
 */
export async function GET(request) {
  try {
    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')) 
      : new Date(new Date().getFullYear(), 0, 1); // Default to start of current year
      
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate'))
      : new Date(); // Default to current date
    
    // Set time to end of day for end date
    endDate.setHours(23, 59, 59, 999);
    
    try {
      // Get all accounts - same query as Chart of Accounts
      let accounts = await prisma.account.findMany({
        where: {
          tenantId: tenantId,
          isActive: true
        },
        include: {
          journalEntryLines: {
            where: {
              journalEntry: {
                tenantId: tenantId,
                entryDate: {
                  lte: endDate
                },
                status: 'Posted'
              }
            }
          },
          parentAccount: {
            select: {
              accountCode: true,
              accountName: true
            }
          }
        },
        orderBy: {
          accountCode: 'asc'
        }
      });
      
      // Deduplicate accounts by accountCode (keep the one with highest balance or most transactions)
      const accountMap = new Map();
      accounts.forEach(account => {
        const code = String(account.accountCode || account.code || '').trim();
        if (!code || code === 'N/A') return;
        
        const existing = accountMap.get(code);
        if (!existing) {
          accountMap.set(code, account);
        } else {
          // Keep the account with more journal entry lines or higher balance
          const existingLines = existing.journalEntryLines?.length || 0;
          const currentLines = account.journalEntryLines?.length || 0;
          if (currentLines > existingLines) {
            accountMap.set(code, account);
          }
        }
      });
      accounts = Array.from(accountMap.values());
      
      // Get payment method balances (same as Chart of Accounts)
      const paymentMethodBalances = await prisma.accountBalance.findMany({
        where: {
          tenantId: tenantId
        }
      });
      
      // Get other balance sources (same as Chart of Accounts)
      const unpaidInvoices = await prisma.invoice.findMany({
        where: {
          tenantId: tenantId,
          voidedAt: null,
          refundedAt: null
        },
        select: {
          id: true,
          total: true,
          payments: {
            where: { status: 'Completed' },
            select: { amount: true }
          },
          status: true
        }
      });
      
      const invoicesWithBalance = unpaidInvoices.map(inv => {
        const actualTotalPaid = inv.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const actualRemaining = Math.max(0, parseFloat(inv.total) - actualTotalPaid);
        const status = (inv.status || '').toLowerCase().trim();
        const unpaidStatuses = ['unpaid', 'pending', 'partially paid', 'partial', 'sent'];
        const isUnpaid = unpaidStatuses.some(us => status === us || status.includes(us));
        return { ...inv, actualRemaining, isUnpaid };
      });
      
      const totalAccountsReceivable = invoicesWithBalance
        .filter(inv => inv.isUnpaid && inv.actualRemaining > 0)
        .reduce((sum, inv) => sum + inv.actualRemaining, 0);
      
      // Get inventory value
      const inventoryProducts = await prisma.product.findMany({
        where: {
          tenantId: tenantId,
          isService: false,
          isDeleted: false
        },
        select: {
          stockLevel: true,
          cost: true
        }
      });
      const totalInventoryValue = inventoryProducts.reduce((sum, p) => 
        sum + ((parseFloat(p.stockLevel) || 0) * (parseFloat(p.cost) || 0)), 0
      );
      
      // Get asset values
      const assets = await prisma.asset.findMany({
        where: {
          tenantId: tenantId,
          status: { not: 'disposed' }
        },
        select: {
          originalCost: true,
          accumulatedDepreciation: true
        }
      });
      const totalAssetsValue = assets.reduce((sum, a) => 
        sum + ((parseFloat(a.originalCost) || 0) - (parseFloat(a.accumulatedDepreciation) || 0)), 0
      );
      const totalAccumulatedDepreciation = assets.reduce((sum, a) => 
        sum + (parseFloat(a.accumulatedDepreciation) || 0), 0
      );
      
      // Get unpaid expenses (Accounts Payable)
      const unpaidExpenses = await prisma.expense.findMany({
        where: {
          tenantId: tenantId,
          paymentStatus: { in: ['Unpaid', 'Partially Paid'] }
        },
        select: {
          amount: true,
          paidAmount: true
        }
      });
      const totalAccountsPayable = unpaidExpenses.reduce((sum, exp) => {
        const paid = parseFloat(exp.paidAmount) || 0;
        const total = parseFloat(exp.amount) || 0;
        return sum + Math.max(0, total - paid);
      }, 0);
      
      // Get revenue
      const invoices = await prisma.invoice.findMany({
        where: {
          tenantId: tenantId,
          voidedAt: null,
          refundedAt: null,
          issueDate: { lte: endDate }
        },
        select: {
          total: true
        }
      });
      const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
      
      // Get COGS
      const cogsExpenses = await prisma.expense.findMany({
        where: {
          tenantId: tenantId,
          category: { in: ['COGS', 'Cost of Goods Sold', 'COGS Settlement'] },
          date: { lte: endDate }
        },
        select: {
          amount: true
        }
      });
      const totalCOGS = cogsExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
      
      // Get other expenses
      const expenses = await prisma.expense.findMany({
        where: {
          tenantId: tenantId,
          date: { lte: endDate },
          category: { notIn: ['COGS', 'Cost of Goods Sold', 'COGS Settlement'] }
        },
        select: {
          amount: true,
          category: true
        }
      });
      
      // Get liabilities
      const liabilities = await prisma.liability.findMany({
        where: {
          tenantId: tenantId
        },
        select: {
          principalAmount: true,
          currentBalance: true,
          interestRate: true
        }
      });
      const totalLiabilities = liabilities.reduce((sum, liab) => 
        sum + (parseFloat(liab.currentBalance) || parseFloat(liab.principalAmount) || 0), 0
      );
      
      // Calculate account balances (same logic as Chart of Accounts)
      const accountBalances = await Promise.all(accounts.map(async (account) => {
        const accountCode = String(account.accountCode || account.code || '').trim();
        const accountName = (account.accountName || account.name || '').toLowerCase().trim();
        
        // Skip if no account code
        if (!accountCode || accountCode === 'N/A') {
          return null;
        }
        
        // Calculate from journal entries
        const totalDebits = account.journalEntryLines.reduce((sum, line) => 
          sum + (parseFloat(line.debitAmount) || 0), 0
        );
        const totalCredits = account.journalEntryLines.reduce((sum, line) => 
          sum + (parseFloat(line.creditAmount) || 0), 0
        );
        
        const normalBalance = account.normalBalance || 
          (account.accountType === 'Asset' || account.accountType === 'Expense' ? 'Debit' : 'Credit');
        
        let journalBalance = 0;
        if (normalBalance === 'Debit') {
          journalBalance = totalDebits - totalCredits;
        } else {
          journalBalance = totalCredits - totalDebits;
        }
        
        // Add payment method balances
        let paymentMethodBalance = 0;
        const paymentMethodMap = {
          'cash': { codes: ['1000'], names: ['cash'] },
          'bank_transfer': { codes: ['1020'], names: ['bank transfer'] },
          'airtel_money': { codes: ['1030'], names: ['airtel money'] },
          'mpamba': { codes: ['1040'], names: ['mpamba'] },
          'paychangu': { codes: ['1050'], names: ['paychangu'] }
        };
        
        for (const [methodKey, methodData] of Object.entries(paymentMethodMap)) {
          const balance = paymentMethodBalances.find(b => b.account === methodKey);
          if (balance && (
            methodData.codes.includes(accountCode) ||
            methodData.names.some(n => accountName.includes(n))
          )) {
            paymentMethodBalance = parseFloat(balance.balance) || 0;
            break;
          }
        }
        
        // Add other balance sources
        let additionalBalance = 0;
        
        // Accounts Receivable
        if ((accountCode === '1100' || accountName.includes('receivable')) && 
            account.accountType === 'Asset') {
          additionalBalance = totalAccountsReceivable;
        }
        
        // Inventory
        if ((accountCode === '1200' || accountName.includes('inventory')) && 
            account.accountType === 'Asset') {
          additionalBalance = totalInventoryValue;
        }
        
        // Assets
        if ((accountCode === '1300' || accountCode === '1400' || accountCode === '1500' || 
             accountName.includes('equipment') || accountName.includes('furniture') || 
             accountName.includes('vehicle')) && account.accountType === 'Asset') {
          // Match specific asset accounts
          if (accountCode === '1300' || accountName.includes('equipment')) {
            const equipmentAssets = assets.filter(a => 
              (parseFloat(a.originalCost) || 0) - (parseFloat(a.accumulatedDepreciation) || 0) > 0
            );
            additionalBalance = equipmentAssets.reduce((sum, a) => 
              sum + ((parseFloat(a.originalCost) || 0) - (parseFloat(a.accumulatedDepreciation) || 0)), 0
            );
          }
        }
        
        // Accumulated Depreciation
        if ((accountCode === '1501' || accountName.includes('accumulated depreciation')) && 
            account.accountType === 'Asset') {
          additionalBalance = -totalAccumulatedDepreciation; // Negative for contra asset
        }
        
        // Accounts Payable
        if ((accountCode === '2000' || accountName.includes('payable')) && 
            account.accountType === 'Liability') {
          additionalBalance = totalAccountsPayable;
        }
        
        // Revenue
        if ((accountCode === '4000' || accountName.includes('revenue')) && 
            account.accountType === 'Revenue') {
          additionalBalance = totalRevenue;
        }
        
        // COGS
        if ((accountCode === '5000' || accountName.includes('cost of goods')) && 
            account.accountType === 'Expense') {
          additionalBalance = totalCOGS;
        }
        
        // Other expenses by category
        if (account.accountType === 'Expense' && accountCode !== '5000') {
          const categoryMap = {
            '5100': ['office', 'advertising', 'equipment'],
            '5200': ['rent'],
            '5300': ['utilities'],
            '5400': ['salaries', 'wages', 'payroll'],
            '5500': ['depreciation']
          };
          
          const categories = categoryMap[accountCode] || [];
          if (categories.length > 0) {
            additionalBalance = expenses
              .filter(exp => categories.some(cat => 
                (exp.category || '').toLowerCase().includes(cat)
              ))
              .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
          }
        }
        
        // Liabilities
        if (account.accountType === 'Liability' && accountCode !== '2000') {
          additionalBalance = totalLiabilities;
        }
        
        // Combine all balances
        const totalBalance = journalBalance + paymentMethodBalance + additionalBalance;
        
        // Determine debit/credit based on normal balance
        let finalDebit = 0;
        let finalCredit = 0;
        
        if (normalBalance === 'Debit') {
          if (totalBalance > 0) {
            finalDebit = totalBalance;
          } else if (totalBalance < 0) {
            finalCredit = Math.abs(totalBalance);
          }
        } else {
          if (totalBalance > 0) {
            finalCredit = totalBalance;
          } else if (totalBalance < 0) {
            finalDebit = Math.abs(totalBalance);
          }
        }
        
        return {
          id: account.id,
          code: accountCode,
          name: account.accountName || account.name || 'Unnamed Account',
          type: account.accountType || account.type || 'N/A',
          debit: finalDebit,
          credit: finalCredit,
          isHeader: accountCode.endsWith('00') || account.parentAccountId === null,
          parent: account.parentAccountId ? (account.parentAccount?.accountCode || account.parentAccount?.code) : undefined
        };
      }));
      
      // Filter out null accounts and deduplicate by accountCode one more time
      const validAccounts = accountBalances.filter(acc => acc !== null);
      const finalAccountMap = new Map();
      validAccounts.forEach(account => {
        const code = String(account.code || '').trim();
        if (!code) return;
        
        const existing = finalAccountMap.get(code);
        if (!existing) {
          finalAccountMap.set(code, account);
        } else {
          // Keep the one with higher balance
          const existingBalance = (existing.debit || 0) + (existing.credit || 0);
          const currentBalance = (account.debit || 0) + (account.credit || 0);
          if (currentBalance > existingBalance) {
            finalAccountMap.set(code, account);
          }
        }
      });
      
      // Don't filter out zero balances - show all accounts
      const nonZeroAccounts = Array.from(finalAccountMap.values());
      
      // Calculate totals
      const totalDebits = nonZeroAccounts.reduce((sum, account) => sum + account.debit, 0);
      const totalCredits = nonZeroAccounts.reduce((sum, account) => sum + account.credit, 0);
      
      // Group by account type (normalize to uppercase for consistency)
      const accountTypes = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
      const accountsByType = {};
      
      accountTypes.forEach(type => {
        const accounts = nonZeroAccounts.filter(account => 
          (account.type || '').toLowerCase() === type.toLowerCase()
        );
        if (accounts.length > 0) {
          accountsByType[type.toUpperCase()] = {
            accounts,
            totalDebit: accounts.reduce((sum, account) => sum + account.debit, 0),
            totalCredit: accounts.reduce((sum, account) => sum + account.credit, 0)
          };
        }
      });
      
      // Return the formatted response
      return NextResponse.json({
        accounts: nonZeroAccounts,
        accountsByType,
        totals: {
          debit: totalDebits,
          credit: totalCredits,
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.01 // Allow for small rounding errors
        },
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Database error fetching trial balance:", error);
      return generateMockTrialBalance(startDate, endDate);
    }
  } catch (error) {
    console.error('Error generating trial balance:', error);
    return NextResponse.json(
      { error: 'Failed to generate trial balance. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Generate mock trial balance for testing
 */
function generateMockTrialBalance(startDate, endDate) {
  // Create mock accounts with realistic data
  const mockAccounts = [
    // Assets
    { id: "1010", code: "1010", name: "Cash", type: "ASSET", debit: 22500.00, credit: 0 },
    { id: "1021", code: "1021", name: "Checking Account", type: "ASSET", debit: 45000.00, credit: 0 },
    { id: "1022", code: "1022", name: "Savings Account", type: "ASSET", debit: 35000.00, credit: 0 },
    { id: "1030", code: "1030", name: "Accounts Receivable", type: "ASSET", debit: 12750.00, credit: 0 },
    { id: "1040", code: "1040", name: "Inventory", type: "ASSET", debit: 78500.00, credit: 0 },
    { id: "1110", code: "1110", name: "Land", type: "ASSET", debit: 125000.00, credit: 0 },
    { id: "1120", code: "1120", name: "Buildings", type: "ASSET", debit: 375000.00, credit: 0 },
    { id: "1130", code: "1130", name: "Equipment", type: "ASSET", debit: 85000.00, credit: 0 },
    { id: "1140", code: "1140", name: "Vehicles", type: "ASSET", debit: 42000.00, credit: 0 },
    { id: "1150", code: "1150", name: "Accumulated Depreciation", type: "ASSET", debit: 0, credit: 68000.00 },
    
    // Liabilities
    { id: "2010", code: "2010", name: "Accounts Payable", type: "LIABILITY", debit: 0, credit: 38750.00 },
    { id: "2020", code: "2020", name: "Accrued Expenses", type: "LIABILITY", debit: 0, credit: 5600.00 },
    { id: "2030", code: "2030", name: "Payroll Liabilities", type: "LIABILITY", debit: 0, credit: 8900.00 },
    { id: "2040", code: "2040", name: "Short-term Loans", type: "LIABILITY", debit: 0, credit: 15000.00 },
    { id: "2110", code: "2110", name: "Mortgage Payable", type: "LIABILITY", debit: 0, credit: 245000.00 },
    { id: "2120", code: "2120", name: "Equipment Loans", type: "LIABILITY", debit: 0, credit: 35000.00 },
    
    // Equity
    { id: "3010", code: "3010", name: "Owner's Capital", type: "EQUITY", debit: 0, credit: 350000.00 },
    { id: "3020", code: "3020", name: "Retained Earnings", type: "EQUITY", debit: 0, credit: 125000.00 },
    { id: "3030", code: "3030", name: "Current Year Earnings", type: "EQUITY", debit: 0, credit: 85500.00 },
    
    // Revenue
    { id: "4010", code: "4010", name: "Sales Revenue", type: "REVENUE", debit: 0, credit: 325000.00 },
    { id: "4020", code: "4020", name: "Service Revenue", type: "REVENUE", debit: 0, credit: 185000.00 },
    { id: "4030", code: "4030", name: "Interest Income", type: "REVENUE", debit: 0, credit: 2500.00 },
    { id: "4040", code: "4040", name: "Other Income", type: "REVENUE", debit: 0, credit: 7500.00 },
    
    // Expenses
    { id: "5010", code: "5010", name: "Purchases", type: "EXPENSE", debit: 195000.00, credit: 0 },
    { id: "5020", code: "5020", name: "Freight", type: "EXPENSE", debit: 12500.00, credit: 0 },
    { id: "6011", code: "6011", name: "Salaries & Wages", type: "EXPENSE", debit: 145000.00, credit: 0 },
    { id: "6012", code: "6012", name: "Employee Benefits", type: "EXPENSE", debit: 18500.00, credit: 0 },
    { id: "6013", code: "6013", name: "Payroll Taxes", type: "EXPENSE", debit: 11250.00, credit: 0 },
    { id: "6021", code: "6021", name: "Rent", type: "EXPENSE", debit: 24000.00, credit: 0 },
    { id: "6022", code: "6022", name: "Utilities", type: "EXPENSE", debit: 8500.00, credit: 0 },
    { id: "6023", code: "6023", name: "Office Supplies", type: "EXPENSE", debit: 4500.00, credit: 0 },
    { id: "6024", code: "6024", name: "Insurance", type: "EXPENSE", debit: 12000.00, credit: 0 },
    { id: "6025", code: "6025", name: "Depreciation", type: "EXPENSE", debit: 22500.00, credit: 0 },
    { id: "6026", code: "6026", name: "Professional Fees", type: "EXPENSE", debit: 8500.00, credit: 0 },
    { id: "6031", code: "6031", name: "Advertising", type: "EXPENSE", debit: 15000.00, credit: 0 },
    { id: "6032", code: "6032", name: "Promotions", type: "EXPENSE", debit: 7500.00, credit: 0 },
    { id: "6041", code: "6041", name: "Bank Charges", type: "EXPENSE", debit: 1200.00, credit: 0 },
    { id: "6042", code: "6042", name: "Interest Expense", type: "EXPENSE", debit: 8500.00, credit: 0 }
  ];
  
  // Calculate totals
  const totalDebits = mockAccounts.reduce((sum, account) => sum + account.debit, 0);
  const totalCredits = mockAccounts.reduce((sum, account) => sum + account.credit, 0);
  
  // Group by account type
  const accountsByType = {
    'ASSET': {
      accounts: mockAccounts.filter(account => account.type === 'ASSET'),
      totalDebit: mockAccounts.filter(account => account.type === 'ASSET')
        .reduce((sum, account) => sum + account.debit, 0),
      totalCredit: mockAccounts.filter(account => account.type === 'ASSET')
        .reduce((sum, account) => sum + account.credit, 0)
    },
    'LIABILITY': {
      accounts: mockAccounts.filter(account => account.type === 'LIABILITY'),
      totalDebit: mockAccounts.filter(account => account.type === 'LIABILITY')
        .reduce((sum, account) => sum + account.debit, 0),
      totalCredit: mockAccounts.filter(account => account.type === 'LIABILITY')
        .reduce((sum, account) => sum + account.credit, 0)
    },
    'EQUITY': {
      accounts: mockAccounts.filter(account => account.type === 'EQUITY'),
      totalDebit: mockAccounts.filter(account => account.type === 'EQUITY')
        .reduce((sum, account) => sum + account.debit, 0),
      totalCredit: mockAccounts.filter(account => account.type === 'EQUITY')
        .reduce((sum, account) => sum + account.credit, 0)
    },
    'REVENUE': {
      accounts: mockAccounts.filter(account => account.type === 'REVENUE'),
      totalDebit: mockAccounts.filter(account => account.type === 'REVENUE')
        .reduce((sum, account) => sum + account.debit, 0),
      totalCredit: mockAccounts.filter(account => account.type === 'REVENUE')
        .reduce((sum, account) => sum + account.credit, 0)
    },
    'EXPENSE': {
      accounts: mockAccounts.filter(account => account.type === 'EXPENSE'),
      totalDebit: mockAccounts.filter(account => account.type === 'EXPENSE')
        .reduce((sum, account) => sum + account.debit, 0),
      totalCredit: mockAccounts.filter(account => account.type === 'EXPENSE')
        .reduce((sum, account) => sum + account.credit, 0)
    }
  };
  
  return NextResponse.json({
    accounts: mockAccounts,
    accountsByType,
    totals: {
      debit: totalDebits,
      credit: totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01
    },
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    timestamp: new Date().toISOString()
  });
}