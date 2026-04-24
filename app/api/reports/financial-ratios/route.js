import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateIncomeStatementFromAccounts } from '@/lib/incomeStatementService';
import { generateBalanceSheetFromAccounts } from '@/lib/balanceSheetService';

/**
 * Financial ratios for /reports — derived from the same GL-backed engines as
 * Profit & Loss and Balance Sheet (not raw invoice totals or legacy journal shapes).
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true, logoUrl: true }
    });

    const company = tenant?.name || 'Company';
    const logo = tenant?.logoUrl || null;
    const branchId = user.currentBranchId || null;

    const [income, balance] = await Promise.all([
      generateIncomeStatementFromAccounts(
        user.tenantId,
        startDate,
        endDate,
        company,
        logo,
        branchId
      ),
      generateBalanceSheetFromAccounts(
        user.tenantId,
        endDate,
        company,
        logo,
        branchId
      )
    ]);

    const totalRevenue = Number(income.totalRevenue) || 0;
    const cogsAmount =
      Number(income.cogs?.total ?? income.cogs?.costOfProductsSold ?? 0) || 0;
    const operatingExpenses = Number(income.totalOperatingExpenses) || 0;
    const grossProfit = Number(income.grossProfit) || 0;
    const netIncome = Number(income.netIncome) || 0;

    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netProfitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    const currentAssets = Number(balance.assets?.currentAssets?.total) || 0;
    const currentLiab = Number(balance.liabilities?.currentLiabilities?.total) || 0;
    const cash = Number(balance.assets?.currentAssets?.cashAndCashEquivalents) || 0;
    const ar = Number(balance.assets?.currentAssets?.accountsReceivable?.total) || 0;
    const inventory = Number(balance.assets?.currentAssets?.inventory?.total) || 0;

    const quickAssets = cash + ar;
    const totalAssets = Number(balance.totalAssets) || 0;
    const totalLiab = Number(balance.totalLiabilities) || 0;

    const currentRatio =
      currentLiab > 0
        ? currentAssets / currentLiab
        : Number(balance.ratios?.currentRatio) || 0;
    const quickRatio =
      currentLiab > 0
        ? quickAssets / currentLiab
        : Number(balance.ratios?.quickRatio) || 0;
    const debtToAssetRatio = totalAssets > 0 ? totalLiab / totalAssets : 0;

    const accountsReceivableTurnover = ar > 0 ? totalRevenue / ar : 0;
    const averageCollectionPeriod =
      accountsReceivableTurnover > 0 ? 365 / accountsReceivableTurnover : 0;
    const inventoryTurnover =
      inventory > 0 && cogsAmount > 0 ? cogsAmount / inventory : 0;

    return NextResponse.json({
      period: { startDate, endDate },
      profitabilityRatios: {
        grossProfitMargin: {
          value: grossProfitMargin.toFixed(2),
          formula: 'Gross Profit / Revenue × 100',
          description:
            'Gross profit after cost of goods sold, using the same revenue and COGS as the income statement',
          interpretation: interpretGrossProfitMargin(grossProfitMargin)
        },
        netProfitMargin: {
          value: netProfitMargin.toFixed(2),
          formula: 'Net Income / Revenue × 100',
          description: 'Net income as a percentage of sales revenue (same period as P&L)',
          interpretation: interpretNetProfitMargin(netProfitMargin)
        }
      },
      liquidityRatios: {
        currentRatio: {
          value: currentRatio.toFixed(2),
          formula: 'Current Assets / Current Liabilities',
          description: 'From balance sheet current sections as of the report end date',
          interpretation: interpretCurrentRatio(currentRatio)
        },
        quickRatio: {
          value: quickRatio.toFixed(2),
          formula: '(Cash + Accounts Receivable) / Current Liabilities',
          description: 'Liquidity excluding inventory',
          interpretation: interpretQuickRatio(quickRatio)
        }
      },
      solvencyRatios: {
        debtToAssetRatio: {
          value: debtToAssetRatio.toFixed(2),
          formula: 'Total Liabilities / Total Assets',
          description: 'Share of assets financed by liabilities (balance sheet totals)',
          interpretation: interpretDebtToAssetRatio(debtToAssetRatio)
        }
      },
      efficiencyRatios: {
        accountsReceivableTurnover: {
          value: accountsReceivableTurnover.toFixed(2),
          formula: 'Revenue / Accounts Receivable',
          description: 'Uses P&L revenue and balance sheet receivables (simplified, not average balance)',
          interpretation: interpretAccountsReceivableTurnover(accountsReceivableTurnover)
        },
        averageCollectionPeriod: {
          value: averageCollectionPeriod.toFixed(0),
          formula: '365 / Accounts Receivable Turnover',
          description: 'Approximate days of receivables implied by turnover',
          interpretation: interpretAverageCollectionPeriod(averageCollectionPeriod)
        },
        inventoryTurnover: {
          value: inventoryTurnover.toFixed(2),
          formula: 'COGS / Inventory',
          description: 'Uses income-statement COGS and balance sheet inventory',
          interpretation: interpretInventoryTurnover(inventoryTurnover)
        }
      },
      rawData: {
        revenue: totalRevenue,
        costOfGoodsSold: cogsAmount,
        operatingExpenses,
        grossProfit,
        netIncome,
        currentAssets,
        currentLiabilities: currentLiab,
        accountsReceivable: ar,
        inventory,
        cash
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

function interpretGrossProfitMargin(value) {
  if (value >= 30) return 'Excellent';
  if (value >= 20) return 'Good';
  if (value >= 10) return 'Average';
  if (value >= 5) return 'Below Average';
  return 'Poor';
}

function interpretNetProfitMargin(value) {
  if (value >= 15) return 'Excellent';
  if (value >= 8) return 'Good';
  if (value >= 3) return 'Average';
  if (value >= 0) return 'Below Average';
  return 'Poor';
}

function interpretCurrentRatio(value) {
  if (value >= 2) return 'Strong liquidity position';
  if (value >= 1.5) return 'Good liquidity position';
  if (value >= 1) return 'Adequate liquidity';
  return 'Potential liquidity issues';
}

function interpretQuickRatio(value) {
  if (value >= 1.5) return 'Strong ability to meet short-term obligations';
  if (value >= 1) return 'Adequate ability to meet short-term obligations';
  if (value >= 0.75) return 'Moderate ability to meet short-term obligations';
  return 'May struggle to meet short-term obligations';
}

function interpretDebtToAssetRatio(value) {
  if (value <= 0.2) return 'Very low leverage';
  if (value <= 0.4) return 'Low leverage';
  if (value <= 0.6) return 'Moderate leverage';
  return 'High leverage';
}

function interpretAccountsReceivableTurnover(value) {
  if (value >= 10) return 'Excellent collection efficiency';
  if (value >= 8) return 'Good collection efficiency';
  if (value >= 4) return 'Average collection efficiency';
  return 'Poor collection efficiency';
}

function interpretAverageCollectionPeriod(value) {
  if (value <= 30) return 'Excellent collection period';
  if (value <= 45) return 'Good collection period';
  if (value <= 60) return 'Average collection period';
  return 'Long collection period';
}

function interpretInventoryTurnover(value) {
  if (value >= 6) return 'Excellent Stock Management';
  if (value >= 4) return 'Good Stock Management';
  if (value >= 2) return 'Average Stock Management';
  return 'Poor Stock Management';
}
