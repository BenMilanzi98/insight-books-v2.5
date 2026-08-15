// components/COGSSummaryChart.js
"use client";
import { tt } from '@/lib/i18n/runtime';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COGSSummaryChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 mb-2">📊</div>
          <p className="text-gray-500">{tt('No COGS data available')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month" 
            fontSize={12}
            tick={{ fill: '#6B7280' }}
          />
          <YAxis 
            fontSize={12}
            tick={{ fill: '#6B7280' }}
            tickFormatter={(value) => `MK ${value.toLocaleString()}`}
          />
          <Tooltip 
            formatter={(value) => [`MK ${value.toLocaleString()}`, 'COGS Amount']}
            labelStyle={{ color: '#374151' }}
            contentStyle={{ 
              backgroundColor: '#F9FAFB', 
              border: '1px solid #E5E7EB',
              borderRadius: '8px'
            }}
          />
          <Bar 
            dataKey="amount" 
            fill="#3B82F6" 
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default COGSSummaryChart;


