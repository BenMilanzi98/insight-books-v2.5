// app/api/reports/income-statement/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateIncomeStatementFromAccounts } from '@/lib/incomeStatementService';
import { getCOGSSummary } from '@/lib/cogsIntegration';

/**
 * Professional Income Statement (Profit & Loss Statement) API
 * Generates comprehensive income statement with COGS, operating expenses, and tax calculations
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
    const compare = searchParams.get('compare') === 'true';
    const compareYear = searchParams.get('compareYear') === 'true';
    
    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate comparison periods
    let prevStartDate, prevEndDate;
    if (compare) {
      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
      prevEndDate = new Date(start);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - diffDays + 1);
      prevStartDate = prevStartDate.toISOString().split('T')[0];
      prevEndDate = prevEndDate.toISOString().split('T')[0];
    } else if (compareYear) {
      const yearDiff = end.getFullYear() - start.getFullYear();
      prevStartDate = new Date(start.getFullYear() - 1, start.getMonth(), start.getDate()).toISOString().split('T')[0];
      prevEndDate = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate()).toISOString().split('T')[0];
    }
    
    // Get tenant and settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { 
        name: true,
        logoUrl: true
      }
    });
    
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId }
    });
    const taxRate = tenantSettings?.defaultTaxRate || 30; // Default 30%
    
    // Generate current period income statement using Phase 2 enhanced service
    // This pulls data directly from General Ledger (Transaction/TransactionLine records)
    let currentPeriod;
    try {
      currentPeriod = await generateIncomeStatementFromAccounts(
        user.tenantId,
        startDate,
        endDate,
        tenant?.name || 'Company',
        tenant?.logoUrl || null,
        user.currentBranchId || null
      );
      
      // Validate that we have data
      if (!currentPeriod) {
        throw new Error('Income statement generation returned null');
      }
      
      // Validate totals
      const totalRevenue = currentPeriod.totalRevenue || 0;
      const totalCOGS = (currentPeriod.cogs?.costOfProductsSold || 0) + (currentPeriod.cogs?.freightShippingCosts || 0);
      const totalExpenses = currentPeriod.totalOperatingExpenses || 0;
      
      console.log('✅ Income Statement Generated:', {
        revenue: totalRevenue,
        cogs: totalCOGS,
        expenses: totalExpenses,
        netIncome: currentPeriod.netIncome || 0,
        revenueAccounts: currentPeriod.metadata?.revenueAccounts || 0,
        expenseAccounts: currentPeriod.metadata?.expenseAccounts || 0
      });
    } catch (error) {
      console.error('❌ Error generating income statement:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        tenantId: user.tenantId,
        startDate,
        endDate
      });
      throw error;
    }
    
    // Generate comparison period if requested
    let previousPeriod = null;
    if (compare && prevStartDate && prevEndDate) {
      previousPeriod = await generateIncomeStatementFromAccounts(
        user.tenantId,
        prevStartDate,
        prevEndDate,
        tenant?.name || 'Company',
        tenant?.logoUrl || null,
        user.currentBranchId || null
      );
    } else if (compareYear && prevStartDate && prevEndDate) {
      previousPeriod = await generateIncomeStatementFromAccounts(
        user.tenantId,
        prevStartDate,
        prevEndDate,
        tenant?.name || 'Company',
        tenant?.logoUrl || null,
        user.currentBranchId || null
      );
    }
    
    // Transform response to match frontend expectations
    const transformResponse = (data) => {
      if (!data) return null;
      
      const totalRevenue = data.totalRevenue || 0;
      
      return {
        ...data,
        totalRevenue,
        revenue: {
          ...data.revenue,
          total: totalRevenue,
          // Dynamic revenue lines (per revenue account)
          lineItems: (data.revenue?.lineItems || []).map(li => ({
            ...li,
            percentage: totalRevenue > 0 ? ((li.amount || 0) / totalRevenue) * 100 : 0
          })),
          // Legacy buckets (for fallback views)
          salesRevenue: {
            amount: data.revenue?.salesRevenue || 0,
            percentage: totalRevenue > 0 ? ((data.revenue?.salesRevenue || 0) / totalRevenue) * 100 : 0
          },
          serviceRevenue: {
            amount: data.revenue?.serviceRevenue || 0,
            percentage: totalRevenue > 0 ? ((data.revenue?.serviceRevenue || 0) / totalRevenue) * 100 : 0
          },
          otherIncome: {
            amount: data.revenue?.otherIncome || 0,
            percentage: totalRevenue > 0 ? ((data.revenue?.otherIncome || 0) / totalRevenue) * 100 : 0
          }
        },
        cogs: {
          ...data.cogs,
          total: (data.cogs?.costOfProductsSold || 0) + (data.cogs?.freightShippingCosts || 0),
          // Dynamic COGS lines
          lineItems: (data.cogs?.lineItems || []).map(li => ({
            ...li,
            percentage: totalRevenue > 0 ? ((li.amount || 0) / totalRevenue) * 100 : 0
          })),
          costOfProductsSold: {
            amount: data.cogs?.costOfProductsSold || 0,
            percentage: totalRevenue > 0 ? ((data.cogs?.costOfProductsSold || 0) / totalRevenue) * 100 : 0
          },
          freightShippingCosts: {
            amount: data.cogs?.freightShippingCosts || 0,
            percentage: totalRevenue > 0 ? ((data.cogs?.freightShippingCosts || 0) / totalRevenue) * 100 : 0
          }
        },
        grossProfit: {
          amount: data.grossProfit || 0,
          percentage: totalRevenue > 0 ? ((data.grossProfit || 0) / totalRevenue) * 100 : 0
        },
        operatingExpenses: {
          ...data.operatingExpenses,
          total: data.totalOperatingExpenses || data.operatingExpenses?.total || 0,
          // Dynamic categories: user-created expense categories (display name = category; accountCode locked)
          categories: (data.operatingExpenses?.categories || []).map(cat => ({
            category: cat.category,
            accountCode: cat.accountCode,
            amount: cat.amount,
            percentage: totalRevenue > 0 ? (cat.amount / totalRevenue) * 100 : 0,
            details: cat.details || []
          })),
          // Keep legacy fields for backward compatibility (will be empty if using dynamic categories)
          salariesWages: {
            amount: data.operatingExpenses?.salaries || 0,
            percentage: totalRevenue > 0 ? ((data.operatingExpenses?.salaries || 0) / totalRevenue) * 100 : 0
          },
          rentExpense: {
            amount: data.operatingExpenses?.rent || 0,
            percentage: totalRevenue > 0 ? ((data.operatingExpenses?.rent || 0) / totalRevenue) * 100 : 0
          },
          utilitiesExpense: {
            amount: data.operatingExpenses?.utilities || 0,
            percentage: totalRevenue > 0 ? ((data.operatingExpenses?.utilities || 0) / totalRevenue) * 100 : 0
          },
          officeSupplies: {
            amount: 0,
            percentage: 0
          },
          marketingAdvertising: {
            amount: data.operatingExpenses?.marketing || 0,
            percentage: totalRevenue > 0 ? ((data.operatingExpenses?.marketing || 0) / totalRevenue) * 100 : 0
          },
          insurance: {
            amount: 0,
            percentage: 0
          },
          depreciation: {
            amount: data.operatingExpenses?.depreciation || 0,
            percentage: totalRevenue > 0 ? ((data.operatingExpenses?.depreciation || 0) / totalRevenue) * 100 : 0
          },
          loanPayments: {
            amount: 0,
            percentage: 0
          },
          otherOperatingExpenses: {
            amount: data.operatingExpenses?.otherOperatingExpenses || 0,
            percentage: totalRevenue > 0 ? ((data.operatingExpenses?.otherOperatingExpenses || 0) / totalRevenue) * 100 : 0
          }
        },
        operatingIncome: {
          amount: data.operatingIncome || 0,
          percentage: totalRevenue > 0 ? ((data.operatingIncome || 0) / totalRevenue) * 100 : 0
        },
        otherIncomeExpenses: {
          interestIncome: {
            amount: data.otherIncomeExpenses?.interestIncome || 0,
            percentage: totalRevenue > 0 ? ((data.otherIncomeExpenses?.interestIncome || 0) / totalRevenue) * 100 : 0
          },
          interestExpense: {
            amount: data.otherIncomeExpenses?.interestExpense || 0,
            percentage: totalRevenue > 0 ? ((data.otherIncomeExpenses?.interestExpense || 0) / totalRevenue) * 100 : 0
          },
          gainLossOnAssetSales: {
            amount: data.otherIncomeExpenses?.otherIncome || 0,
            percentage: totalRevenue > 0 ? ((data.otherIncomeExpenses?.otherIncome || 0) / totalRevenue) * 100 : 0
          },
          total: data.otherIncomeExpenses?.total || 0
        },
        netIncomeBeforeTax: {
          amount: data.incomeBeforeTax || 0,
          percentage: totalRevenue > 0 ? ((data.incomeBeforeTax || 0) / totalRevenue) * 100 : 0
        },
        incomeTaxExpense: {
          rate: 0,
          amount: data.taxExpense || 0,
          percentage: totalRevenue > 0 ? ((data.taxExpense || 0) / totalRevenue) * 100 : 0
        },
        netIncome: {
          amount: data.netIncome || 0,
          percentage: totalRevenue > 0 ? ((data.netIncome || 0) / totalRevenue) * 100 : 0
        }
      };
    };

    return NextResponse.json({
      ...transformResponse(currentPeriod),
      previous: transformResponse(previousPeriod),
      comparisonType: compare ? 'previousPeriod' : compareYear ? 'previousYear' : null
    });
  } catch (error) {
    console.error('Error generating income statement:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta
    });
    return NextResponse.json(
      { 
        error: 'Failed to generate income statement. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Generate income statement for a given period
 */
export async function generateIncomeStatement(tenantId, startDate, endDate, taxRate, companyName = 'Company', logoUrl = null) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // ========== REVENUE SECTION ==========
  // Get invoices (Sales Revenue)
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      issueDate: { gte: start, lte: end },
      status: { in: ['Paid', 'Completed', 'Pending'] },
      voidedAt: null,
      refundedAt: null
    },
    include: {
      items: {
        include: {
          product: true
        }
      },
      client: true
    }
  });
  
  // Get sales (Sales Revenue)
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      saleDate: { gte: start, lte: end },
      status: 'completed',
      voidedAt: null,
      refundedAt: null
    },
    include: {
      items: {
        include: {
          product: true
        }
      },
      client: true
    }
  });
  
  // Categorize revenue
  const revenue = {
    salesRevenue: 0,
    serviceRevenue: 0,
    otherIncome: 0,
    details: []
  };
  
  // Process invoices
  invoices.forEach(invoice => {
    const invoiceTotal = invoice.total || 0;
    // Check if invoice has service items
    const hasServices = invoice.items.some(item => 
      item.product?.isService || !item.productId
    );
    
    if (hasServices) {
      revenue.serviceRevenue += invoiceTotal;
    } else {
      revenue.salesRevenue += invoiceTotal;
    }
    
    revenue.details.push({
      type: 'invoice',
      id: invoice.id,
      number: invoice.invoiceNumber,
      date: invoice.issueDate,
      client: invoice.client?.name || 'N/A',
      amount: invoiceTotal,
      category: hasServices ? 'Service Revenue' : 'Sales Revenue'
    });
  });
  
  // Process sales
  sales.forEach(sale => {
    const saleTotal = sale.total || 0;
    const hasServices = sale.items.some(item => 
      item.product?.isService || !item.productId
    );
    
    if (hasServices) {
      revenue.serviceRevenue += saleTotal;
    } else {
      revenue.salesRevenue += saleTotal;
    }
    
    revenue.details.push({
      type: 'sale',
      id: sale.id,
      number: sale.saleNumber,
      date: sale.saleDate,
      client: sale.client?.name || 'Walk-in',
      amount: saleTotal,
      category: hasServices ? 'Service Revenue' : 'Sales Revenue'
    });
  });
  
  const totalRevenue = revenue.salesRevenue + revenue.serviceRevenue + revenue.otherIncome;
  
  // ========== COGS SECTION ==========
  const cogs = {
    costOfProductsSold: 0,
    freightShippingCosts: 0,
    details: []
  };
  
  // Calculate COGS from sales using FIFO or stored cost at sale time
  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productId && item.product && !item.product.isService) {
        let itemCOGS = 0;
        let productCost = 0;
        
        // Priority 1: Use stored FIFO COGS from customProductData
        if (item.customProductData) {
          let customData = item.customProductData;
          if (typeof customData === 'string') {
            try {
              customData = JSON.parse(customData);
            } catch (e) {
              customData = null;
            }
          }
          
          if (customData && typeof customData === 'object') {
            // Try FIFO COGS first
            if (customData.fifoCogs && customData.fifoCogs.cogsAmount !== undefined) {
              const fifoCogs = customData.fifoCogs.cogsAmount;
              itemCOGS = typeof fifoCogs === 'object' && fifoCogs?.toNumber 
                ? fifoCogs.toNumber() 
                : Number(fifoCogs);
              productCost = itemCOGS / item.quantity; // Average cost per unit
            }
            // Fallback to stored cost at sale time
            else if (customData.productCostAtSale !== undefined) {
              productCost = Number(customData.productCostAtSale);
              itemCOGS = item.quantity * productCost;
            }
          }
        }
        
        // Priority 2: Use current product cost (last resort)
        if (itemCOGS === 0 && item.product.cost) {
          productCost = Number(item.product.cost);
          itemCOGS = item.quantity * productCost;
        }
        
        if (itemCOGS > 0) {
          cogs.costOfProductsSold += itemCOGS;
          cogs.details.push({
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            cost: productCost,
            cogsAmount: itemCOGS
          });
        }
      }
    }
  }
  
  // Calculate COGS from invoices using stored cost at invoice time
  for (const invoice of invoices) {
    for (const item of invoice.items) {
      if (item.productId && item.product && !item.product.isService) {
        let itemCOGS = 0;
        let productCost = 0;
        
        // Try to get stored cost at invoice time from customProductData
        if (item.customProductData) {
          let customData = item.customProductData;
          if (typeof customData === 'string') {
            try {
              customData = JSON.parse(customData);
            } catch (e) {
              customData = null;
            }
          }
          
          if (customData && typeof customData === 'object') {
            // Try FIFO COGS first
            if (customData.fifoCogs && customData.fifoCogs.cogsAmount !== undefined) {
              const fifoCogs = customData.fifoCogs.cogsAmount;
              itemCOGS = typeof fifoCogs === 'object' && fifoCogs?.toNumber 
                ? fifoCogs.toNumber() 
                : Number(fifoCogs);
              productCost = itemCOGS / item.quantity;
            }
            // Fallback to stored cost at invoice time
            else if (customData.productCostAtSale !== undefined) {
              productCost = Number(customData.productCostAtSale);
              itemCOGS = item.quantity * productCost;
            }
          }
        }
        
        // Last resort: use current product cost
        if (itemCOGS === 0 && item.product.cost) {
          productCost = Number(item.product.cost);
          itemCOGS = item.quantity * productCost;
        }
        
        if (itemCOGS > 0) {
          cogs.costOfProductsSold += itemCOGS;
          cogs.details.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            cost: productCost,
            cogsAmount: itemCOGS
          });
        }
      }
    }
  }
  
  // Get freight/shipping from expenses categorized as such
  const freightExpenses = await prisma.expense.findMany({
    where: {
      tenantId,
      date: { gte: start, lte: end },
      category: { in: ['Freight', 'Shipping', 'Delivery', 'Transport'] },
      isDeleted: false
    }
  });
  
  freightExpenses.forEach(expense => {
    cogs.freightShippingCosts += expense.amount || 0;
  });
  
  const totalCOGS = cogs.costOfProductsSold + cogs.freightShippingCosts;
  const grossProfit = totalRevenue - totalCOGS;
  
  // ========== OPERATING EXPENSES SECTION ==========
  const operatingExpenses = {
    salariesWages: 0,
    rentExpense: 0,
    utilitiesExpense: 0,
    officeSupplies: 0,
    marketingAdvertising: 0,
    insurance: 0,
    depreciation: 0,
    loanPayments: 0,
    otherOperatingExpenses: 0,
    details: []
  };
  
  // Get all expenses
  const expenses = await prisma.expense.findMany({
    where: {
      tenantId,
      date: { gte: start, lte: end },
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
  
  // Categorize expenses
  const expenseCategoryMap = {
    'Salaries': 'salariesWages',
    'Wages': 'salariesWages',
    'Payroll': 'salariesWages',
    'Rent': 'rentExpense',
    'Utilities': 'utilitiesExpense',
    'Office Supplies': 'officeSupplies',
    'Office Expenses': 'officeSupplies', // Map Office Expenses to Office Supplies
    'Office': 'officeSupplies', // Map any Office-related expense
    'Supplies': 'officeSupplies',
    'Marketing': 'marketingAdvertising',
    'Advertising': 'marketingAdvertising',
    'Insurance': 'insurance',
    'Depreciation': 'depreciation',
    'Amortization': 'depreciation',
    'Equipment': 'otherOperatingExpenses', // Equipment expenses (not asset purchases)
    'Maintenance': 'otherOperatingExpenses',
    'Repair': 'otherOperatingExpenses',
    'Training': 'otherOperatingExpenses',
    'Loan': 'loanPayments',
    'Loan Payment': 'loanPayments',
    'Loan Repayment': 'loanPayments',
    'Debt Service': 'loanPayments',
    'Debt Payment': 'loanPayments',
    'Debt Repayment': 'loanPayments'
  };
  
  expenses.forEach(expense => {
    const amount = expense.amount || 0;
    const category = expense.category || '';
    const normalizedCategory = category.toLowerCase();
    
    let mapped = false;
    // Sort keys by length (longest first) to match more specific categories first
    const sortedKeys = Object.keys(expenseCategoryMap).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
      if (normalizedCategory.includes(key.toLowerCase())) {
        operatingExpenses[expenseCategoryMap[key]] += amount;
        mapped = true;
        break;
      }
    }
    
    if (!mapped) {
      operatingExpenses.otherOperatingExpenses += amount;
    }
    
    operatingExpenses.details.push({
      id: expense.id,
      date: expense.date,
      description: expense.description,
      category: expense.category,
      amount: amount,
      submittedBy: expense.submittedBy?.name || 'N/A'
    });
  });
  
  // Get depreciation from assets
  const depreciationSchedules = await prisma.depreciationSchedule.findMany({
    where: {
      asset: {
        tenantId
      },
      periodStart: { lte: end },
      periodEnd: { gte: start }
    },
    include: {
      asset: true
    }
  });
  
  depreciationSchedules.forEach(schedule => {
    const scheduleStart = new Date(schedule.periodStart);
    const scheduleEnd = new Date(schedule.periodEnd);
    const reportStart = new Date(start);
    const reportEnd = new Date(end);
    
    // Calculate prorated depreciation for the period
    const overlapStart = scheduleStart > reportStart ? scheduleStart : reportStart;
    const overlapEnd = scheduleEnd < reportEnd ? scheduleEnd : reportEnd;
    
    if (overlapStart <= overlapEnd) {
      const daysInPeriod = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
      const daysInSchedule = Math.ceil((scheduleEnd - scheduleStart) / (1000 * 60 * 60 * 24)) + 1;
      const proratedDepreciation = (schedule.depreciationAmount / daysInSchedule) * daysInPeriod;
      
      operatingExpenses.depreciation += proratedDepreciation;
      operatingExpenses.details.push({
        id: `depreciation-${schedule.id}`,
        date: schedule.periodStart,
        description: `Depreciation - ${schedule.asset.name}`,
        category: 'Depreciation',
        amount: proratedDepreciation,
        submittedBy: 'System'
      });
    }
  });
  
  const totalOperatingExpenses = 
    operatingExpenses.salariesWages +
    operatingExpenses.rentExpense +
    operatingExpenses.utilitiesExpense +
    operatingExpenses.officeSupplies +
    operatingExpenses.marketingAdvertising +
    operatingExpenses.insurance +
    operatingExpenses.depreciation +
    operatingExpenses.loanPayments +
    operatingExpenses.otherOperatingExpenses;
  
  const operatingIncome = grossProfit - totalOperatingExpenses;
  
  // ========== OTHER INCOME/(EXPENSES) SECTION ==========
  const otherIncomeExpenses = {
    interestIncome: 0,
    interestExpense: 0,
    gainLossOnAssetSales: 0,
    details: []
  };
  
  // Get interest income/expense from expenses or transactions
  const interestExpenses = expenses.filter(e => 
    e.category?.toLowerCase().includes('interest')
  );
  
  interestExpenses.forEach(expense => {
    if (expense.category?.toLowerCase().includes('income')) {
      otherIncomeExpenses.interestIncome += expense.amount || 0;
    } else {
      otherIncomeExpenses.interestExpense += expense.amount || 0;
    }
  });
  
  const totalOtherIncomeExpenses = 
    otherIncomeExpenses.interestIncome -
    otherIncomeExpenses.interestExpense +
    otherIncomeExpenses.gainLossOnAssetSales;
  
  const netIncomeBeforeTax = operatingIncome + totalOtherIncomeExpenses;
  // Tax is only calculated on profits, not losses
  const incomeTaxExpense = netIncomeBeforeTax > 0 ? (netIncomeBeforeTax * taxRate) / 100 : 0;
  const netIncome = netIncomeBeforeTax - incomeTaxExpense;
  
  // Calculate percentages for each line item (as % of Total Revenue)
  const calculatePercentage = (amount) => {
    return totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
  };
  
  return {
    companyName,
    logoUrl,
    period: {
      startDate,
      endDate
    },
    revenue: {
      salesRevenue: {
        amount: revenue.salesRevenue,
        percentage: calculatePercentage(revenue.salesRevenue),
        details: revenue.details.filter(d => d.category === 'Sales Revenue')
      },
      serviceRevenue: {
        amount: revenue.serviceRevenue,
        percentage: calculatePercentage(revenue.serviceRevenue),
        details: revenue.details.filter(d => d.category === 'Service Revenue')
      },
      otherIncome: {
        amount: revenue.otherIncome,
        percentage: calculatePercentage(revenue.otherIncome),
        details: revenue.details.filter(d => d.category === 'Other Income')
      },
      total: totalRevenue,
      details: revenue.details
    },
    cogs: {
      costOfProductsSold: {
        amount: cogs.costOfProductsSold,
        percentage: calculatePercentage(cogs.costOfProductsSold),
        details: cogs.details.filter(d => d.productName)
      },
      freightShippingCosts: {
        amount: cogs.freightShippingCosts,
        percentage: calculatePercentage(cogs.freightShippingCosts),
        details: []
      },
      total: totalCOGS,
      details: cogs.details
    },
    grossProfit: {
      amount: grossProfit,
      percentage: calculatePercentage(grossProfit)
    },
    operatingExpenses: {
      salariesWages: {
        amount: operatingExpenses.salariesWages,
        percentage: calculatePercentage(operatingExpenses.salariesWages),
        details: operatingExpenses.details.filter(d => 
          d.category?.toLowerCase().includes('salar') || 
          d.category?.toLowerCase().includes('wage') ||
          d.category?.toLowerCase().includes('payroll')
        )
      },
      rentExpense: {
        amount: operatingExpenses.rentExpense,
        percentage: calculatePercentage(operatingExpenses.rentExpense),
        details: operatingExpenses.details.filter(d => d.category?.toLowerCase().includes('rent'))
      },
      utilitiesExpense: {
        amount: operatingExpenses.utilitiesExpense,
        percentage: calculatePercentage(operatingExpenses.utilitiesExpense),
        details: operatingExpenses.details.filter(d => d.category?.toLowerCase().includes('utilit'))
      },
      officeSupplies: {
        amount: operatingExpenses.officeSupplies,
        percentage: calculatePercentage(operatingExpenses.officeSupplies),
        details: operatingExpenses.details.filter(d => d.category?.toLowerCase().includes('office'))
      },
      marketingAdvertising: {
        amount: operatingExpenses.marketingAdvertising,
        percentage: calculatePercentage(operatingExpenses.marketingAdvertising),
        details: operatingExpenses.details.filter(d => 
          d.category?.toLowerCase().includes('market') || 
          d.category?.toLowerCase().includes('advertis')
        )
      },
      insurance: {
        amount: operatingExpenses.insurance,
        percentage: calculatePercentage(operatingExpenses.insurance),
        details: operatingExpenses.details.filter(d => d.category?.toLowerCase().includes('insur'))
      },
      depreciation: {
        amount: operatingExpenses.depreciation,
        percentage: calculatePercentage(operatingExpenses.depreciation),
        details: operatingExpenses.details.filter(d => 
          d.category?.toLowerCase().includes('depreciat') || 
          d.category?.toLowerCase().includes('amortiz')
        )
      },
      loanPayments: {
        amount: operatingExpenses.loanPayments,
        percentage: calculatePercentage(operatingExpenses.loanPayments),
        details: operatingExpenses.details.filter(d => {
          const cat = d.category?.toLowerCase() || '';
          return cat.includes('loan') || cat.includes('debt');
        })
      },
      otherOperatingExpenses: {
        amount: operatingExpenses.otherOperatingExpenses,
        percentage: calculatePercentage(operatingExpenses.otherOperatingExpenses),
        details: operatingExpenses.details.filter(d => {
          const cat = d.category?.toLowerCase() || '';
          return !cat.includes('salar') && !cat.includes('wage') && !cat.includes('payroll') &&
                 !cat.includes('rent') && !cat.includes('utilit') && !cat.includes('office') &&
                 !cat.includes('market') && !cat.includes('advertis') && !cat.includes('insur') &&
                 !cat.includes('depreciat') && !cat.includes('amortiz') && !cat.includes('loan') && !cat.includes('debt');
        })
      },
      total: totalOperatingExpenses,
      details: operatingExpenses.details
    },
    operatingIncome: {
      amount: operatingIncome,
      percentage: calculatePercentage(operatingIncome)
    },
    otherIncomeExpenses: {
      interestIncome: {
        amount: otherIncomeExpenses.interestIncome,
        percentage: calculatePercentage(otherIncomeExpenses.interestIncome),
        details: otherIncomeExpenses.details.filter(d => d.category?.toLowerCase().includes('interest') && d.category?.toLowerCase().includes('income'))
      },
      interestExpense: {
        amount: otherIncomeExpenses.interestExpense,
        percentage: calculatePercentage(otherIncomeExpenses.interestExpense),
        details: otherIncomeExpenses.details.filter(d => d.category?.toLowerCase().includes('interest') && !d.category?.toLowerCase().includes('income'))
      },
      gainLossOnAssetSales: {
        amount: otherIncomeExpenses.gainLossOnAssetSales,
        percentage: calculatePercentage(otherIncomeExpenses.gainLossOnAssetSales),
        details: []
      },
      total: totalOtherIncomeExpenses,
      details: otherIncomeExpenses.details
    },
    netIncomeBeforeTax: {
      amount: netIncomeBeforeTax,
      percentage: calculatePercentage(netIncomeBeforeTax)
    },
    incomeTaxExpense: {
      rate: taxRate,
      amount: incomeTaxExpense,
      percentage: calculatePercentage(incomeTaxExpense)
    },
    netIncome: {
      amount: netIncome,
      percentage: calculatePercentage(netIncome)
    }
  };
}
