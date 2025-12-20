// components/charts/ExpenseChart.jsx
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
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatCurrency } from '@/lib/currencyUtils';

/**
 * Expense Trend Chart Component
 * Displays expense data over time in a line chart
 */
export const ExpenseTrendChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No expense data available for visualization</p>
      </div>
    );
  }

  // Format date labels
  const formatXAxis = (value) => {
    // Extract month name from the month display name
    return value.split(' ')[0]; // Extract just the month name
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Monthly Expense Trend</h3>
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
            dataKey="month" 
            tickFormatter={formatXAxis}
            tick={{ fontSize: 12, fill: '#6B7280' }} 
          />
          <YAxis 
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 12, fill: '#6B7280' }} 
          />
          <Tooltip 
            formatter={(value) => formatCurrency(value)}
            labelFormatter={(value) => `Month: ${value}`}
            contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          <Line
            type="monotone"
            dataKey="total"
            name="Total Expenses"
            stroke="#EF4444"
            strokeWidth={2}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Expense by Category Chart Component
 * Displays expense breakdown by category in a pie chart
 */
export const ExpenseByCategoryChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No category data available for visualization</p>
      </div>
    );
  }

  // Sort data by total in descending order
  const sortedData = [...data].sort((a, b) => b.total - a.total);

  // Limit to top 5 categories
  const topCategories = sortedData.slice(0, 5);
  
  // Add an "Other" category if there are more categories
  if (sortedData.length > 5) {
    const otherTotal = sortedData.slice(5).reduce((sum, cat) => sum + cat.total, 0);
    topCategories.push({
      category: 'Other',
      total: otherTotal
    });
  }

  // Colors for the pie chart
  const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#6B7280'];

  // Custom label for the pie chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Expenses by Category</h3>
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={topCategories}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="total"
              nameKey="category"
            >
              {topCategories.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          {topCategories.map((category, index) => (
            <div key={index} className="flex items-center">
              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
              <div className="text-xs text-gray-700">
                <span className="font-medium">{category.category}</span>
                <span className="mx-1">:</span>
                <span>{formatCurrency(category.total)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
