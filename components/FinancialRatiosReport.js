
// components/FinancialRatiosReport.jsx
import React from 'react';
import { FinancialReport } from './FinancialReportComponents';
import { extractReportReconciliationMeta } from '@/components/ReportReconciliationBadge';
import { formatCurrency, formatPercentage } from '@/lib/currencyUtils';
import { formatPeriodRange } from '@/lib/dateUtils';
import { PieChart, TrendingUp, BarChart, AlertCircle, CheckCircle, Info } from 'lucide-react';

/**
 * Component for Financial Ratios Report
 */
export const FinancialRatiosReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <PieChart size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  // Helper for displaying the interpretation with appropriate styling
  const renderInterpretation = (interpretation) => {
    const styles = {
      'Excellent': 'text-green-600',
      'Good': 'text-green-600',
      'Strong': 'text-green-600',
      'Average': 'text-yellow-600',
      'Adequate': 'text-yellow-600',
      'Moderate': 'text-yellow-600',
      'Below Average': 'text-orange-600',
      'Poor': 'text-red-600',
      'Low': 'text-blue-600',
      'Very low': 'text-blue-600',
      'High': 'text-red-600'
    };
    
    // Find which style to use based on the first word
    const firstWord = interpretation.split(' ')[0];
    const style = styles[firstWord] || 'text-gray-600';
    
    return <span className={`font-medium ${style}`}>{interpretation}</span>;
  };
  
  return (
    <FinancialReport
      title="Financial Ratios"
      subtitle={data?.period ? formatPeriodRange(data.period.startDate, data.period.endDate) : "Financial Health Indicators"}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
      reconciliationMeta={extractReportReconciliationMeta(data)}
    >
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Profitability Ratios */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <TrendingUp size={20} className="mr-2 text-green-600" />
                Profitability Ratios
              </h3>
              
              <div className="space-y-4">
                {Object.entries(data.profitabilityRatios).map(([key, ratio]) => (
                  <div key={key} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-700">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                      <span className="text-xl font-semibold">{ratio.value}%</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{ratio.description}</p>
                    
                    <div className="flex items-center text-sm">
                      <span className="mr-2">Interpretation:</span>
                      {renderInterpretation(ratio.interpretation)}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Formula: {ratio.formula}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Liquidity Ratios */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <BarChart size={20} className="mr-2 text-blue-600" />
                Liquidity Ratios
              </h3>
              
              <div className="space-y-4">
                {Object.entries(data.liquidityRatios).map(([key, ratio]) => (
                  <div key={key} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-700">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                      <span className="text-xl font-semibold">{ratio.value}</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{ratio.description}</p>
                    
                    <div className="flex items-center text-sm">
                      <span className="mr-2">Interpretation:</span>
                      {renderInterpretation(ratio.interpretation)}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Formula: {ratio.formula}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Solvency Ratios */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <AlertCircle size={20} className="mr-2 text-orange-600" />
                Solvency Ratios
              </h3>
              
              <div className="space-y-4">
                {Object.entries(data.solvencyRatios).map(([key, ratio]) => (
                  <div key={key} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-700">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                      <span className="text-xl font-semibold">{ratio.value}</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{ratio.description}</p>
                    
                    <div className="flex items-center text-sm">
                      <span className="mr-2">Interpretation:</span>
                      {renderInterpretation(ratio.interpretation)}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Formula: {ratio.formula}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Efficiency Ratios */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <CheckCircle size={20} className="mr-2 text-indigo-600" />
                Efficiency Ratios
              </h3>
              
              <div className="space-y-4">
                {Object.entries(data.efficiencyRatios).map(([key, ratio]) => (
                  <div key={key} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-700">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                      <span className="text-xl font-semibold">{ratio.value}</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{ratio.description}</p>
                    
                    <div className="flex items-center text-sm">
                      <span className="mr-2">Interpretation:</span>
                      {renderInterpretation(ratio.interpretation)}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Formula: {ratio.formula}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-8 bg-blue-50 p-6 rounded-lg border border-blue-100">
            <div className="flex items-start mb-4">
              <Info size={20} className="mr-2 text-blue-700 mt-1" />
              <div>
                <h3 className="text-lg font-medium text-blue-800 mb-2">What Do These Ratios Mean?</h3>
                <p className="text-sm text-blue-700">
                  Financial ratios provide insight into your business's performance and financial health. They help identify strengths, weaknesses, and trends that may not be immediately apparent from looking at individual financial statements.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <h4 className="font-medium text-blue-800 mb-2">Profitability</h4>
                <p className="text-sm text-blue-700">
                  These ratios indicate how effectively your business is generating profit relative to revenue, assets, or equity.
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <h4 className="font-medium text-blue-800 mb-2">Liquidity</h4>
                <p className="text-sm text-blue-700">
                  These ratios measure your business's ability to pay short-term obligations and meet unexpected cash needs.
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <h4 className="font-medium text-blue-800 mb-2">Solvency</h4>
                <p className="text-sm text-blue-700">
                  These ratios assess your business's long-term financial stability and ability to meet long-term obligations.
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <h4 className="font-medium text-blue-800 mb-2">Efficiency</h4>
                <p className="text-sm text-blue-700">
                  These ratios indicate how effectively your business is using its assets and managing its liabilities.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </FinancialReport>
  );
};