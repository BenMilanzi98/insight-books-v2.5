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
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <BarChart size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expenses</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {formatCurrency(data.summary.totalExpenses)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.summary.expenseCount} expense transactions
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Average Monthly Expense</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {formatCurrency(
                  data.expensesByMonth && data.expensesByMonth.length > 0
                    ? data.summary.totalExpenses / data.expensesByMonth.length
                    : 0
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.expensesByMonth?.length || 0} months in selected period
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Top Expense Category</h3>
              {data.expensesByCategory && data.expensesByCategory.length > 0 && (
                <>
                  <p className="text-2xl font-semibold text-gray-800">
                    {data.expensesByCategory.sort((a, b) => b.total - a.total)[0].category}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatCurrency(data.expensesByCategory.sort((a, b) => b.total - a.total)[0].total)}
                    {' '}
                    ({Math.round((data.expensesByCategory.sort((a, b) => b.total - a.total)[0].total / data.summary.totalExpenses) * 100)}% of total)
                  </p>
                </>
              )}
              {(!data.expensesByCategory || data.expensesByCategory.length === 0) && (
                <p className="text-2xl font-semibold text-gray-800">
                  None
                </p>
              )}
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-800">Expenses by Category</h3>
              {data.summary.availableCategories && data.summary.availableCategories.length > 0 && (
                <div className="relative">
                  <select 
                    className="appearance-none px-3 py-2 border border-gray-300 rounded-md bg-white pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {data.summary.availableCategories.map(category => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-2.5 pointer-events-none">
                    <ChevronDown size={15} className="text-gray-500" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Expense Categories */}
            <div className="grid grid-cols-1 gap-4">
              {filteredExpensesByCategory.map(category => (
                <div key={category.category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div 
                    className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleCategory(category.category)}
                  >
                    <div>
                      <h4 className="font-medium text-gray-800">{category.category}</h4>
                      <p className="text-sm text-gray-500">
                        {category.items.length} expense{category.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className="text-lg font-medium text-gray-800 mr-4">
                        {formatCurrency(category.total)}
                      </span>
                      {expandedCategory === category.category ? (
                        <ChevronUp size={18} className="text-gray-500" />
                      ) : (
                        <ChevronDown size={18} className="text-gray-500" />
                      )}
                    </div>
                  </div>
                  
                  {expandedCategory === category.category && (
                    <div className="border-t border-gray-200 p-4">
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Description
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Merchant
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {category.items.map(expense => (
                              <tr key={expense.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {new Date(expense.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {expense.description}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {expense.merchant || 'N/A'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                  {formatCurrency(expense.amount)}
                                </td>
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
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No expenses found for the selected criteria.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Monthly Expense Trend</h3>
              {data.expensesByMonth && data.expensesByMonth.length > 0 ? (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Month
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Expenses
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.expensesByMonth.map((month, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {month.month}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(month.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No monthly data available.</p>
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Expense Distribution</h3>
              {data.expensesByCategory && data.expensesByCategory.length > 0 ? (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            % of Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.expensesByCategory
                          .sort((a, b) => b.total - a.total)
                          .map(category => (
                            <tr key={category.category} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {category.category}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                {formatCurrency(category.total)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                {data.summary.totalExpenses > 0
                                  ? ((category.total / data.summary.totalExpenses) * 100).toFixed(1)
                                  : 0}%
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No category data available.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </FinancialReport>
  );
};



