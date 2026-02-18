// app/api/chart-of-accounts/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

const isFinanceAdmin = (user) => {
  const roleName = user?.role?.name?.toLowerCase() || '';
  return roleName.includes('finance') || roleName.includes('admin') || roleName === 'master_admin';
};

const normalizeAccountType = (value) => {
  if (!value) return value;
  const normalized = value.toString().trim();
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return ACCOUNT_TYPES.includes(upper) ? upper : normalized;
};

const validateAccountCode = (code) => /^\d{3,10}$/.test(code || '');

// GET - List all accounts with filtering and search
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    if (!isFinanceAdmin(user)) {
      return NextResponse.json(
        { error: 'Access denied. Finance or Admin role required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('accountType');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where = {
      tenantId: user.tenantId
    };

    if (accountType && accountType !== 'All') {
      where.accountType = normalizeAccountType(accountType);
    }

    if (isActive === 'true' || (!includeInactive && isActive !== 'false')) {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { accountCode: { contains: search, mode: 'insensitive' } },
        { accountName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    let accounts = [];
    try {
      accounts = await prisma.account.findMany({
        where,
        include: {
          parentAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          },
          childAccounts: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              isActive: true,
              isSystem: true
            }
          },
          _count: {
            select: {
              journalEntryLines: true,
              transactionLines: true
            }
          }
        },
        orderBy: [
          { accountCode: 'asc' }
        ]
      });
    } catch (error) {
      console.error('Error fetching accounts:', error);
      // Return empty array if accounts query fails
      return NextResponse.json({
        accounts: [],
        total: 0,
        error: 'Failed to fetch accounts'
      });
    }


    // Get other balance sources
    // Accounts Receivable from unpaid invoices
    // IMPORTANT: Always filter by tenantId to ensure data isolation
    console.log('🔒 Tenant Isolation Check:', {
      userTenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email
    });
    
    // Fetch invoices with their actual payments to calculate accurate remaining balance
    let allInvoices = [];
    try {
      allInvoices = await prisma.invoice.findMany({
        where: {
          tenantId: user.tenantId, // CRITICAL: Filter by tenant ID
          voidedAt: null,
          refundedAt: null
        },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          totalPaid: true,
          remainingBalance: true,
          status: true,
          issueDate: true,
          dueDate: true,
          payments: {
            where: {
              status: 'Completed'
            },
            select: {
              amount: true,
              status: true
            }
          }
        },
        orderBy: {
          issueDate: 'desc'
        }
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
    
    // Calculate actual remaining balance from payments (more accurate than stored fields)
    const invoicesWithActualBalance = allInvoices.map(inv => {
      // Calculate total paid from actual completed payments
      const actualTotalPaid = inv.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      
      // Calculate actual remaining balance
      const actualRemaining = Math.max(0, parseFloat(inv.total) - actualTotalPaid);
      
      return {
        ...inv,
        actualTotalPaid,
        actualRemaining,
        storedRemainingBalance: inv.remainingBalance,
        storedTotalPaid: inv.totalPaid
      };
    });
    
    // Log all invoice statuses to see what we're working with
    const statusCounts = {};
    invoicesWithActualBalance.forEach(inv => {
      statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
    });
    console.log('📊 All Invoice Statuses:', statusCounts);
    
    // Filter for unpaid invoices - VERY STRICT: Only count invoices that are clearly unpaid
    // If user says they have no pending invoices, this should return 0
    const unpaidInvoices = invoicesWithActualBalance.filter(inv => {
      const status = (inv.status || '').toLowerCase().trim();
      const remaining = inv.actualRemaining; // Use calculated remaining balance from payments
      
      // STRICT: Exclude ALL of these statuses (these are NOT accounts receivable)
      const excludedStatuses = [
        'paid', 
        'completed', 
        'void', 
        'refunded',
        'fully refunded',
        'draft',
        'cancelled',
        'closed'
      ];
      
      if (excludedStatuses.includes(status)) {
        return false;
      }
      
      // STRICT: Only include if status EXACTLY matches unpaid statuses
      // AND there's actually a remaining balance > 0
      const unpaidStatuses = [
        'unpaid',
        'pending',
        'partially paid',
        'partial',
        'sent'
      ];
      
      const isUnpaidStatus = unpaidStatuses.some(us => status === us || status.includes(us));
      
      // Must have unpaid status AND remaining balance > 0
      return isUnpaidStatus && remaining > 0;
    });
    
    const totalAccountsReceivable = unpaidInvoices.reduce((sum, inv) => {
      return sum + Math.max(0, inv.actualRemaining); // Use actual calculated remaining
    }, 0);
    
    // Log Accounts Receivable details with tenant verification
    console.log('📋 Accounts Receivable Calculation:', {
      tenantId: user.tenantId, // Verify tenant isolation
      totalInvoices: invoicesWithActualBalance.length,
      unpaidInvoices: unpaidInvoices.length,
      totalAccountsReceivable,
      invoices: unpaidInvoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        total: inv.total,
        storedTotalPaid: inv.storedTotalPaid || 0,
        actualTotalPaid: inv.actualTotalPaid,
        storedRemainingBalance: inv.storedRemainingBalance,
        actualRemaining: inv.actualRemaining,
        status: inv.status,
        paymentCount: inv.payments.length
      })),
      // Show ALL invoices for debugging
      allInvoices: invoicesWithActualBalance.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        total: inv.total,
        storedTotalPaid: inv.storedTotalPaid || 0,
        actualTotalPaid: inv.actualTotalPaid,
        storedRemainingBalance: inv.storedRemainingBalance,
        actualRemaining: inv.actualRemaining,
        isIncluded: unpaidInvoices.some(u => u.id === inv.id),
        reason: (() => {
          const s = (inv.status || '').toLowerCase();
          const r = inv.actualRemaining;
          if (s === 'paid' || s === 'completed') return 'Status is Paid/Completed';
          if (s === 'void') return 'Invoice is Voided';
          if (s === 'refunded') return 'Invoice is Refunded';
          if (s === 'draft') return 'Invoice is Draft';
          if (r <= 0) return 'No remaining balance';
          if (!s.includes('unpaid') && !s.includes('pending') && !s.includes('partial') && s !== 'sent') {
            return `Status "${inv.status}" not recognized as unpaid`;
          }
          return 'Should be included';
        })()
      }))
    });
    
    // Verify tenant isolation - check if any invoices belong to different tenants
    if (invoicesWithActualBalance.length > 0) {
      const invoicesWithTenant = await prisma.invoice.findMany({
        where: {
          id: { in: invoicesWithActualBalance.map(inv => inv.id) }
        },
        select: {
          id: true,
          invoiceNumber: true,
          tenantId: true
        }
      });
      
      const wrongTenantInvoices = invoicesWithTenant.filter(inv => inv.tenantId !== user.tenantId);
      if (wrongTenantInvoices.length > 0) {
        console.error('🚨 SECURITY ISSUE: Found invoices from other tenants!', wrongTenantInvoices);
      } else {
        console.log('✅ Tenant isolation verified: All invoices belong to tenant', user.tenantId);
      }
    }

    // Inventory value from products
    let inventoryProducts = [];
    try {
      inventoryProducts = await prisma.product.findMany({
        where: {
          tenantId: user.tenantId,
          isService: false,
          isDeleted: false
        },
        select: {
          stockLevel: true,
          cost: true
        }
      });
    } catch (error) {
      console.error('Error fetching inventory products:', error);
    }
    const totalInventoryValue = inventoryProducts.reduce((sum, product) => {
      const qty = parseFloat(product.stockLevel) || 0;
      const cost = parseFloat(product.cost) || 0;
      const productValue = qty * cost;
      return sum + productValue;
    }, 0);
    
    // Debug logging
    console.log('Inventory calculation:', {
      productCount: inventoryProducts.length,
      totalInventoryValue,
      sampleProducts: inventoryProducts.slice(0, 3).map(p => ({
        stockLevel: p.stockLevel,
        cost: p.cost,
        value: (parseFloat(p.stockLevel) || 0) * (parseFloat(p.cost) || 0)
      }))
    });

    // Assets from Asset model
    let assets = [];
    try {
      assets = await prisma.asset.findMany({
        where: {
          tenantId: user.tenantId,
          status: { not: 'disposed' }
        },
        include: {
          category: true,
          depreciationSchedules: {
            where: {
              periodEnd: { lte: new Date() }
            },
            orderBy: {
              periodEnd: 'desc'
            },
            take: 1 // Get the most recent schedule for accumulated depreciation
          }
        }
      });
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
    const totalAssetsValue = assets.reduce((sum, asset) => {
      const grossValue = parseFloat(asset.originalCost) || 0;
      // Use accumulatedDepreciation field directly, or from most recent schedule
      const accumulatedDep = asset.accumulatedDepreciation || 
        (asset.depreciationSchedules.length > 0 
          ? parseFloat(asset.depreciationSchedules[0].accumulatedDepreciation) || 0 
          : 0);
      return sum + (grossValue - accumulatedDep);
    }, 0);

    // Accounts Payable from unpaid expenses
    let unpaidExpenses = [];
    try {
      unpaidExpenses = await prisma.expense.findMany({
        where: {
          tenantId: user.tenantId,
          paymentStatus: { in: ['Pending', 'Partially'] },
          isDeleted: false
        },
        select: {
          amount: true,
          paidAmount: true
        }
      });
    } catch (error) {
      console.error('Error fetching unpaid expenses:', error);
    }
    let totalAccountsPayable = unpaidExpenses.reduce((sum, exp) => {
      const paid = parseFloat(exp.paidAmount) || 0;
      const total = parseFloat(exp.amount) || 0;
      return sum + (total - paid);
    }, 0);
    
    // Add supplier bills (from purchase module) to Accounts Payable
    let unpaidSupplierBills = [];
    try {
      unpaidSupplierBills = await prisma.supplierBill.findMany({
        where: {
          tenantId: user.tenantId,
          status: { in: ['Unpaid', 'Partially Paid'] }
        },
        select: {
          totalAmount: true,
          amountPaid: true
        }
      });
    } catch (error) {
      console.error('Error fetching supplier bills:', error);
    }
    const supplierBillsPayable = unpaidSupplierBills.reduce((sum, bill) => {
      const paid = parseFloat(bill.amountPaid) || 0;
      const total = parseFloat(bill.totalAmount) || 0;
      return sum + Math.max(0, total - paid);
    }, 0);
    totalAccountsPayable += supplierBillsPayable;

    // Revenue from invoices and sales
    let invoices = [];
    let sales = [];
    try {
      invoices = await prisma.invoice.findMany({
        where: {
          tenantId: user.tenantId,
          voidedAt: null,
          refundedAt: null
        },
        select: {
          total: true,
          status: true
        }
      });
    } catch (error) {
      console.error('Error fetching invoices for revenue:', error);
    }
    
    try {
      sales = await prisma.sale.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'completed'
        },
        select: {
          total: true
        }
      });
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
    const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0) +
                        sales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);

    // COGS from expenses with category 'COGS' or 'Cost of Goods Sold'
    let cogsExpenses = [];
    try {
      cogsExpenses = await prisma.expense.findMany({
        where: {
          tenantId: user.tenantId,
          category: { in: ['COGS', 'Cost of Goods Sold', 'COGS Settlement'] },
          isDeleted: false
        },
        select: {
          amount: true
        }
      });
    } catch (error) {
      console.error('Error fetching COGS expenses:', error);
    }
    const totalCOGS = cogsExpenses.reduce((sum, exp) => sum + (parseFloat(exp?.amount) || 0), 0);

    // Expenses by category
    let expensesByCategory = [];
    try {
      expensesByCategory = await prisma.expense.groupBy({
        by: ['category'],
        where: {
          tenantId: user.tenantId,
          isDeleted: false,
          category: { not: null }
        },
        _sum: {
          amount: true
        }
      });
    } catch (error) {
      console.error('Error grouping expenses by category:', error);
      // If groupBy fails, try to get expenses and group manually
      const allExpenses = await prisma.expense.findMany({
        where: {
          tenantId: user.tenantId,
          isDeleted: false
        },
        select: {
          category: true,
          amount: true
        }
      });
      
      // Manual grouping
      const categoryMap = new Map();
      allExpenses.forEach(exp => {
        const cat = exp.category || 'Other';
        const current = categoryMap.get(cat) || 0;
        categoryMap.set(cat, current + (parseFloat(exp.amount) || 0));
      });
      
      expensesByCategory = Array.from(categoryMap.entries()).map(([category, amount]) => ({
        category,
        _sum: { amount }
      }));
    }

    // Payroll expenses
    let payrolls = [];
    try {
      payrolls = await prisma.payroll.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'processed'
        },
        select: {
          grossPay: true,
          basicSalary: true,
          additions: true,
          deductions: true,
          payeAmount: true,
          totalNpsAmount: true
        }
      });
    } catch (error) {
      console.error('Error fetching payrolls:', error);
    }
    const totalPayrollExpense = payrolls.reduce((sum, payroll) => {
      const gross = parseFloat(payroll.grossPay) || parseFloat(payroll.basicSalary) || 0;
      const additions = parseFloat(payroll.additions) || 0;
      return sum + gross + additions;
    }, 0);

    // Tax Payable from payroll (PAYE + NPS)
    const totalTaxPayable = payrolls.reduce((sum, payroll) => {
      const paye = parseFloat(payroll.payeAmount) || 0;
      const nps = parseFloat(payroll.totalNpsAmount) || 0;
      return sum + paye + nps;
    }, 0);

    // Liabilities from Liability model
    let liabilities = [];
    try {
      liabilities = await prisma.liability.findMany({
        where: {
          tenantId: user.tenantId,
          status: { not: 'paid_off' }
        },
        select: {
          principalAmount: true,
          interestRate: true,
          startDate: true,
          currentBalance: true,
          totalPaid: true,
          liabilityType: true
        }
      });
    } catch (error) {
      console.error('Error fetching liabilities:', error);
    }
    const totalLiabilities = liabilities.reduce((sum, liab) => {
      return sum + (parseFloat(liab.currentBalance) || parseFloat(liab.principalAmount) || 0);
    }, 0);

    // Accumulated Depreciation from assets
    const totalAccumulatedDepreciation = assets.reduce((sum, asset) => {
      return sum + (parseFloat(asset.accumulatedDepreciation) || 0);
    }, 0);

    // Calculate Retained Earnings (Profit/Loss)
    // Revenue - COGS - Operating Expenses - Payroll - Other Expenses
    const totalOperatingExpenses = expensesByCategory
      .filter(e => e?.category && !['COGS', 'Cost of Goods Sold', 'COGS Settlement'].includes(e.category))
      .reduce((sum, exp) => {
        const amount = exp?._sum?.amount || exp?.amount || 0;
        return sum + (parseFloat(amount) || 0);
      }, 0);
    
    const netIncome = totalRevenue - totalCOGS - totalOperatingExpenses - totalPayrollExpense;
    
    // Summary logging
    console.log('📊 Chart of Accounts Data Summary:', {
      totalInventoryValue,
      totalAccountsReceivable,
      totalAssetsValue,
      totalAccountsPayable,
      totalRevenue,
      totalCOGS,
      totalPayrollExpense,
      totalTaxPayable,
      totalLiabilities,
      totalAccumulatedDepreciation,
      netIncome,
      expensesByCategory: expensesByCategory.map(e => ({ 
        category: e?.category || 'Unknown', 
        amount: e?._sum?.amount || e?.amount || 0 
      })),
      assetCount: assets.length,
      liabilityCount: liabilities.length,
      payrollCount: payrolls.length
    });

    // Calculate current balances from journal entries
    // Wrap in try-catch to handle any individual account calculation errors
    const accountsWithBalances = await Promise.allSettled(accounts.map(async (account) => {
      try {
        // Get all journal entry lines for this account (both Posted and Draft)
        const allJournalLines = await prisma.journalEntryLine.findMany({
          where: {
            accountId: account.id,
            journalEntry: {
              tenantId: user.tenantId
            }
          },
          include: {
            journalEntry: {
              select: {
                status: true
              }
            }
          }
        });

        // Separate Posted and Draft entries
        const postedLines = allJournalLines.filter(line => line.journalEntry?.status === 'Posted');
        const draftLines = allJournalLines.filter(line => line.journalEntry?.status === 'Draft');

        // Calculate totals from Posted entries only
        const totalDebits = postedLines.reduce((sum, line) => {
          const debit = parseFloat(line.debitAmount) || 0;
          return sum + debit;
        }, 0);
        
        const totalCredits = postedLines.reduce((sum, line) => {
          const credit = parseFloat(line.creditAmount) || 0;
          return sum + credit;
        }, 0);

        // Determine normal balance - use account.normalBalance or infer from account type
        const normalBalance = account.normalBalance || 
          (account.accountType === 'Asset' || account.accountType === 'Expense' ? 'Debit' : 'Credit');

        // Calculate balance based on normal balance
        let balance = 0;
        if (normalBalance === 'Debit') {
          balance = totalDebits - totalCredits;
        } else {
          balance = totalCredits - totalDebits;
        }

        const accountCode = String(account.accountCode || account.code || '').trim();
        const accountName = (account.accountName || account.name || '').toLowerCase().trim();
        const accountType = (account.accountType || account.type || '').trim().toUpperCase();

        // Add balances from other sources based on account type and name
        let additionalBalance = 0;
        
        // Accounts Receivable (code 1100 or name contains "receivable")
        // IMPORTANT: Use ONLY unpaid invoices, NOT journal entries (to avoid double-counting payments)
        if ((accountCode === '1100' || accountName.includes('receivable')) && 
            (accountType === 'ASSET' || accountType === 'Asset')) {
          // For AR, use ONLY the unpaid invoices calculation, ignore journal entries
          balance = Math.max(0, totalAccountsReceivable); // Ensure it's never negative
          additionalBalance = 0; // Don't add to journal balance, replace it
          console.log(`✅ Matched AR account: ${accountCode} - ${account.accountName || account.name}, value: ${totalAccountsReceivable}`);
        }
        
        // Inventory (code 1200 or name contains "inventory")
        // Check both accountCode and account name variations
        const isInventoryAccount = accountCode === '1200' || 
                                   accountCode.startsWith('1200') ||
                                   accountName.includes('inventory') ||
                                   accountName === 'inventory';
        
        if (isInventoryAccount && (accountType === 'ASSET' || accountType === 'Asset')) {
          additionalBalance += totalInventoryValue;
          console.log(`✅ Matched inventory account: ${accountCode} - ${account.accountName || account.name}, value: ${totalInventoryValue}`);
        } else if (isInventoryAccount) {
          console.log(`⚠️ Inventory account ${accountCode} - ${account.accountName || account.name} type mismatch: ${accountType} (expected ASSET)`);
        }
        
        // Assets/Equipment/Furniture/Vehicles (non-current assets)
        // Match by account code ranges (1300-1599 for assets) or by name
        const accountCodeNum = parseInt(accountCode) || 0;
        const isAssetAccount = (accountType === 'ASSET' || accountType === 'Asset') && (
          (accountCodeNum >= 1300 && accountCodeNum <= 1599) ||
          accountName.includes('equipment') || 
          accountName.includes('furniture') || 
          accountName.includes('vehicle') ||
          (accountName.includes('asset') && !accountName.includes('receivable'))
        );
        
        if (isAssetAccount) {
          // Try to match asset category to account name or code
          const matchingAssets = assets.filter(asset => {
            const categoryName = (asset.category?.name || '').toLowerCase();
            const assetName = (asset.name || '').toLowerCase();
            
            // Match by category name
            if (accountName.includes(categoryName) || categoryName.includes(accountName)) {
              return true;
            }
            
            // Match by asset name
            if (accountName.includes(assetName) || assetName.includes(accountName)) {
              return true;
            }
            
            // Match by account code ranges
            // 1300 = Equipment, 1400 = Furniture, 1500 = Vehicles
            if (accountCode === '1300' && categoryName.includes('equipment')) return true;
            if (accountCode === '1400' && categoryName.includes('furniture')) return true;
            if (accountCode === '1500' && (categoryName.includes('vehicle') || categoryName.includes('car'))) return true;
            
            return false;
          });
          
          // Sum all matching assets
          matchingAssets.forEach(assetMatch => {
            const grossValue = parseFloat(assetMatch.originalCost) || 0;
            // Use accumulatedDepreciation field directly, or from most recent schedule
            const accumulatedDep = assetMatch.accumulatedDepreciation || 
              (assetMatch.depreciationSchedules && assetMatch.depreciationSchedules.length > 0
                ? parseFloat(assetMatch.depreciationSchedules[0].accumulatedDepreciation) || 0
                : 0);
            const netValue = grossValue - accumulatedDep;
            additionalBalance += netValue;
            console.log(`Matched asset: ${assetMatch.name} to account ${accountCode}, net value: ${netValue}`);
          });
          
          if (matchingAssets.length === 0 && assets.length > 0) {
            console.log(`No assets matched for account ${accountCode} - ${account.accountName || account.name}. Available assets:`, 
              assets.map(a => ({ name: a.name, category: a.category?.name })));
          }
        }
        
        // Accounts Payable (code 2000 or name contains "payable")
        if ((accountCode === '2000' || accountName.includes('payable')) && 
            accountType === 'Liability' && !accountName.includes('tax')) {
          additionalBalance += totalAccountsPayable;
        }

        // Tax Payable (code 2040 or name contains "tax payable")
        if ((accountCode === '2040' || (accountName.includes('tax') && accountName.includes('payable'))) && 
            accountType === 'Liability') {
          additionalBalance += totalTaxPayable;
        }

        // Liabilities/Loans (code 2050-2100 or name contains "loan" or "liability")
        if ((accountCodeNum >= 2050 && accountCodeNum <= 2100) || 
            (accountName.includes('loan') || (accountName.includes('liability') && !accountName.includes('payable')))) {
          if (accountType === 'Liability') {
            // Match by liability type
            const matchingLiabilities = liabilities.filter(liab => {
              const liabType = (liab.liabilityType || '').toLowerCase();
              if (accountName.includes('short') && liabType.includes('short')) return true;
              if (accountName.includes('long') && liabType.includes('long')) return true;
              if (accountName.includes('loan') && liabType.includes('loan')) return true;
              return false;
            });
            matchingLiabilities.forEach(liab => {
              additionalBalance += (parseFloat(liab.currentBalance) || parseFloat(liab.principalAmount) || 0);
            });
          }
        }

        // Revenue (code 4000 or name contains "revenue" or "income")
        // Only add to the main revenue account (4000) to avoid double-counting
        const isRevenueAccount = accountCode === '4000' && 
            (accountType === 'REVENUE' || accountType === 'Revenue' || accountType === 'INCOME' || accountType === 'Income') &&
            (accountName.includes('revenue') || accountName.includes('sales') || 
             accountName.includes('income'));
        
        if (isRevenueAccount) {
          additionalBalance += totalRevenue;
          console.log(`✅ Matched revenue account: ${accountCode} - ${account.accountName || account.name}, value: ${totalRevenue}`);
        } else if (accountCode === '4000') {
          console.log(`⚠️ Revenue account ${accountCode} - ${account.accountName || account.name} type mismatch: ${accountType} (expected REVENUE/INCOME)`);
        }

        // COGS (code 5000 or name contains "cogs" or "cost of goods")
        const isCOGSAccount = (accountCode === '5000' || accountCode.startsWith('5000') ||
             accountName.includes('cogs') || 
             accountName.includes('cost of goods')) && 
            (accountType === 'EXPENSE' || accountType === 'Expense');
        
        if (isCOGSAccount) {
          additionalBalance += totalCOGS;
          console.log(`✅ Matched COGS account: ${accountCode} - ${account.accountName || account.name}, value: ${totalCOGS}`);
        }

        // Salaries Expense (code 5400 or name contains "salaries" or "wages")
        if ((accountCode === '5400' || accountCode.startsWith('5400') ||
             accountName.includes('salaries') || 
             accountName.includes('wages')) && 
            (accountType === 'EXPENSE' || accountType === 'Expense')) {
          additionalBalance += totalPayrollExpense;
          console.log(`✅ Matched salaries account: ${accountCode} - ${account.accountName || account.name}, value: ${totalPayrollExpense}`);
        }

        // Expense category to account mapping
        // Map expense categories to their corresponding accounts
        const expenseCategoryMap = {
          // Office Expenses (5100)
          'office': '5100',
          'office supplies': '5100',
          'supplies': '5100',
          'office expenses': '5100',
          
          // Rent Expense (5200)
          'rent': '5200',
          'rent expense': '5200',
          
          // Utilities Expense (5300)
          'utilities': '5300',
          'utilities expense': '5300',
          'electricity': '5300',
          'water': '5300',
          'internet': '5300',
          'phone': '5300',
          
          // Marketing/Advertising (could be 5100 or separate)
          'advertising': '5100', // Map to Office Expenses for now, or create 6050
          'marketing': '5100',
          'marketing & advertising': '5100',
          
          // Equipment (could be expense or asset - if expense, map to 5100)
          'equipment': '5100', // If it's an expense, not an asset purchase
          'equipment expense': '5100',
          'repairs': '5100',
          'maintenance': '5100',
          
          // Other common categories
          'travel': '5100',
          'meals': '5100',
          'professional fees': '5100',
          'insurance': '5100',
          'other': '5100'
        };
        
        // Match expenses by category for any expense account (5100-5500)
        if ((accountType === 'EXPENSE' || accountType === 'Expense') && 
            accountCodeNum >= 5100 && accountCodeNum <= 5500) {
          
          // Try to match by account code first
          let matchedExpenses = null;
          
          // Office Expenses (5100) - matches office, supplies, advertising, marketing, equipment (expense)
          if (accountCode === '5100' || (accountCodeNum >= 5100 && accountCodeNum < 5200 && accountName.includes('office'))) {
            matchedExpenses = expensesByCategory.filter(e => {
              const catName = (e.category || '').toLowerCase();
              return catName.includes('office') || 
                     catName.includes('supplies') ||
                     catName.includes('advertising') ||
                     catName.includes('marketing') ||
                     (catName.includes('equipment') && !catName.includes('purchase')) || // Equipment expense, not asset
                     catName.includes('repair') ||
                     catName.includes('maintenance') ||
                     catName.includes('travel') ||
                     catName.includes('professional') ||
                     catName === 'other';
            });
          }
          // Rent Expense (5200)
          else if (accountCode === '5200' || accountName.includes('rent')) {
            matchedExpenses = expensesByCategory.filter(e => {
              const catName = (e.category || '').toLowerCase();
              return catName.includes('rent');
            });
          }
          // Utilities Expense (5300)
          else if (accountCode === '5300' || accountName.includes('utilities')) {
            matchedExpenses = expensesByCategory.filter(e => {
              const catName = (e.category || '').toLowerCase();
              return catName.includes('utilities') || 
                     catName.includes('electricity') || 
                     catName.includes('water') || 
                     catName.includes('internet') ||
                     catName.includes('phone');
            });
          }
          // Salaries Expense (5400) - already handled above
          // Depreciation Expense (5500)
          else if (accountCode === '5500' || accountName.includes('depreciation')) {
            // Depreciation expense is the annual depreciation, not accumulated
            // This would come from depreciation schedules or journal entries
            // For now, we'll use a portion of accumulated depreciation
            additionalBalance += (totalAccumulatedDepreciation * 0.1); // Approximate 10% annual
          }
          
          // Sum matched expenses
          if (matchedExpenses && matchedExpenses.length > 0) {
            const totalMatched = matchedExpenses.reduce((sum, exp) => {
              const amount = exp?._sum?.amount || exp?.amount || 0;
              return sum + (parseFloat(amount) || 0);
            }, 0);
            additionalBalance += totalMatched;
            console.log(`✅ Matched expenses for account ${accountCode} - ${account.accountName || account.name}:`, {
              categories: matchedExpenses.map(e => e?.category || 'Unknown'),
              total: totalMatched
            });
          }
        }

        // Accumulated Depreciation (code 1501 or name contains "accumulated depreciation")
        if ((accountCode === '1501' || accountCode.startsWith('1501') ||
             accountName.includes('accumulated depreciation')) && 
            (accountType === 'ASSET' || accountType === 'Asset')) {
          additionalBalance += totalAccumulatedDepreciation;
          console.log(`✅ Matched accumulated depreciation: ${accountCode}, value: ${totalAccumulatedDepreciation}`);
        }

        // Retained Earnings (code 3100 or name contains "retained earnings")
        if ((accountCode === '3100' || accountCode.startsWith('3100') ||
             accountName.includes('retained earnings')) && 
            (accountType === 'EQUITY' || accountType === 'Equity')) {
          additionalBalance += netIncome; // This will be cumulative over time
          console.log(`✅ Matched retained earnings: ${accountCode}, value: ${netIncome}`);
        }

        // Owner's Capital (code 3000 or name contains "capital")
        // Note: This typically requires manual entry or opening balance
        // We'll leave it at journal entry balance for now

        // Also check for legacy balance field if it exists
        const legacyBalance = parseFloat(account.balance) || 0;
        
        // Combine balances
        // For Accounts Receivable: use ONLY unpaid invoices (already set above)
        // For other accounts: use journal entries + additional balances
        let finalBalance = balance;
        
        // Check if this is Accounts Receivable (already handled above)
        const isAccountsReceivable = (accountCode === '1100' || accountName.includes('receivable')) && 
                                     (accountType === 'ASSET' || accountType === 'Asset');
        
        if (isAccountsReceivable) {
          // Accounts Receivable: use ONLY unpaid invoices (already set in balance above)
          finalBalance = balance; // balance is already set to totalAccountsReceivable above
        } else {
          // Other accounts: combine journal entries + additional balances
          const totalOtherBalances = additionalBalance;
          
          if (postedLines.length === 0) {
            // No journal entries, use additional balance or legacy balance
            if (totalOtherBalances > 0) {
              finalBalance = totalOtherBalances;
            } else if (legacyBalance !== 0) {
              finalBalance = legacyBalance;
            } else {
              finalBalance = 0;
            }
          } else {
            // We have journal entries, add additional balances to it
            finalBalance = balance + totalOtherBalances;
          }
        }

        const accountResult = {
          ...account,
          currentBalance: finalBalance,
          transactionCount: allJournalLines.length,
          postedEntryCount: postedLines.length,
          draftEntryCount: draftLines.length,
          additionalBalance: additionalBalance,
          journalEntryBalance: balance
        };
        
        // Debug log for accounts with zero balance but should have values
        if (finalBalance === 0 && (totalInventoryValue > 0 || totalAssetsValue > 0 || totalAccountsReceivable > 0)) {
          if ((accountCode === '1200' || accountName.includes('inventory')) && accountType === 'Asset') {
            console.log(`⚠️ Inventory account ${accountCode} - ${account.accountName || account.name} has zero balance but inventory value is ${totalInventoryValue}`);
          }
          if (isAssetAccount && accountType === 'Asset' && totalAssetsValue > 0) {
            console.log(`⚠️ Asset account ${accountCode} - ${account.accountName || account.name} has zero balance but total assets value is ${totalAssetsValue}`);
          }
        }
        
        return accountResult;
      } catch (error) {
        console.error(`Error calculating balance for account ${account?.id || 'unknown'}:`, error);
        // Return account with zero balance if calculation fails
        return {
          ...account,
          currentBalance: 0,
          transactionCount: 0,
          postedEntryCount: 0,
          draftEntryCount: 0,
          additionalBalance: 0,
          journalEntryBalance: 0
        };
      }
    }));

    // Extract successful results and handle failures
    const successfulAccounts = accountsWithBalances
      .map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Failed to calculate balance for account at index ${index}:`, result.reason);
          // Return a basic account object with zero balance
          const account = accounts[index];
          return {
            ...account,
            currentBalance: 0,
            transactionCount: 0,
            postedEntryCount: 0,
            draftEntryCount: 0,
            additionalBalance: 0,
            journalEntryBalance: 0
          };
        }
      })
      .filter(account => account !== null && account !== undefined);

    // Deduplicate accounts by accountCode (keep the one with the highest balance or most recent)
    const accountMap = new Map();
    for (const account of successfulAccounts) {
      const code = account.accountCode || account.code || '';
      if (!code) continue;
      
      const existing = accountMap.get(code);
      if (!existing) {
        accountMap.set(code, account);
      } else {
        // If duplicate, keep the one with higher balance or more transactions
        const existingBalance = Math.abs(existing.currentBalance || 0);
        const newBalance = Math.abs(account.currentBalance || 0);
        const existingTransactions = existing.transactionCount || 0;
        const newTransactions = account.transactionCount || 0;
        
        if (newBalance > existingBalance || 
            (newBalance === existingBalance && newTransactions > existingTransactions)) {
          accountMap.set(code, account);
        }
      }
    }
    
    const deduplicatedAccounts = Array.from(accountMap.values());
    
    return NextResponse.json({
      accounts: deduplicatedAccounts,
      total: deduplicatedAccounts.length
    });
  } catch (error) {
    console.error('Error fetching chart of accounts:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return NextResponse.json(
      { error: 'Failed to fetch chart of accounts', details: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    );
  }
}

// POST - Create new account
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    if (!isFinanceAdmin(user)) {
      return NextResponse.json(
        { error: 'Access denied. Finance or Admin role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      accountCode,
      accountName,
      accountType,
      accountSubtype,
      normalBalance,
      parentAccountId,
      description,
      isActive = true
    } = body;

    const normalizedType = normalizeAccountType(accountType);
    const resolvedNormalBalance =
      normalBalance ||
      (normalizedType === 'Asset' || normalizedType === 'Expense' ? 'Debit' : 'Credit');

    // Validation
    if (!accountCode || !accountName || !normalizedType) {
      return NextResponse.json(
        { error: 'Missing required fields: accountCode, accountName, accountType' },
        { status: 400 }
      );
    }

    // Validate account code format (numeric only)
    if (!validateAccountCode(accountCode)) {
      return NextResponse.json(
        { error: 'Account code must be numeric (3-10 digits).' },
        { status: 400 }
      );
    }

    if (!ACCOUNT_TYPES.includes(normalizedType)) {
      return NextResponse.json(
        { error: `Invalid account type. Expected one of: ${ACCOUNT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if account code already exists for this tenant
    // Also check for case-insensitive matches and variations
    const existingAccount = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        OR: [
          { accountCode: accountCode },
          // Also check if account name matches (to prevent duplicates with different codes)
          accountName ? { accountName: { equals: accountName, mode: 'insensitive' } } : {}
        ].filter(condition => Object.keys(condition).length > 0)
      }
    });

    if (existingAccount) {
      if (existingAccount.accountCode === accountCode) {
        return NextResponse.json(
          { 
            error: 'Account code must be unique',
            details: `Account code ${accountCode} is already in use by account: ${existingAccount.accountName || existingAccount.accountCode}`
          },
          { status: 400 }
        );
      } else if (existingAccount.accountName && accountName && 
                 existingAccount.accountName.toLowerCase() === accountName.toLowerCase()) {
        return NextResponse.json(
          { 
            error: 'Account name already exists',
            details: `An account with the name "${accountName}" already exists with code: ${existingAccount.accountCode}`
          },
          { status: 400 }
        );
      }
    }

    // Validate parent account if provided
    if (parentAccountId) {
      const parentAccount = await prisma.account.findUnique({
        where: { id: parentAccountId }
      });

      if (!parentAccount || parentAccount.tenantId !== user.tenantId) {
        return NextResponse.json(
          { error: 'Invalid parent account' },
          { status: 400 }
        );
      }

    if (parentAccount.accountType !== normalizedType) {
        return NextResponse.json(
          { error: 'Parent account must be of the same type' },
          { status: 400 }
        );
      }
    }

    // Validate normal balance matches account type
    const expectedNormalBalance = {
      'Asset': 'Debit',
      'Expense': 'Debit',
      'Liability': 'Credit',
      'Equity': 'Credit',
      'Income': 'Credit'
    };

    if (expectedNormalBalance[normalizedType] !== resolvedNormalBalance) {
      return NextResponse.json(
        { error: `Normal balance for ${normalizedType} should be ${expectedNormalBalance[normalizedType]}` },
        { status: 400 }
      );
    }

    // Validate posting rules: Ensure account type allows the specified normal balance
    // This is already validated above, but we'll add additional checks here
    const postingRules = {
      'Asset': { normalBalance: 'Debit', canDebit: true, canCredit: false },
      'Expense': { normalBalance: 'Debit', canDebit: true, canCredit: false },
      'Liability': { normalBalance: 'Credit', canDebit: false, canCredit: true },
      'Equity': { normalBalance: 'Credit', canDebit: false, canCredit: true },
      'Revenue': { normalBalance: 'Credit', canDebit: false, canCredit: true },
      'Income': { normalBalance: 'Credit', canDebit: false, canCredit: true }
    };

    const rule = postingRules[normalizedType];
    if (rule && rule.normalBalance !== resolvedNormalBalance) {
      return NextResponse.json(
        { 
          error: 'Invalid posting rule',
          details: `${normalizedType} accounts must have a ${rule.normalBalance} normal balance`
        },
        { status: 400 }
      );
    }

    let account;
    try {
      account = await prisma.account.create({
        data: {
          accountCode,
          accountName,
          accountType: normalizedType,
          accountSubtype: accountSubtype || null,
          normalBalance: resolvedNormalBalance,
          parentAccountId: parentAccountId || null,
          description: description || null,
          isActive,
          tenantId: user.tenantId,
          isSystem: false,
          balance: 0
        },
        include: {
          parentAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          }
        }
      });
    } catch (createError) {
      // Handle Prisma unique constraint errors
      if (createError.code === 'P2002') {
        const field = createError.meta?.target?.[0] || 'field';
        let errorMessage = 'Account code must be unique';
        let errorDetails = `The ${field} value is already in use.`;
        
        if (field === 'accountCode') {
          errorMessage = 'Account code must be unique';
          errorDetails = `Account code ${accountCode} is already in use.`;
        } else if (field === 'accountName' || field === 'name') {
          errorMessage = 'Account name must be unique';
          errorDetails = `An account with the name "${accountName}" already exists.`;
        }
        
        return NextResponse.json(
          { error: errorMessage, details: errorDetails },
          { status: 400 }
        );
      }
      
      // Re-throw other errors
      throw createError;
    }

    return NextResponse.json({
      account,
      message: 'Account created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account', details: error.message },
      { status: 500 }
    );
  }
}

