import { tt } from '@/lib/i18n/runtime';
// components/charts/TaxChart.jsx
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
 * Tax Collection Chart Component
 * Displays tax collected grouped by tax rate
 */
export const TaxCollectionChart = ({ data }) => {
  if (!data || !data.byRate || data.byRate.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{tt('No tax data available for visualization')}</p>
      </div>
    );
  }

  // Sort tax rates in ascending order
  const sortedRates = [...data.byRate].sort((a, b) => a.rate - b.rate);

  // Prepare data for the chart
  const chartData = sortedRates.map(taxRate => ({
    name: `${taxRate.rate}%`,
    taxableAmount: taxRate.taxableAmount,
    taxAmount: taxRate.taxAmount
  }));

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4">{tt('Tax Collected by Rate')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: '#6B7280' }} 
          />
          <YAxis 
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 12, fill: '#6B7280' }} 
          />
          <Tooltip 
            formatter={(value) => formatCurrency(value)}
            contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend />
          <Bar 
            dataKey="taxableAmount" 
            name="Taxable Amount" 
            fill="#9CA3AF" 
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            dataKey="taxAmount" 
            name="Tax Amount" 
            fill="#3B82F6" 
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Tax Summary Pie Chart Component
 * Displays tax collected vs tax paid
 */
export const TaxSummaryPieChart = ({ data }) => {
  if (!data || !data.collectedTaxes || !data.paidTaxes) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{tt('No tax summary data available for visualization')}</p>
      </div>
    );
  }

  // Prepare data for pie chart
  const pieData = [
    { name: 'Tax Collected', value: data.collectedTaxes.totalCollectedTax },
    { name: 'Tax Paid', value: data.paidTaxes.totalTaxPaid }
  ];

  // Colors for the pie chart
  const COLORS = ['#3B82F6', '#F87171'];

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
      <h3 className="text-lg font-medium text-gray-800 mb-4">{tt('Tax Overview')}</h3>
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
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="flex flex-col items-center mt-4">
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <p className="text-sm text-gray-600">{tt('Tax Collected')}</p>
              <p className="text-lg font-semibold text-blue-600">
                {formatCurrency(data.collectedTaxes.totalCollectedTax)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">{tt('Tax Paid')}</p>
              <p className="text-lg font-semibold text-red-500">
                {formatCurrency(data.paidTaxes.totalTaxPaid)}
              </p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">{tt('Net Tax Position')}</p>
            <p className={`text-lg font-semibold ${data.netTaxLiability >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.netTaxLiability >= 0 
                ? `Liability: ${formatCurrency(data.netTaxLiability)}`
                : `Credit: ${formatCurrency(Math.abs(data.netTaxLiability))}`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};