// lib/forecastingService.js
/**
 * Financial Forecasting Service
 * Generates financial forecasts based on historical data using various algorithms
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';

/**
 * Calculate moving average forecast
 * @param {Array} historicalData - Array of historical values
 * @param {Number} periods - Number of periods to forecast
 * @param {Number} windowSize - Size of moving average window
 */
function movingAverageForecast(historicalData, periods, windowSize = 3) {
  if (historicalData.length < windowSize) {
    // Not enough data, use simple average
    const avg = historicalData.reduce((sum, val) => sum + val, 0) / historicalData.length;
    return Array(periods).fill(avg);
  }

  const forecasts = [];
  const recentValues = historicalData.slice(-windowSize);
  const avg = recentValues.reduce((sum, val) => sum + val, 0) / windowSize;

  for (let i = 0; i < periods; i++) {
    forecasts.push(avg);
  }

  return forecasts;
}

/**
 * Calculate exponential smoothing forecast
 * @param {Array} historicalData - Array of historical values
 * @param {Number} periods - Number of periods to forecast
 * @param {Number} alpha - Smoothing factor (0-1)
 */
function exponentialSmoothingForecast(historicalData, periods, alpha = 0.3) {
  if (historicalData.length === 0) return Array(periods).fill(0);

  let forecast = historicalData[0];
  const forecasts = [];

  // Calculate smoothed values
  for (let i = 1; i < historicalData.length; i++) {
    forecast = alpha * historicalData[i] + (1 - alpha) * forecast;
  }

  // Project forward
  for (let i = 0; i < periods; i++) {
    forecasts.push(forecast);
  }

  return forecasts;
}

/**
 * Calculate trend-based forecast (linear regression)
 * @param {Array} historicalData - Array of historical values
 * @param {Number} periods - Number of periods to forecast
 */
function trendForecast(historicalData, periods) {
  if (historicalData.length < 2) {
    const avg = historicalData.length > 0 ? historicalData[0] : 0;
    return Array(periods).fill(avg);
  }

  const n = historicalData.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  // Calculate linear regression
  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = historicalData[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Forecast future periods
  const forecasts = [];
  for (let i = 1; i <= periods; i++) {
    const x = n + i;
    forecasts.push(slope * x + intercept);
  }

  return forecasts;
}

/**
 * Get historical account balance data for forecasting
 */
async function getHistoricalAccountData(accountId, tenantId, startDate, endDate, periodType = 'monthly') {
  const periods = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const periodEnd = new Date(current);
    
    if (periodType === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(0); // Last day of month
    } else if (periodType === 'quarterly') {
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      periodEnd.setDate(0);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 7); // Weekly
    }

    const balance = await getAccountBalanceDetails(accountId, tenantId, periodEnd, prisma);
    periods.push({
      date: new Date(periodEnd),
      balance: balance.balance
    });

    current = new Date(periodEnd);
    current.setDate(current.getDate() + 1);
  }

  return periods;
}

/**
 * Generate revenue forecast
 */
export async function generateRevenueForecast(tenantId, startDate, endDate, method = 'trend') {
  // Get revenue accounts
  const revenueAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Revenue',
      isActive: true
    }
  });

  const forecasts = [];

  for (const account of revenueAccounts) {
    // Get historical data (last 12 months)
    const historicalEnd = new Date(startDate);
    historicalEnd.setDate(historicalEnd.getDate() - 1);
    const historicalStart = new Date(historicalEnd);
    historicalStart.setMonth(historicalStart.getMonth() - 12);

    const historicalData = await getHistoricalAccountData(
      account.id,
      tenantId,
      historicalStart,
      historicalEnd,
      'monthly'
    );

    // Calculate period changes (not absolute balances)
    const periodChanges = [];
    for (let i = 1; i < historicalData.length; i++) {
      const change = historicalData[i].balance - historicalData[i - 1].balance;
      periodChanges.push(Math.abs(change)); // Revenue should be positive
    }

    // Calculate number of forecast periods
    const start = new Date(startDate);
    const end = new Date(endDate);
    const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                       (end.getMonth() - start.getMonth()) + 1;

    // Generate forecast based on method
    let forecastValues = [];
    if (method === 'moving_average') {
      forecastValues = movingAverageForecast(periodChanges, monthsDiff, 3);
    } else if (method === 'exponential_smoothing') {
      forecastValues = exponentialSmoothingForecast(periodChanges, monthsDiff, 0.3);
    } else {
      forecastValues = trendForecast(periodChanges, monthsDiff);
    }

    // Generate forecast periods
    const forecastPeriods = [];
    let currentDate = new Date(startDate);
    for (let i = 0; i < monthsDiff; i++) {
      forecastPeriods.push({
        period: new Date(currentDate),
        forecastedAmount: Math.max(0, forecastValues[i]), // Ensure non-negative
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    forecasts.push({
      account: {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName
      },
      historicalData: periodChanges,
      forecastPeriods,
      totalForecast: forecastValues.reduce((sum, val) => sum + val, 0)
    });
  }

  return {
    method,
    startDate,
    endDate,
    forecasts,
    totalForecast: forecasts.reduce((sum, f) => sum + f.totalForecast, 0),
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate expense forecast
 */
export async function generateExpenseForecast(tenantId, startDate, endDate, method = 'trend') {
  // Get expense accounts
  const expenseAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Expense',
      isActive: true
    }
  });

  const forecasts = [];

  for (const account of expenseAccounts) {
    // Get historical data (last 12 months)
    const historicalEnd = new Date(startDate);
    historicalEnd.setDate(historicalEnd.getDate() - 1);
    const historicalStart = new Date(historicalEnd);
    historicalStart.setMonth(historicalStart.getMonth() - 12);

    const historicalData = await getHistoricalAccountData(
      account.id,
      tenantId,
      historicalStart,
      historicalEnd,
      'monthly'
    );

    // Calculate period changes
    const periodChanges = [];
    for (let i = 1; i < historicalData.length; i++) {
      const change = historicalData[i].balance - historicalData[i - 1].balance;
      periodChanges.push(Math.abs(change)); // Expenses should be positive
    }

    // Calculate number of forecast periods
    const start = new Date(startDate);
    const end = new Date(endDate);
    const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                       (end.getMonth() - start.getMonth()) + 1;

    // Generate forecast
    let forecastValues = [];
    if (method === 'moving_average') {
      forecastValues = movingAverageForecast(periodChanges, monthsDiff, 3);
    } else if (method === 'exponential_smoothing') {
      forecastValues = exponentialSmoothingForecast(periodChanges, monthsDiff, 0.3);
    } else {
      forecastValues = trendForecast(periodChanges, monthsDiff);
    }

    // Generate forecast periods
    const forecastPeriods = [];
    let currentDate = new Date(startDate);
    for (let i = 0; i < monthsDiff; i++) {
      forecastPeriods.push({
        period: new Date(currentDate),
        forecastedAmount: Math.max(0, forecastValues[i]),
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    forecasts.push({
      account: {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName
      },
      historicalData: periodChanges,
      forecastPeriods,
      totalForecast: forecastValues.reduce((sum, val) => sum + val, 0)
    });
  }

  return {
    method,
    startDate,
    endDate,
    forecasts,
    totalForecast: forecasts.reduce((sum, f) => sum + f.totalForecast, 0),
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate cash flow forecast
 */
export async function generateCashFlowForecast(tenantId, startDate, endDate, method = 'trend') {
  // Get cash accounts
  const cashAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Asset',
      isActive: true,
      OR: [
        { accountName: { contains: 'Cash', mode: 'insensitive' } },
        { accountName: { contains: 'Bank', mode: 'insensitive' } },
        { accountCode: { in: ['1000', '1010', '1020', '1030', '1040', '1050'] } }
      ]
    }
  });

  // Generate revenue and expense forecasts
  const revenueForecast = await generateRevenueForecast(tenantId, startDate, endDate, method);
  const expenseForecast = await generateExpenseForecast(tenantId, startDate, endDate, method);

  // Get current cash balance
  let currentCashBalance = 0;
  for (const account of cashAccounts) {
    const balance = await getAccountBalanceDetails(account.id, tenantId, new Date(), prisma);
    currentCashBalance += balance.balance;
  }

  // Calculate forecast periods
  const start = new Date(startDate);
  const end = new Date(endDate);
  const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                     (end.getMonth() - start.getMonth()) + 1;

  // Aggregate revenue and expense forecasts by period
  const cashFlowPeriods = [];
  let runningBalance = currentCashBalance;

  for (let i = 0; i < monthsDiff; i++) {
    const periodDate = new Date(start);
    periodDate.setMonth(periodDate.getMonth() + i);

    // Sum revenue for this period
    const periodRevenue = revenueForecast.forecasts.reduce((sum, f) => {
      return sum + (f.forecastPeriods[i]?.forecastedAmount || 0);
    }, 0);

    // Sum expenses for this period
    const periodExpense = expenseForecast.forecasts.reduce((sum, f) => {
      return sum + (f.forecastPeriods[i]?.forecastedAmount || 0);
    }, 0);

    const netCashFlow = periodRevenue - periodExpense;
    runningBalance += netCashFlow;

    cashFlowPeriods.push({
      period: periodDate,
      openingBalance: runningBalance - netCashFlow,
      revenue: periodRevenue,
      expenses: periodExpense,
      netCashFlow,
      closingBalance: runningBalance
    });
  }

  return {
    method,
    startDate,
    endDate,
    currentCashBalance,
    cashFlowPeriods,
    finalBalance: runningBalance,
    totalRevenue: revenueForecast.totalForecast,
    totalExpenses: expenseForecast.totalForecast,
    netCashFlow: revenueForecast.totalForecast - expenseForecast.totalForecast,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate scenario forecasts (best case, worst case, most likely)
 */
export async function generateScenarioForecast(tenantId, startDate, endDate) {
  const scenarios = {
    bestCase: {
      name: 'Best Case',
      description: 'Optimistic scenario with 20% higher revenue and 10% lower expenses',
      revenueMultiplier: 1.2,
      expenseMultiplier: 0.9
    },
    worstCase: {
      name: 'Worst Case',
      description: 'Pessimistic scenario with 20% lower revenue and 10% higher expenses',
      revenueMultiplier: 0.8,
      expenseMultiplier: 1.1
    },
    mostLikely: {
      name: 'Most Likely',
      description: 'Base case scenario using trend forecast',
      revenueMultiplier: 1.0,
      expenseMultiplier: 1.0
    }
  };

  const results = {};

  for (const [key, scenario] of Object.entries(scenarios)) {
    const revenueForecast = await generateRevenueForecast(tenantId, startDate, endDate, 'trend');
    const expenseForecast = await generateExpenseForecast(tenantId, startDate, endDate, 'trend');

    results[key] = {
      ...scenario,
      revenue: revenueForecast.totalForecast * scenario.revenueMultiplier,
      expenses: expenseForecast.totalForecast * scenario.expenseMultiplier,
      netIncome: (revenueForecast.totalForecast * scenario.revenueMultiplier) - 
                 (expenseForecast.totalForecast * scenario.expenseMultiplier),
      revenueForecast: {
        ...revenueForecast,
        totalForecast: revenueForecast.totalForecast * scenario.revenueMultiplier,
        forecasts: revenueForecast.forecasts.map(f => ({
          ...f,
          totalForecast: f.totalForecast * scenario.revenueMultiplier,
          forecastPeriods: f.forecastPeriods.map(p => ({
            ...p,
            forecastedAmount: p.forecastedAmount * scenario.revenueMultiplier
          }))
        }))
      },
      expenseForecast: {
        ...expenseForecast,
        totalForecast: expenseForecast.totalForecast * scenario.expenseMultiplier,
        forecasts: expenseForecast.forecasts.map(f => ({
          ...f,
          totalForecast: f.totalForecast * scenario.expenseMultiplier,
          forecastPeriods: f.forecastPeriods.map(p => ({
            ...p,
            forecastedAmount: p.forecastedAmount * scenario.expenseMultiplier
          }))
        }))
      }
    };
  }

  return {
    startDate,
    endDate,
    scenarios: results,
    generatedAt: new Date().toISOString()
  };
}










