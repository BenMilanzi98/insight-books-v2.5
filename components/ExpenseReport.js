// components/ExpenseReport.jsx
import React, { useState } from 'react';
import { FinancialReport, PercentageChange } from './FinancialReportComponents';
import { formatCurrency } from '@/lib/currencyUtils';
import { BarChart, PieChart, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Component for Expense Report
 */
export const ExpenseReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedCategory, setExpandedCategory] = useState(null);
  
  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 bg-gradient-to-br from-slate-50 to-amber-50/50 rounded-2xl border border-slate-200">
        <BarChart size={48} className="mx-auto text-amber-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-700">No data available</h3>
        <p className="text-slate-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  // Toggle expanded category
  const toggleCategory = (category) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
    }
  };
  
  // Filter expenses by category
  const filteredExpensesByCategory = data?.expensesByCategory
    ? (categoryFilter === 'all'
        ? data.expensesByCategory
        : data.expensesByCategory.filter(cat => cat.category === categoryFilter))
    : [];
  
  return (
    <FinancialReport
      title="Expense Report"
      subtitle={data?.period ? `${data.period.startDate} to ${data.period.endDate}` : "Expense Analysis"}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <div className="bg-gradient-to-br from-amber-50 to-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-sm border-l-4 border-l-amber-500">
              <h3 className="text-sm font-medium text-amber-700 mb-1">Total expenses</h3>
              <p className="text-2xl font-semibold text-slate-800">{formatCurrency(data.summary.totalExpenses)}</p>
              <p className="text-xs text-slate-500 mt-1">{data.summary.expenseCount} expense transactions</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-sm border-l-4 border-l-blue-500">
              <h3 className="text-sm font-medium text-blue-700 mb-1">Average monthly expense</h3>
              <p className="text-2xl font-semibold text-slate-800">
                {formatCurrency(data.expensesByMonth?.length ? data.summary.totalExpenses / data.expensesByMonth.length : 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">{data.expensesByMonth?.length || 0} months in selected period</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5 rounded-2xl border border-violet-200/80 shadow-sm border-l-4 border-l-violet-500">
              <h3 className="text-sm font-medium text-violet-700 mb-1">Top expense category</h3>
              {data.expensesByCategory?.length > 0 ? (
                (() => {
                  const top = [...data.expensesByCategory].sort((a, b) => b.total - a.total)[0];
                  return (
                    <>
                      <p className="text-2xl font-semibold text-slate-800">{top.category}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatCurrency(top.total)} ({Math.round((top.total / data.summary.totalExpenses) * 100)}% of total)
                      </p>
                    </>
                  );
                })()
              ) : (
                <p className="text-2xl font-semibold text-slate-800">None</p>
              )}
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
              <h3 className="text-lg font-semibold text-slate-800 border-l-4 border-amber-500 pl-3">Expenses by category</h3>
              {data.summary.availableCategories?.length > 0 && (
                <div className="relative">
                  <select
                    className="appearance-none px-3 py-2 border border-slate-200 rounded-xl bg-white pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">All categories</option>
                    {data.summary.availableCategories.map(category => (
                      <option key={category.name} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-2.5 pointer-events-none">
                    <ChevronDown size={15} className="text-slate-500" />
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {filteredExpensesByCategory.map(category => (
                <div key={category.category} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div
                    className="flex justify-between items-center p-4 sm:p-5 cursor-pointer hover:bg-slate-50/70"
                    onClick={() => toggleCategory(category.category)}
                  >
                    <div>
                      <h4 className="font-medium text-slate-800">{category.category}</h4>
                      <p className="text-sm text-slate-500">{category.items.length} expense{category.items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center">
                      <span className="text-lg font-medium text-slate-800 mr-4">{formatCurrency(category.total)}</span>
                      {expandedCategory === category.category ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                    </div>
                  </div>
                  {expandedCategory === category.category && (
                    <div className="border-t border-slate-200 p-4 sm:p-5">
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Merchant</th>
                              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {category.items.map(expense => (
                              <tr key={expense.id} className="hover:bg-slate-50/70">
                                <td className="px-4 py-2.5 text-sm text-slate-800">{new Date(expense.date).toLocaleDateString()}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-800">{expense.description}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-800">{expense.merchant || 'N/A'}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(expense.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredExpensesByCategory.length === 0 && (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-slate-500">No expenses found for the selected criteria.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Monthly expense trend</h3>
              {data.expensesByMonth?.length > 0 ? (
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Month</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total expenses</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {data.expensesByMonth.map((month, index) => (
                          <tr key={index} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 text-sm text-slate-800">{month.month}</td>
                            <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(month.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-slate-500">No monthly data available.</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Expense distribution</h3>
              {data.expensesByCategory?.length > 0 ? (
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">% of total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {[...data.expensesByCategory].sort((a, b) => b.total - a.total).map(category => (
                          <tr key={category.category} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 text-sm text-slate-800">{category.category}</td>
                            <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(category.total)}</td>
                            <td className="px-4 py-2.5 text-sm text-slate-800 text-right">
                              {data.summary.totalExpenses > 0 ? ((category.total / data.summary.totalExpenses) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-slate-500">No category data available.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </FinancialReport>
  );
};



