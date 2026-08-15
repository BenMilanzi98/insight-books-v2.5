import { tt } from '@/lib/i18n/runtime';
// components/charts/SalesChart.jsx
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { formatCurrency } from '@/lib/currencyUtils';

/**
 * Sales Trend Chart Component
 * Displays sales data over time in a line chart
 */
export const SalesTrendChart = ({ data, groupBy = 'day' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{tt('No sales data available for visualization')}</p>
      </div>
    );
  }

  // Format date labels based on groupBy
  const formatXAxis = (value) => {
    if (groupBy === 'month') {
      // For month grouping, extract month name from YYYY-MM format
      const date = new Date(value + '-01'); // Add day to make a valid date
      return date.toLocaleDateString('default', { month: 'short', year: '2-digit' });
    } else if (groupBy === 'week') {
      // For week grouping, show first day of week
      return new Date(value).toLocaleDateString('default', { month: 'short', day: 'numeric' });
    } else {
      // For daily grouping, show day and month
      return new Date(value).toLocaleDateString('default', { month: 'short', day: 'numeric' });
    }
  };

  // Format tooltip values
  const formatTooltipValue = (value) => {
    return formatCurrency(value);
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4">{tt('Sales Trend')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxis}
            tick={{ fontSize: 12, fill: '#6B7280' }} 
          />
          <YAxis 
            tickFormatter={formatTooltipValue}
            tick={{ fontSize: 12, fill: '#6B7280' }} 
          />
          <Tooltip 
            formatter={formatTooltipValue}
            labelFormatter={(value) => `Date: ${formatXAxis(value)}`}
            contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          <Line
            type="monotone"
            dataKey="totalRevenue"
            name="Revenue"
            stroke="#3B82F6"
            strokeWidth={2}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="totalTax"
            name="Tax"
            stroke="#9CA3AF"
            strokeWidth={2}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Sales by Category Chart Component
 * Displays sales breakdown by category in a bar chart
 */
export const SalesByCategoryChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{tt('No category data available for visualization')}</p>
      </div>
    );
  }

  // Sort data by revenue in descending order
  const sortedData = [...data].sort((a, b) => b.revenue - a.revenue);

  // Limit to top 5 categories for clarity
  const topCategories = sortedData.slice(0, 5);

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4">{tt('Sales by Category')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={topCategories}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
          barSize={40}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="category" 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
          />
          <YAxis 
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 12, fill: '#6B7280' }} 
          />
          <Tooltip 
            formatter={(value) => formatCurrency(value)}
            contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          <Bar 
            dataKey="revenue" 
            name="Revenue" 
            fill="#4F46E5" 
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
