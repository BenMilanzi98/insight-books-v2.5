// components/ReportVisualizations.jsx
import React from 'react';
import { 
  SalesTrendChart, 
  SalesByCategoryChart 
} from './charts/SalesChart';
import { 
  ExpenseTrendChart, 
  ExpenseByCategoryChart 
} from './charts/ExpenseChart';
import { 
  InventoryByCategoryChart, 
  InventoryStockLevelsChart 
} from './charts/InventoryChart';
import { 
  TaxCollectionChart, 
  TaxSummaryPieChart 
} from './charts/TaxChart';
import {
  FinancialRatiosRadarChart
} from './charts/FinancialRatiosChart';

/**
 * Sales Report Visualizations
 */
export const SalesReportVisualizations = ({ data }) => {
  if (!data) return null;
  
  // Prepare data for sales trend chart
  const trendData = data.salesByDate || [];
  
  // Prepare data for sales by category/product chart
  const categoryData = data.salesByProduct?.map(product => ({
    category: product.productName,
    revenue: product.revenue,
    quantity: product.quantity
  })) || [];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <SalesTrendChart data={trendData} groupBy={data.groupBy} />
      <SalesByCategoryChart data={categoryData} />
    </div>
  );
};

/**
 * Expense Report Visualizations
 */
export const ExpenseReportVisualizations = ({ data }) => {
  if (!data) return null;
  
  // Prepare data for expense trend chart
  const trendData = data.expensesByMonth || [];
  
  // Prepare data for expense by category chart
  const categoryData = data.expensesByCategory || [];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <ExpenseTrendChart data={trendData} />
      <ExpenseByCategoryChart data={categoryData} />
    </div>
  );
};

/**
 * Inventory Report Visualizations
 */
export const InventoryReportVisualizations = ({ data }) => {
  if (!data) return null;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <InventoryByCategoryChart data={data.inventoryByCategory} />
      <InventoryStockLevelsChart data={data.inventoryItems} />
    </div>
  );
};

/**
 * Tax Report Visualizations
 */
export const TaxReportVisualizations = ({ data }) => {
  if (!data) return null;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <TaxCollectionChart data={data.collectedTaxes} />
      <TaxSummaryPieChart data={data} />
    </div>
  );
};

/**
 * Financial Ratios Visualizations
 */
export const FinancialRatiosVisualizations = ({ data }) => {
  if (!data) return null;
  
  return (
    <div className="mb-8">
      <FinancialRatiosRadarChart data={data} />
    </div>
  );
};