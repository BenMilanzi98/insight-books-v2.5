// lib/financialRatiosUtils.js

/**
 * Calculate profitability ratios
 * @param {Object} data - Financial data
 * @returns {Object} Profitability ratios
 */
export const calculateProfitabilityRatios = (data) => {
    const { revenue, expenses, assets, equity } = data;
    
    // Ensure we have valid numbers to prevent division by zero
    const totalRevenue = typeof revenue === 'number' ? revenue : 0;
    const totalExpenses = typeof expenses === 'number' ? expenses : 0;
    const totalAssets = typeof assets === 'number' ? assets : 0;
    const totalEquity = typeof equity === 'number' ? equity : 0;
    
    // Calculate profit
    const profit = totalRevenue - totalExpenses;
    
    // Gross Profit Margin
    const grossProfitMargin = totalRevenue > 0 
      ? (profit / totalRevenue) * 100 
      : 0;
    
    // Return on Assets (ROA)
    const returnOnAssets = totalAssets > 0 
      ? (profit / totalAssets) * 100 
      : 0;
    
    // Return on Equity (ROE)
    const returnOnEquity = totalEquity > 0 
      ? (profit / totalEquity) * 100 
      : 0;
    
    return {
      grossProfitMargin: {
        value: grossProfitMargin.toFixed(2),
        formula: "Gross Profit / Revenue × 100",
        description: "Measures the efficiency of converting revenue into profit before operating expenses",
        interpretation: interpretGrossProfitMargin(grossProfitMargin)
      },
      returnOnAssets: {
        value: returnOnAssets.toFixed(2),
        formula: "Net Profit / Total Assets × 100",
        description: "Indicates how efficiently a company is using its assets to generate profit",
        interpretation: interpretReturnOnAssets(returnOnAssets)
      },
      returnOnEquity: {
        value: returnOnEquity.toFixed(2),
        formula: "Net Profit / Total Equity × 100",
        description: "Measures how efficiently a company uses investments to generate earnings growth",
        interpretation: interpretReturnOnEquity(returnOnEquity)
      }
    };
  };
  
  /**
   * Calculate liquidity ratios
   * @param {Object} data - Financial data
   * @returns {Object} Liquidity ratios
   */
  export const calculateLiquidityRatios = (data) => {
    const { 
      currentAssets, 
      currentLiabilities, 
      cash, 
      accountsReceivable, 
      inventory 
    } = data;
    
    // Ensure we have valid numbers
    const totalCurrentAssets = typeof currentAssets === 'number' ? currentAssets : 0;
    const totalCurrentLiabilities = typeof currentLiabilities === 'number' ? currentLiabilities : 0;
    const totalCash = typeof cash === 'number' ? cash : 0;
    const totalAccountsReceivable = typeof accountsReceivable === 'number' ? accountsReceivable : 0;
    const totalInventory = typeof inventory === 'number' ? inventory : 0;
    
    // Current Ratio
    const currentRatio = totalCurrentLiabilities > 0 
      ? totalCurrentAssets / totalCurrentLiabilities 
      : 0;
    
    // Quick Ratio (Acid Test)
    const quickRatio = totalCurrentLiabilities > 0 
      ? (totalCash + totalAccountsReceivable) / totalCurrentLiabilities 
      : 0;
    
    // Cash Ratio
    const cashRatio = totalCurrentLiabilities > 0 
      ? totalCash / totalCurrentLiabilities 
      : 0;
    
    return {
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
      },
      cashRatio: {
        value: cashRatio.toFixed(2),
        formula: "Cash / Current Liabilities",
        description: "Measures ability to cover short-term liabilities with cash and cash equivalents",
        interpretation: interpretCashRatio(cashRatio)
      }
    };
  };
  
  /**
   * Calculate solvency ratios
   * @param {Object} data - Financial data
   * @returns {Object} Solvency ratios
   */
  export const calculateSolvencyRatios = (data) => {
    const { totalAssets, totalLiabilities, totalEquity, profit, interestExpense } = data;
    
    // Ensure we have valid numbers
    const assets = typeof totalAssets === 'number' ? totalAssets : 0;
    const liabilities = typeof totalLiabilities === 'number' ? totalLiabilities : 0;
    const equity = typeof totalEquity === 'number' ? totalEquity : 0;
    const netProfit = typeof profit === 'number' ? profit : 0;
    const interest = typeof interestExpense === 'number' ? interestExpense : 0;
    
    // Debt-to-Asset Ratio
    const debtToAssetRatio = assets > 0 
      ? liabilities / assets 
      : 0;
    
    // Debt-to-Equity Ratio
    const debtToEquityRatio = equity > 0 
      ? liabilities / equity 
      : 0;
    
    // Interest Coverage Ratio
    const interestCoverageRatio = interest > 0 
      ? (netProfit + interest) / interest 
      : 0;
    
    return {
      debtToAssetRatio: {
        value: debtToAssetRatio.toFixed(2),
        formula: "Total Liabilities / Total Assets",
        description: "Shows the proportion of assets financed through debt",
        interpretation: interpretDebtToAssetRatio(debtToAssetRatio)
      },
      debtToEquityRatio: {
        value: debtToEquityRatio.toFixed(2),
        formula: "Total Liabilities / Total Equity",
        description: "Indicates the relative proportion of shareholder's equity and debt used to finance assets",
        interpretation: interpretDebtToEquityRatio(debtToEquityRatio)
      },
      interestCoverageRatio: {
        value: interestCoverageRatio.toFixed(2),
        formula: "(Net Profit + Interest Expense) / Interest Expense",
        description: "Measures ability to pay interest on outstanding debt",
        interpretation: interpretInterestCoverageRatio(interestCoverageRatio)
      }
    };
  };
  
  /**
   * Calculate efficiency ratios
   * @param {Object} data - Financial data
   * @returns {Object} Efficiency ratios
   */
  export const calculateEfficiencyRatios = (data) => {
    const { 
      revenue, 
      accountsReceivable, 
      accountsPayable,
      inventory,
      costOfGoodsSold,
      expenses
    } = data;
    
    // Ensure we have valid numbers
    const totalRevenue = typeof revenue === 'number' ? revenue : 0;
    const totalAccountsReceivable = typeof accountsReceivable === 'number' ? accountsReceivable : 0;
    const totalAccountsPayable = typeof accountsPayable === 'number' ? accountsPayable : 0;
    const totalInventory = typeof inventory === 'number' ? inventory : 0;
    const totalCOGS = typeof costOfGoodsSold === 'number' ? costOfGoodsSold : 0;
    const totalExpenses = typeof expenses === 'number' ? expenses : 0;
    
    // Accounts Receivable Turnover
    const accountsReceivableTurnover = totalAccountsReceivable > 0 
      ? totalRevenue / totalAccountsReceivable 
      : 0;
    
    // Average Collection Period
    const averageCollectionPeriod = accountsReceivableTurnover > 0 
      ? 365 / accountsReceivableTurnover 
      : 0;
    
    // Inventory Turnover Ratio
    // If COGS is not available, use expenses as proxy
    const inventoryTurnover = totalInventory > 0 
      ? (totalCOGS > 0 ? totalCOGS : totalExpenses) / totalInventory 
      : 0;
    
    // Days Inventory Outstanding
    const daysInventoryOutstanding = inventoryTurnover > 0 
      ? 365 / inventoryTurnover 
      : 0;
    
    return {
      accountsReceivableTurnover: {
        value: accountsReceivableTurnover.toFixed(2),
        formula: "Revenue / Accounts Receivable",
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
      },
      daysInventoryOutstanding: {
        value: daysInventoryOutstanding.toFixed(0),
        formula: "365 / Inventory Turnover",
        description: "Average number of days to sell inventory",
        interpretation: interpretDaysInventoryOutstanding(daysInventoryOutstanding)
      }
    };
  };
  
  /**
   * Calculate all financial ratios
   * @param {Object} data - Financial data
   * @returns {Object} All financial ratios
   */
  export const calculateFinancialRatios = (data) => {
    return {
      profitabilityRatios: calculateProfitabilityRatios(data),
      liquidityRatios: calculateLiquidityRatios(data),
      solvencyRatios: calculateSolvencyRatios(data),
      efficiencyRatios: calculateEfficiencyRatios(data),
      rawData: {
        revenue: data.revenue || 0,
        expenses: data.expenses || 0,
        profit: (data.revenue || 0) - (data.expenses || 0),
        assets: data.totalAssets || 0,
        liabilities: data.totalLiabilities || 0,
        equity: data.totalEquity || 0,
        currentAssets: data.currentAssets || 0,
        currentLiabilities: data.currentLiabilities || 0,
        cash: data.cash || 0,
        accountsReceivable: data.accountsReceivable || 0,
        inventory: data.inventory || 0
      }
    };
  };
  
  // Helper functions for interpreting ratios
  
  function interpretGrossProfitMargin(value) {
    if (value >= 30) return "Excellent profitability";
    if (value >= 20) return "Good profitability";
    if (value >= 10) return "Average profitability";
    if (value >= 5) return "Below average profitability";
    return "Poor profitability";
  }
  
  function interpretReturnOnAssets(value) {
    if (value >= 20) return "Excellent asset utilization";
    if (value >= 10) return "Good asset utilization";
    if (value >= 5) return "Average asset utilization";
    if (value >= 2) return "Below average asset utilization";
    return "Poor asset utilization";
  }
  
  function interpretReturnOnEquity(value) {
    if (value >= 25) return "Excellent performance";
    if (value >= 15) return "Good performance";
    if (value >= 10) return "Average performance";
    if (value >= 5) return "Below average performance";
    return "Poor performance";
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
  
  function interpretCashRatio(value) {
    if (value >= 0.75) return "Excellent cash reserve";
    if (value >= 0.5) return "Good cash reserve";
    if (value >= 0.25) return "Adequate cash reserve";
    return "Limited cash reserve";
  }
  
  function interpretDebtToAssetRatio(value) {
    if (value <= 0.2) return "Very low leverage";
    if (value <= 0.4) return "Low leverage";
    if (value <= 0.6) return "Moderate leverage";
    return "High leverage";
  }
  
  function interpretDebtToEquityRatio(value) {
    if (value <= 0.5) return "Very conservative financing";
    if (value <= 1) return "Conservative financing";
    if (value <= 2) return "Moderate financing risk";
    return "Aggressive financing strategy";
  }
  
  function interpretInterestCoverageRatio(value) {
    if (value >= 5) return "Strong ability to cover interest payments";
    if (value >= 3) return "Adequate ability to cover interest payments";
    if (value >= 1.5) return "Moderate ability to cover interest payments";
    return "Risk of not meeting interest payments";
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
  
  function interpretDaysInventoryOutstanding(value) {
    if (value <= 30) return "Very efficient inventory management";
    if (value <= 60) return "Efficient inventory management";
    if (value <= 90) return "Average inventory management";
    return "Slow-moving inventory";
  }