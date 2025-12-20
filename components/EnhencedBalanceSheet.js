// components/EnhancedBalanceSheet.jsx
import React from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import { Info, Download, Save, Loader2 } from 'lucide-react';
import { PercentageChange } from '@/components/FinancialReportComponents';

const EnhancedBalanceSheet = ({ 
  balanceSheet, 
  timeframe, 
  loading, 
  error, 
  onRefresh, 
  periodLabel = '',
  comparisonData = null 
}) => {
  // If we're loading or have an error or no data, show appropriate message
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 flex flex-col items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Loading balance sheet data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 flex flex-col items-center justify-center">
        <div className="p-3 bg-red-50 text-red-700 rounded-md inline-flex items-center mb-4">
          <Info size={20} className="mr-2" />
          <span>{error}</span>
        </div>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          onClick={onRefresh}
        >
          Try Again
        </button>
      </div>
    );
  }
  
  if (!balanceSheet || !balanceSheet.assets) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 flex flex-col items-center justify-center">
        <div className="p-3 bg-yellow-50 text-yellow-700 rounded-md inline-flex items-center mb-4">
          <Info size={20} className="mr-2" />
          <span>No balance sheet data available</span>
        </div>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          onClick={onRefresh}
        >
          Refresh Data
        </button>
      </div>
    );
  }
  
  const showComparison = !!comparisonData;
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h4 className="font-medium text-gray-700">
          {periodLabel || 'Balance Sheet'}
        </h4>
      </div>
      
      <div className="p-4">
        {/* Assets Section */}
        <div className="mb-6">
          <h5 className="font-medium text-gray-800 mb-3">Assets</h5>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  {showComparison && (
                    <>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Previous</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Current Assets Section */}
                <tr className="bg-gray-50">
                  <td colSpan={showComparison ? 4 : 2} className="px-4 py-2 text-sm font-medium text-gray-700">Current Assets</td>
                </tr>
                
                {balanceSheet.assets.current && balanceSheet.assets.current.map((asset, index) => (
                  <tr key={`current-asset-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600 pl-8">{asset.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(asset.amount)}</td>
                    
                    {showComparison && comparisonData.assets && comparisonData.assets.current && (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">
                          {formatCurrency(comparisonData.assets.current[index]?.amount || 0)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {comparisonData.assets.current[index] && (
                            <PercentageChange 
                              current={asset.amount} 
                              previous={comparisonData.assets.current[index].amount} 
                            />
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-700">Total Current Assets</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-700 text-right">{formatCurrency(balanceSheet.assets.currentTotal || 0)}</td>
                  
                  {showComparison && comparisonData.assets && (
                    <>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">
                        {formatCurrency(comparisonData.assets.currentTotal || 0)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        <PercentageChange 
                          current={balanceSheet.assets.currentTotal || 0} 
                          previous={comparisonData.assets.currentTotal || 0} 
                        />
                      </td>
                    </>
                  )}
                </tr>
                
                {/* Fixed Assets Section */}
                <tr className="bg-gray-50">
                  <td colSpan={showComparison ? 4 : 2} className="px-4 py-2 text-sm font-medium text-gray-700">Fixed Assets</td>
                </tr>
                
                {balanceSheet.assets.fixed && balanceSheet.assets.fixed.map((asset, index) => (
                  <tr key={`fixed-asset-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600 pl-8">{asset.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(asset.amount)}</td>
                    
                    {showComparison && comparisonData.assets && comparisonData.assets.fixed && (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">
                          {formatCurrency(comparisonData.assets.fixed[index]?.amount || 0)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {comparisonData.assets.fixed[index] && (
                            <PercentageChange 
                              current={asset.amount} 
                              previous={comparisonData.assets.fixed[index].amount} 
                            />
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-700">Total Fixed Assets</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-700 text-right">{formatCurrency(balanceSheet.assets.fixedTotal || 0)}</td>
                  
                  {showComparison && comparisonData.assets && (
                    <>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">
                        {formatCurrency(comparisonData.assets.fixedTotal || 0)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        <PercentageChange 
                          current={balanceSheet.assets.fixedTotal || 0} 
                          previous={comparisonData.assets.fixedTotal || 0} 
                        />
                      </td>
                    </>
                  )}
                </tr>
                
                {/* Total Assets */}
                <tr className="bg-blue-50 font-medium text-blue-800">
                  <td className="px-4 py-3 text-sm">Total Assets</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(balanceSheet.assets.total || 0)}</td>
                  
                  {showComparison && comparisonData.assets && (
                    <>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(comparisonData.assets.total || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <PercentageChange 
                          current={balanceSheet.assets.total || 0} 
                          previous={comparisonData.assets.total || 0} 
                        />
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Liabilities and Equity Section */}
        <div>
          <h5 className="font-medium text-gray-800 mb-3">Liabilities & Equity</h5>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  {showComparison && (
                    <>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Previous</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Current Liabilities Section */}
                <tr className="bg-gray-50">
                  <td colSpan={showComparison ? 4 : 2} className="px-4 py-2 text-sm font-medium text-gray-700">Current Liabilities</td>
                </tr>
                
                {balanceSheet.liabilities.current && balanceSheet.liabilities.current.map((liability, index) => (
                  <tr key={`current-liability-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600 pl-8">{liability.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(liability.amount)}</td>
                    
                    {showComparison && comparisonData.liabilities && comparisonData.liabilities.current && (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">
                          {formatCurrency(comparisonData.liabilities.current[index]?.amount || 0)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {comparisonData.liabilities.current[index] && (
                            <PercentageChange 
                              current={liability.amount} 
                              previous={comparisonData.liabilities.current[index].amount}
                              inverseColors={true} // For liabilities, down is good
                            />
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-700">Total Current Liabilities</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-700 text-right">{formatCurrency(balanceSheet.liabilities.currentTotal || 0)}</td>
                  
                  {showComparison && comparisonData.liabilities && (
                    <>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">
                        {formatCurrency(comparisonData.liabilities.currentTotal || 0)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        <PercentageChange 
                          current={balanceSheet.liabilities.currentTotal || 0} 
                          previous={comparisonData.liabilities.currentTotal || 0}
                          inverseColors={true} // For liabilities, down is good
                        />
                      </td>
                    </>
                  )}
                </tr>
                
                {/* Long-term Liabilities Section */}
                <tr className="bg-gray-50">
                  <td colSpan={showComparison ? 4 : 2} className="px-4 py-2 text-sm font-medium text-gray-700">Long-term Liabilities</td>
                </tr>
                
                {balanceSheet.liabilities.longTerm && balanceSheet.liabilities.longTerm.map((liability, index) => (
                  <tr key={`longterm-liability-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600 pl-8">{liability.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(liability.amount)}</td>
                    
                    {showComparison && comparisonData.liabilities && comparisonData.liabilities.longTerm && (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">
                          {formatCurrency(comparisonData.liabilities.longTerm[index]?.amount || 0)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {comparisonData.liabilities.longTerm[index] && (
                            <PercentageChange 
                              current={liability.amount} 
                              previous={comparisonData.liabilities.longTerm[index].amount}
                              inverseColors={true} // For liabilities, down is good
                            />
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-700">Total Long-term Liabilities</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-700 text-right">{formatCurrency(balanceSheet.liabilities.longTermTotal || 0)}</td>
                  
                  {showComparison && comparisonData.liabilities && (
                    <>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">
                        {formatCurrency(comparisonData.liabilities.longTermTotal || 0)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        <PercentageChange 
                          current={balanceSheet.liabilities.longTermTotal || 0} 
                          previous={comparisonData.liabilities.longTermTotal || 0}
                          inverseColors={true} // For liabilities, down is good
                        />
                      </td>
                    </>
                  )}
                </tr>
                
                <tr className="font-medium">
                  <td className="px-4 py-2 text-sm text-gray-700">Total Liabilities</td>
                  <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(balanceSheet.liabilities.total || 0)}</td>
                  
                  {showComparison && comparisonData.liabilities && (
                    <>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">
                        {formatCurrency(comparisonData.liabilities.total || 0)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        <PercentageChange 
                          current={balanceSheet.liabilities.total || 0} 
                          previous={comparisonData.liabilities.total || 0}
                          inverseColors={true} // For liabilities, down is good
                        />
                      </td>
                    </>
                  )}
                </tr>
                
                {/* Equity Section */}
                <tr className="bg-gray-50">
                  <td colSpan={showComparison ? 4 : 2} className="px-4 py-2 text-sm font-medium text-gray-700">Equity</td>
                </tr>
                
                {balanceSheet.equity && balanceSheet.equity.items && balanceSheet.equity.items.map((item, index) => (
                  <tr key={`equity-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600 pl-8">{item.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(item.amount)}</td>
                    
                    {showComparison && comparisonData.equity && comparisonData.equity.items && (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">
                          {formatCurrency(comparisonData.equity.items[index]?.amount || 0)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {comparisonData.equity.items[index] && (
                            <PercentageChange 
                              current={item.amount} 
                              previous={comparisonData.equity.items[index].amount} 
                            />
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                
                <tr className="font-medium">
                  <td className="px-4 py-2 text-sm text-gray-700">Total Equity</td>
                  <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(balanceSheet.equity.total || 0)}</td>
                  
                  {showComparison && comparisonData.equity && (
                    <>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">
                        {formatCurrency(comparisonData.equity.total || 0)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        <PercentageChange 
                          current={balanceSheet.equity.total || 0} 
                          previous={comparisonData.equity.total || 0} 
                        />
                      </td>
                    </>
                  )}
                </tr>
                
                {/* Total Liabilities and Equity */}
                <tr className="bg-blue-50 font-medium text-blue-800">
                  <td className="px-4 py-3 text-sm">Total Liabilities & Equity</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatCurrency((balanceSheet.liabilities?.total || 0) + (balanceSheet.equity?.total || 0))}
                  </td>
                  
                  {showComparison && comparisonData.liabilities && comparisonData.equity && (
                    <>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency((comparisonData.liabilities?.total || 0) + (comparisonData.equity?.total || 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <PercentageChange 
                          current={(balanceSheet.liabilities?.total || 0) + (balanceSheet.equity?.total || 0)} 
                          previous={(comparisonData.liabilities?.total || 0) + (comparisonData.equity?.total || 0)} 
                        />
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-6 flex space-x-2 justify-end">
          <button 
            className="px-3 py-1.5 border border-gray-300 rounded-md bg-white text-sm flex items-center shadow-sm hover:bg-gray-50"
            onClick={() => window.location.href = `/api/financial/export/balance-sheet?timeframe=${timeframe}&format=pdf`}
          >
            <Download size={14} className="mr-1.5" />
            Export PDF
          </button>
          <button 
            className="px-3 py-1.5 border border-gray-300 rounded-md bg-white text-sm flex items-center shadow-sm hover:bg-gray-50"
            onClick={() => window.location.href = `/api/financial/export/balance-sheet?timeframe=${timeframe}&format=csv`}
          >
            <Save size={14} className="mr-1.5" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedBalanceSheet;