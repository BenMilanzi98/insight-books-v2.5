"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect } from "react";
import FinancialChart from "./FinancialChart";
import { fetchHistoricalComparison } from "@/services/financialReportingService";
import { calculateDateRange, getTimeframeLabel } from "@/lib/dateUtils";

const FinancialDashboardCharts = ({ timeframe = "thisMonth" }) => {
  const [activeTimeframe, setActiveTimeframe] = useState(timeframe);
  const [revenueData, setRevenueData] = useState([]);
  const [expensesData, setExpensesData] = useState([]);
  const [profitData, setProfitData] = useState([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState([]);
  const [salesByCategory, setSalesByCategory] = useState([]);
  const [loading, setLoading] = useState({
    revenue: true,
    expenses: true,
    profit: true,
    expenseBreakdown: true,
    salesByCategory: true
  });
  const [error, setError] = useState(null);

  // Function to load all chart data
  const loadChartData = async (selectedTimeframe) => {
    try {
      setLoading({
        revenue: true,
        expenses: true,
        profit: true,
        expenseBreakdown: true,
        salesByCategory: true
      });
      setError(null);

      // Load revenue trend data
      const revenueHistory = await fetchHistoricalComparison('revenue', {
        timeframe: selectedTimeframe
      });
      setRevenueData(formatTrendData(revenueHistory.data, 'revenue'));
      setLoading(prev => ({ ...prev, revenue: false }));

      // Load expenses trend data
      const expensesHistory = await fetchHistoricalComparison('expenses', {
        timeframe: selectedTimeframe
      });
      setExpensesData(formatTrendData(expensesHistory.data, 'expenses'));
      setLoading(prev => ({ ...prev, expenses: false }));

      // Load profit trend data
      const profitHistory = await fetchHistoricalComparison('profit', {
        timeframe: selectedTimeframe
      });
      setProfitData(formatTrendData(profitHistory.data, 'profit'));
      setLoading(prev => ({ ...prev, profit: false }));

      // Load expense breakdown data
      const expenseBreakdownData = await fetchHistoricalComparison('expenseBreakdown', {
        timeframe: selectedTimeframe
      });
      setExpenseBreakdown(formatBreakdownData(expenseBreakdownData.data));
      setLoading(prev => ({ ...prev, expenseBreakdown: false }));

      // Load sales by category data
      const salesByCategoryData = await fetchHistoricalComparison('salesByCategory', {
        timeframe: selectedTimeframe
      });
      setSalesByCategory(formatBreakdownData(salesByCategoryData.data));
      setLoading(prev => ({ ...prev, salesByCategory: false }));
    } catch (err) {
      console.error("Error loading chart data:", err);
      setError("Failed to load chart data. Please try again.");
      // Reset loading states
      setLoading({
        revenue: false,
        expenses: false,
        profit: false,
        expenseBreakdown: false,
        salesByCategory: false
      });
    }
  };

  // Load chart data when timeframe changes
  useEffect(() => {
    loadChartData(activeTimeframe);
  }, [activeTimeframe]);

  // Function to format trend data
  function formatTrendData(data, metricName) {
    if (!data || !Array.isArray(data)) {
      // Generate some sample data if API doesn't return real data
      return generateSampleTrendData(metricName);
    }

    return data.map(item => ({
      name: item.date || item.period,
      [metricName]: item.value,
      target: item.target
    }));
  }

  // Function to format breakdown data for pie charts
  function formatBreakdownData(data) {
    if (!data || !Array.isArray(data)) {
      // Generate some sample data if API doesn't return real data
      return generateSampleBreakdownData();
    }

    return data.map(item => ({
      name: item.category || item.name,
      value: item.amount || item.value
    }));
  }

  // Function to generate sample trend data for testing
  const generateSampleTrendData = (metricName) => {
    const { startDate, endDate } = calculateDateRange(activeTimeframe);
    const points = [];
    
    // Determine how many data points to generate based on timeframe
    let numPoints;
    let interval;
    
    if (activeTimeframe === 'thisMonth' || activeTimeframe === 'lastMonth') {
      numPoints = 30; // Daily for a month
      interval = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    } else if (activeTimeframe === 'thisQuarter' || activeTimeframe === 'lastQuarter') {
      numPoints = 12; // Weekly for a quarter
      interval = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
    } else {
      numPoints = 12; // Monthly for a year
      interval = 30 * 24 * 60 * 60 * 1000; // ~1 month in milliseconds
    }
    
    // Generate data points
    const startTimestamp = startDate.getTime();
    const totalTime = endDate.getTime() - startTimestamp;
    
    for (let i = 0; i < numPoints; i++) {
      const date = new Date(startTimestamp + (i * (totalTime / (numPoints - 1))));
      
      // Format the date label based on timeframe
      let name;
      if (activeTimeframe === 'thisMonth' || activeTimeframe === 'lastMonth') {
        name = date.toLocaleDateString('en-US', { day: 'numeric' });
      } else if (activeTimeframe === 'thisQuarter' || activeTimeframe === 'lastQuarter') {
        name = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        name = date.toLocaleDateString('en-US', { month: 'short' });
      }
      
      // Generate random value with an upward trend
      let value;
      
      if (metricName === 'revenue') {
        value = 300000 + Math.random() * 120000 + (i * 15000);
      } else if (metricName === 'expenses') {
        value = 180000 + Math.random() * 70000 + (i * 8000);
      } else if (metricName === 'profit') {
        value = 120000 + Math.random() * 60000 + (i * 7000);
      } else {
        value = 100000 + Math.random() * 50000 + (i * 5000);
      }
      
      // Add some random fluctuation
      value *= (0.85 + Math.random() * 0.3);
      
      // Add a target line
      const target = metricName === 'revenue' ? 460000 : 
                    metricName === 'expenses' ? 240000 : 200000;
      
      points.push({
        name,
        [metricName]: Math.round(value),
        target
      });
    }
    
    return points;
  };

  // Function to generate sample breakdown data
  const generateSampleBreakdownData = () => {
    if (Math.random() > 0.5) {
      // Expense categories
      return [
        { name: "Operations", value: 1250000 },
        { name: "Marketing", value: 870000 },
        { name: "Admin", value: 620000 },
        { name: "Rent", value: 430000 },
        { name: "Utilities", value: 280000 },
        { name: "Other", value: 395000 }
      ];
    } else {
      // Sales categories
      return [
        { name: "Product A", value: 2120000 },
        { name: "Product B", value: 1450000 },
        { name: "Product C", value: 980000 },
        { name: "Services", value: 1070000 }
      ];
    }
  };

  // Handle timeframe change for a specific chart
  const handleChartTimeframeChange = (chart, newTimeframe) => {
    // For simplicity, we'll update all charts when any timeframe changes
    setActiveTimeframe(newTimeframe);
  };

  return (
    <div className="mt-8 mb-8">
      {error && (
        <div className="bg-red-50 p-4 mb-6 rounded-md border border-red-200 text-red-700">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <FinancialChart
          title={tt('Revenue Trend')}
          data={revenueData}
          type="line"
          height={320}
          isLoading={loading.revenue}
          timeframe={activeTimeframe}
          onTimeframeChange={(newTimeframe) => handleChartTimeframeChange('revenue', newTimeframe)}
        />
        
        <FinancialChart
          title={tt('Expenses Trend')}
          data={expensesData}
          type="line"
          height={320}
          isLoading={loading.expenses}
          timeframe={activeTimeframe}
          onTimeframeChange={(newTimeframe) => handleChartTimeframeChange('expenses', newTimeframe)}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <FinancialChart
          title={tt('Profit Trend')}
          data={profitData}
          type="bar"
          height={280}
          isLoading={loading.profit}
          timeframe={activeTimeframe}
          onTimeframeChange={(newTimeframe) => handleChartTimeframeChange('profit', newTimeframe)}
        />
        
        <FinancialChart
          title={tt('Expense Breakdown')}
          data={expenseBreakdown}
          type="pie"
          height={280}
          isLoading={loading.expenseBreakdown}
        />
        
        <FinancialChart
          title={tt('Sales by Category')}
          data={salesByCategory}
          type="pie"
          height={280}
          isLoading={loading.salesByCategory}
        />
      </div>
    </div>
  );
};

export default FinancialDashboardCharts;