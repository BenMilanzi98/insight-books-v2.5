import { tt } from '@/lib/i18n/runtime';
// components/charts/FinancialRatiosChart.jsx
import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

/**
 * Financial Ratios Radar Chart Component
 * Displays financial ratios in a radar chart
 */
export const FinancialRatiosRadarChart = ({ data }) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{tt('No ratio data available for visualization')}</p>
      </div>
    );
  }

  // Transform the data structure for radar chart
  const transformRatioData = () => {
    const radarData = [];
    
    // Get profitability ratios
    if (data.profitabilityRatios) {
      Object.entries(data.profitabilityRatios).forEach(([key, ratio]) => {
        radarData.push({
          subject: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          A: parseFloat(ratio.value),
          fullMark: 100,
          category: 'Profitability'
        });
      });
    }
    
    // Get liquidity ratios
    if (data.liquidityRatios) {
      Object.entries(data.liquidityRatios).forEach(([key, ratio]) => {
        radarData.push({
          subject: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          A: parseFloat(ratio.value),
          fullMark: 3, // Typical good value for liquidity ratios
          category: 'Liquidity'
        });
      });
    }
    
    // Get efficiency ratios
    if (data.efficiencyRatios) {
      Object.entries(data.efficiencyRatios).forEach(([key, ratio]) => {
        // Skip average collection period as it uses different scale
        if (key !== 'averageCollectionPeriod') {
          radarData.push({
            subject: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
            A: parseFloat(ratio.value),
            fullMark: 12, // Typical good value for efficiency ratios
            category: 'Efficiency'
          });
        }
      });
    }
    
    return radarData;
  };

  const radarData = transformRatioData();

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-4">{tt('Financial Ratios Visualization')}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 'auto']} />
          <Radar
            name="Current Period"
            dataKey="A"
            stroke="#4F46E5"
            fill="#4F46E5"
            fillOpacity={0.6}
          />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <p className="text-sm text-gray-500 text-center">
          {tt('This radar chart visualizes how your financial ratios compare to each other. Higher values generally indicate better financial health.')}
        </p>
      </div>
    </div>
  );
};
