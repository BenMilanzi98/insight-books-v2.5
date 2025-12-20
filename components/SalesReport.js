// components/SalesReport.jsx
import React, { useState } from 'react';
import { FinancialReport, PercentageChange } from './FinancialReportComponents';
import { formatCurrency } from '@/lib/currencyUtils';
import { TrendingUp, BarChart, Users, Package } from 'lucide-react';

/**
 * Component for Sales Report
 */
export const SalesReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  const [groupBy, setGroupBy] = useState(data?.groupBy || 'day');
  
  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <TrendingUp size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  return (
    <FinancialReport
      title="Sales Report"
      subtitle={data?.period ? `${data.period.startDate} to ${data.period.endDate}` : "Sales Analysis"}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Revenue</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {formatCurrency(data.summary.totalRevenue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.summary.totalSalesCount} sales + {data.summary.totalInvoiceCount} invoices
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Average Sale Value</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {formatCurrency(data.summary.averageSaleValue)}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Tax Collected</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {formatCurrency(data.summary.totalTax)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.summary.totalTax > 0 ? ((data.summary.totalTax / data.summary.totalRevenue) * 100).toFixed(1) : 0}% of revenue
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Active Customers</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {data.salesByCustomer?.length || 0}
              </p>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Sales Trend</h3>
            <div className="flex justify-end mb-4">
              <div className="inline-flex rounded-md shadow-sm">
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium ${
                    groupBy === 'day'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } rounded-l-lg border border-gray-200`}
                  onClick={() => setGroupBy('day')}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium ${
                    groupBy === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } border-t border-b border-gray-200`}
                  onClick={() => setGroupBy('week')}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium ${
                    groupBy === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } rounded-r-lg border border-gray-200`}
                  onClick={() => setGroupBy('month')}
                >
                  Monthly
                </button>
              </div>
            </div>
            
            {data.salesByDate && data.salesByDate.length > 0 ? (
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoices
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tax
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.salesByDate.map((day, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {day.date}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {day.sales}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {day.invoices}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {formatCurrency(day.totalRevenue)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {formatCurrency(day.totalTax)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No sales data available for the selected period.</p>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                <div className="flex items-center">
                  <Package size={18} className="mr-2" />
                  Top Products
                </div>
              </h3>
              {data.salesByProduct && data.salesByProduct.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity Sold
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.salesByProduct
                        .slice(0, 10) // Show top 10 products
                        .map((product, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {product.productName}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {product.quantity}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(product.revenue)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No product data available.</p>
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                <div className="flex items-center">
                  <Users size={18} className="mr-2" />
                  Top Customers
                </div>
              </h3>
              {data.salesByCustomer && data.salesByCustomer.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sales
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Invoices
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Spent
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.salesByCustomer
                        .slice(0, 10) // Show top 10 customers
                        .map((customer, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {customer.clientName}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {customer.salesCount}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {customer.invoiceCount}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(customer.totalSpent)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No customer data available.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </FinancialReport>
  );
};
