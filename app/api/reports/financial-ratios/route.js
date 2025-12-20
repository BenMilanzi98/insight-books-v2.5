// app/api/reports/financial-ratios/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    
    // Calculate key financial metrics
    
    // 1. Revenue
    const revenue = await prisma.$queryRaw`
      SELECT 
        SUM(COALESCE((SELECT SUM(total) FROM "Invoice" WHERE "tenantId" = ${user.tenantId} AND "issueDate" BETWEEN ${startDate}::date AND ${endDate}::date), 0)) + 
        SUM(COALESCE((SELECT SUM(total) FROM "Sale" WHERE "tenantId" = ${user.tenantId} AND "saleDate" BETWEEN ${startDate}::date AND ${endDate}::date), 0)) as total
    `;
    
    // 2. Expenses
    const expenses = await prisma.expense.aggregate({
      where: {
        tenantId: user.tenantId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      _sum: {
        amount: true
      }
    });
    
    // 3. Accounts Receivable
    const accountsReceivable = await prisma.invoice.aggregate({
      where: {
        tenantId: user.tenantId,
        status: 'Pending',
        issueDate: {
          lte: new Date(endDate)
        }
      },
      _sum: {
        total: true
      }
    });
    
    // 4. Current Assets (Cash + Accounts Receivable + Inventory)
    // This is a simplification - in a real system, you'd get actual cash balances from accounts
    const cashAccounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        type: 'Asset',
        name: {
          contains: 'Cash'
        }
      },
      include: {
        journalEntries: {
          where: {
            transaction: {
              date: {
                lte: new Date(endDate)
              }
            }
          }
        }
      }
    });
    
    // Calculate cash balance
    let cashBalance = 0;
    cashAccounts.forEach(account => {
      account.journalEntries.forEach(entry => {
        cashBalance += entry.debit - entry.credit;
      });
    });
    
    // Get inventory value
    const inventoryValue = await prisma.product.aggregate({
      where: {
        tenantId: user.tenantId,
        isService: false
      },
      _sum: {
        stockLevel: true
      }
    });
    
    const avgProductCost = await prisma.product.aggregate({
      where: {
        tenantId: user.tenantId,
        isService: false,
        cost: {
          not: null
        }
      },
      _avg: {
        cost: true
      }
    });
    
    const estimatedInventoryValue = 
      (inventoryValue._sum.stockLevel || 0) * (avgProductCost._avg.cost || 0);
    
    const currentAssets = cashBalance + 
      (accountsReceivable._sum.total || 0) + 
      estimatedInventoryValue;
    
    // 5. Current Liabilities (short-term obligations)
    const currentLiabilities = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        type: 'Liability',
        // This is a simplification - in a real system, you'd have a way to identify current vs. long-term liabilities
        name: {
          contains: 'Current'
        }
      },
      include: {
        journalEntries: {
          where: {
            transaction: {
              date: {
                lte: new Date(endDate)
              }
            }
          }
        }
      }
    });
    
    // Calculate current liabilities balance
    let currentLiabilitiesBalance = 0;
    currentLiabilities.forEach(account => {
      account.journalEntries.forEach(entry => {
        currentLiabilitiesBalance += entry.credit - entry.debit;
      });
    });
    
    // Calculate financial ratios
    
    // 1. Gross Profit Margin
    const totalRevenue = revenue[0]?.total || 0;
    const totalExpenses = expenses._sum.amount || 0;
    const grossProfit = totalRevenue - totalExpenses;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    
    // 2. Current Ratio
    const currentRatio = currentLiabilitiesBalance > 0 ? 
      currentAssets / currentLiabilitiesBalance : 
      0;
    
    // 3. Quick Ratio (Acid Test)
    const quickAssets = cashBalance + (accountsReceivable._sum.total || 0);
    const quickRatio = currentLiabilitiesBalance > 0 ? 
      quickAssets / currentLiabilitiesBalance : 
      0;
    
    // 4. Debt-to-Asset Ratio
    const totalAssets = currentAssets; // Simplified; would include non-current assets in a real system
    const debtToAssetRatio = totalAssets > 0 ? 
      currentLiabilitiesBalance / totalAssets : 
      0;
    
    // 5. Accounts Receivable Turnover
    const averageAccountsReceivable = accountsReceivable._sum.total || 0; // Simplified; would average start and end values
    const accountsReceivableTurnover = averageAccountsReceivable > 0 ? 
      totalRevenue / averageAccountsReceivable : 
      0;
    
    // 6. Average Collection Period
    const averageCollectionPeriod = accountsReceivableTurnover > 0 ? 
      365 / accountsReceivableTurnover : 
      0;
    
    // 7. Inventory Turnover Ratio
    // This would require cost of goods sold, which we don't have directly
    // As a simplification, we'll use expenses as a proxy
    const inventoryTurnover = estimatedInventoryValue > 0 ? 
      totalExpenses / estimatedInventoryValue : 
      0;
    
    return NextResponse.json({
      period: {
        startDate,
        endDate
      },
      profitabilityRatios: {
        grossProfitMargin: {
          value: grossProfitMargin.toFixed(2),
          formula: "Gross Profit / Revenue × 100",
          description: "Measures the efficiency of converting revenue into profit before operating expenses",
          interpretation: interpretGrossProfitMargin(grossProfitMargin)
        }
      },
      liquidityRatios: {
        currentRatio: {
          value: currentRatio.toFixed(2),
          formula: "Current Assets / Current Liabilities",
          description: "Measures the ability to pay short-term obligations",
          interpretation: interpretCurrentRatio(currentRatio)
        },
        quickRatio: {
          value: quickRatio.toFixed(2),
          formula: "(Cash + Accounts Receivable) / Current Liabilities",
          description: "Stricter measure of ability to pay short-term obligations without selling inventory",
          interpretation: interpretQuickRatio(quickRatio)
        }
      },
      solvencyRatios: {
        debtToAssetRatio: {
          value: debtToAssetRatio.toFixed(2),
          formula: "Total Liabilities / Total Assets",
          description: "Shows the proportion of assets financed through debt",
          interpretation: interpretDebtToAssetRatio(debtToAssetRatio)
        }
      },
      efficiencyRatios: {
        accountsReceivableTurnover: {
          value: accountsReceivableTurnover.toFixed(2),
          formula: "Net Credit Sales / Average Accounts Receivable",
          description: "Measures how efficiently a company collects revenue",
          interpretation: interpretAccountsReceivableTurnover(accountsReceivableTurnover)
        },
        averageCollectionPeriod: {
          value: averageCollectionPeriod.toFixed(0),
          formula: "365 / Accounts Receivable Turnover",
          description: "Average number of days to collect payment after a sale",
          interpretation: interpretAverageCollectionPeriod(averageCollectionPeriod)
        },
        inventoryTurnover: {
          value: inventoryTurnover.toFixed(2),
          formula: "Cost of Goods Sold / Average Inventory",
          description: "Measures how quickly inventory is sold",
          interpretation: interpretInventoryTurnover(inventoryTurnover)
        }
      },
      rawData: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        grossProfit,
        currentAssets,
        currentLiabilities: currentLiabilitiesBalance,
        accountsReceivable: accountsReceivable._sum.total || 0,
        inventory: estimatedInventoryValue
      }
    });
  } catch (error) {
    console.error('Error generating financial ratios report:', error);
    return NextResponse.json(
      { error: 'Failed to generate financial ratios report. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper functions for financial ratio interpretation
function interpretGrossProfitMargin(value) {
    if (value >= 30) return "Excellent";
    if (value >= 20) return "Good";
    if (value >= 10) return "Average";
    if (value >= 5) return "Below Average";
    return "Poor";
  }
  
  function interpretCurrentRatio(value) {
    if (value >= 2) return "Strong liquidity position";
    if (value >= 1.5) return "Good liquidity position";
    if (value >= 1) return "Adequate liquidity";
    return "Potential liquidity issues";
  }
  
  function interpretQuickRatio(value) {
    if (value >= 1.5) return "Strong ability to meet short-term obligations";
    if (value >= 1) return "Adequate ability to meet short-term obligations";
    if (value >= 0.75) return "Moderate ability to meet short-term obligations";
    return "May struggle to meet short-term obligations";
  }
  
  function interpretDebtToAssetRatio(value) {
    if (value <= 0.2) return "Very low leverage";
    if (value <= 0.4) return "Low leverage";
    if (value <= 0.6) return "Moderate leverage";
    return "High leverage";
  }
  
  function interpretAccountsReceivableTurnover(value) {
    if (value >= 10) return "Excellent collection efficiency";
    if (value >= 8) return "Good collection efficiency";
    if (value >= 4) return "Average collection efficiency";
    return "Poor collection efficiency";
  }
  
  function interpretAverageCollectionPeriod(value) {
    if (value <= 30) return "Excellent collection period";
    if (value <= 45) return "Good collection period";
    if (value <= 60) return "Average collection period";
    return "Long collection period";
  }
  
  function interpretInventoryTurnover(value) {
    if (value >= 6) return "Excellent inventory management";
    if (value >= 4) return "Good inventory management";
    if (value >= 2) return "Average inventory management";
    return "Poor inventory management";
  }
  