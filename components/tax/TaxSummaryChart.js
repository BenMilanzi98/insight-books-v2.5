import { useState, React } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/lib/currencyUtils';

export default function TaxSummaryChart({ taxData }) {
  const [chartType, setChartType] = useState('bar');

  if (!taxData) return null;

  // Prepare data for charts
  const barChartData = [
    {
      name: 'Collected Tax',
      amount: taxData.collectedTaxes.totalCollectedTax,
      fill: '#3b82f6'
    },
    {
      name: 'Paid Tax',
      amount: taxData.paidTaxes.totalTaxPaid,
      fill: '#ef4444'
    },
    {
      name: 'Net Liability',
      amount: taxData.netTaxLiability,
      fill: '#10b981'
    }
  ];

  // Prepare data for pie chart - tax collected by rate
  const pieChartData = taxData.collectedTaxes.byRate.map(rate => ({
    name: `${rate.rate}% Rate`,
    value: rate.taxAmount
  }));

  // Colors for pie chart
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-sm rounded">
          <p className="font-medium text-gray-700">{label}</p>
          <p className="text-blue-600">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const PieCustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-sm rounded">
          <p className="font-medium text-gray-700">{payload[0].name}</p>
          <p className="text-blue-600">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Tax Summary Visualization</h2>
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 rounded text-sm ${
              chartType === 'bar'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setChartType('bar')}
          >
            Bar Chart
          </button>
          <button
            className={`px-3 py-1 rounded text-sm ${
              chartType === 'pie'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setChartType('pie')}
          >
            Pie Chart
          </button>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded border border-gray-200">
        <div className="h-80">
          {chartType === 'bar' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value, '', false)}
                  label={{ value: 'Amount', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name="Amount" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieCustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {chartType === 'pie' && (
        <div className="text-sm text-gray-500 mt-2 text-center">
          Showing breakdown of collected taxes by tax rate
        </div>
      )}
    </div>
  );
}