// components/charts/InventoryChart.jsx
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatCurrency } from '@/lib/currencyUtils';

/**
 * Inventory by Category Chart Component
 * Displays inventory value breakdown by category
 */
export const InventoryByCategoryChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No inventory category data available for visualization</p>
      </div>
    );
  }

  // Sort data by value in descending order
  const sortedData = [...data].sort((a, b) => b.totalValue - a.totalValue);

  // Limit to top 6 categories for clarity
  const topCategories = sortedData.slice(0, 6);
  
  // Colors for the pie chart
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#6B7280'];

  // Prepare data for pie chart
  const pieData = topCategories.map(category => ({
    name: category.category,
    value: category.totalValue
  }));

  // Custom label for the pie chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show labels for small slices

    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Inventory Value by Category</h3>
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {topCategories.map((category, index) => (
            <div key={index} className="flex items-center">
              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
              <div className="text-xs text-gray-700">
                <span className="font-medium">{category.category}</span>
                <span className="mx-1">:</span>
                <span>{formatCurrency(category.totalValue)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Inventory Stock Levels Chart Component
 * Displays inventory stock levels in a bar chart
 */
export const InventoryStockLevelsChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No inventory data available for visualization</p>
      </div>
    );
  }

  // Sort data by stock value in descending order
  const sortedData = [...data]
    .filter(item => item.stockLevel > 0)
    .sort((a, b) => b.stockValue - a.stockValue);

  // Limit to top 10 items for clarity
  const topItems = sortedData.slice(0, 10).map(item => ({
    name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
    stockLevel: item.stockLevel,
    stockValue: item.stockValue,
    reorderPoint: item.reorderPoint || 0
  }));

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Top 10 Items by Value</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={topItems}
          layout="vertical"
          margin={{
            top: 5,
            right: 30,
            left: 100, // Increased for longer product names
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            type="number"
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 12, fill: '#6B7280' }} 
          />
          <YAxis 
            type="category"
            dataKey="name" 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            width={100}
          />
          <Tooltip 
            formatter={(value, name) => [
              name === 'stockValue' ? formatCurrency(value) : value,
              name === 'stockValue' ? 'Value' : (name === 'stockLevel' ? 'Quantity' : 'Reorder Point')
            ]}
            contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          <Bar 
            dataKey="stockValue" 
            name="Stock Value" 
            fill="#3B82F6" 
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
