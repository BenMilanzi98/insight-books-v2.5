// app/api/financial/ratios/route.js
import { NextResponse } from 'next/server';

// Mock financial ratios data generator
const generateFinancialRatios = (timeframe) => {
  // Base profitability ratios
  const baseProfitability = {
    grossProfitMargin: 0.45, // 45%
    netProfitMargin: 0.18, // 18%
    returnOnAssets: 0.12, // 12%
    returnOnEquity: 0.22 // 22%
  };
  
  // Base liquidity ratios
  const baseLiquidity = {
    currentRatio: 2.5,
    quickRatio: 1.8,
    cashRatio: 0.9
  };
  
  // Base efficiency ratios
  const baseEfficiency = {
    inventoryTurnover: 6.0,
    receivablesTurnover: 8.5,
    payablesTurnover: 12.0,
    assetTurnover: 1.4
  };
  
  // Base solvency ratios
  const baseSolvency = {
    debtToEquity: 0.8,
    interestCoverage: 4.5,
    debtRatio: 0.45 // 45%
  };
  
  // Industry benchmarks
  const benchmarks = {
    grossProfitMargin: 0.42, // 42%
    netProfitMargin: 0.15, // 15%
    returnOnAssets: 0.10, // 10%
    returnOnEquity: 0.20, // 20%
    currentRatio: 2.0,
    quickRatio: 1.5,
    cashRatio: 0.8,
    inventoryTurnover: 5.0,
    receivablesTurnover: 7.0,
    payablesTurnover: 10.0,
    assetTurnover: 1.2,
    debtToEquity: 1.0,
    interestCoverage: 3.0,
    debtRatio: 0.5 // 50%
  };
  
  // Factors to adjust data based on timeframe
  let performanceFactor = 1;
  switch (timeframe) {
    case 'thisMonth':
      performanceFactor = 1.03; // 3% above baseline
      break;
    case 'lastMonth':
      performanceFactor = 0.98; // 2% below baseline
      break;
    case 'thisQuarter':
      performanceFactor = 1.05; // 5% above baseline
      break;
    case 'lastQuarter':
      performanceFactor = 1.0; // at baseline
      break;
    case 'thisYear':
      performanceFactor = 1.08; // 8% above baseline
      break;
    case 'lastYear':
      performanceFactor = 0.95; // 5% below baseline
      break;
    default:
      performanceFactor = 1;
  }
  
  // Generate random variance (±5%)
  const randomFactor = () => 0.95 + Math.random() * 0.1;
  
  // Calculate profitability ratios with performance factor and random variance
  const profitability = {
    grossProfitMargin: Math.round(baseProfitability.grossProfitMargin * performanceFactor * randomFactor() * 100) / 100,
    netProfitMargin: Math.round(baseProfitability.netProfitMargin * performanceFactor * randomFactor() * 100) / 100,
    returnOnAssets: Math.round(baseProfitability.returnOnAssets * performanceFactor * randomFactor() * 100) / 100,
    returnOnEquity: Math.round(baseProfitability.returnOnEquity * performanceFactor * randomFactor() * 100) / 100
  };
  
  // Calculate liquidity ratios with performance factor and random variance
  const liquidity = {
    currentRatio: Math.round(baseLiquidity.currentRatio * performanceFactor * randomFactor() * 100) / 100,
    quickRatio: Math.round(baseLiquidity.quickRatio * performanceFactor * randomFactor() * 100) / 100,
    cashRatio: Math.round(baseLiquidity.cashRatio * performanceFactor * randomFactor() * 100) / 100
  };
  
  // Calculate efficiency ratios with performance factor and random variance
  const efficiency = {
    inventoryTurnover: Math.round(baseEfficiency.inventoryTurnover * performanceFactor * randomFactor() * 100) / 100,
    receivablesTurnover: Math.round(baseEfficiency.receivablesTurnover * performanceFactor * randomFactor() * 100) / 100,
    payablesTurnover: Math.round(baseEfficiency.payablesTurnover * performanceFactor * randomFactor() * 100) / 100,
    assetTurnover: Math.round(baseEfficiency.assetTurnover * performanceFactor * randomFactor() * 100) / 100
  };
  
  // Calculate solvency ratios with performance factor and random variance
  // For solvency, lower values (except interest coverage) are generally better, so we invert the performance factor
  const solvencyPerformanceFactor = 2 - performanceFactor;
  
  const solvency = {
    debtToEquity: Math.round(baseSolvency.debtToEquity * solvencyPerformanceFactor * randomFactor() * 100) / 100,
    interestCoverage: Math.round(baseSolvency.interestCoverage * performanceFactor * randomFactor() * 100) / 100,
    debtRatio: Math.round(baseSolvency.debtRatio * solvencyPerformanceFactor * randomFactor() * 100) / 100
  };
  
  // Generate insights based on the calculated ratios
  const insights = [];
  
  // Add profitability insights
  if (profitability.netProfitMargin > benchmarks.netProfitMargin) {
    insights.push(`Your net profit margin of ${(profitability.netProfitMargin * 100).toFixed(1)}% is above the industry average of ${(benchmarks.netProfitMargin * 100).toFixed(1)}%.`);
  } else {
    insights.push(`Your net profit margin of ${(profitability.netProfitMargin * 100).toFixed(1)}% is below the industry average of ${(benchmarks.netProfitMargin * 100).toFixed(1)}%. Consider strategies to improve profitability.`);
  }
  
  // Add liquidity insights
  if (liquidity.currentRatio < benchmarks.currentRatio) {
    insights.push(`Your current ratio of ${liquidity.currentRatio.toFixed(2)} is below the recommended level of ${benchmarks.currentRatio.toFixed(2)}. Consider improving your short-term liquidity.`);
  }
  
  // Add efficiency insights
  if (efficiency.inventoryTurnover < benchmarks.inventoryTurnover) {
    insights.push(`Your inventory turnover of ${efficiency.inventoryTurnover.toFixed(2)} is below the industry average of ${benchmarks.inventoryTurnover.toFixed(2)}. Consider optimizing inventory management.`);
  }
  
  // Add solvency insights
  if (solvency.debtToEquity > benchmarks.debtToEquity) {
    insights.push(`Your debt-to-equity ratio of ${solvency.debtToEquity.toFixed(2)} is above the industry average of ${benchmarks.debtToEquity.toFixed(2)}. Consider strategies to reduce debt or increase equity.`);
  }
  
  return {
    timeframe,
    profitability,
    liquidity,
    efficiency,
    solvency,
    benchmarks,
    insights
  };
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || 'thisMonth';
  
  // Generate financial ratios data
  const ratiosData = generateFinancialRatios(timeframe);
  
  // Return the data
  return NextResponse.json(ratiosData);
}