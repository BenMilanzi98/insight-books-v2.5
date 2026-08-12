// components/SalesReport.jsx
import React, { useState } from 'react';
import { FinancialReport, PercentageChange } from './FinancialReportComponents';
import { extractReportReconciliationMeta } from '@/components/ReportReconciliationBadge';
import { formatCurrency } from '@/lib/currencyUtils';
import { formatPeriodRange } from '@/lib/dateUtils';
import { TrendingUp, BarChart, Users, Package } from 'lucide-react';
import ReportAccountTable from '@/components/reports/ReportAccountTable';

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
      <div className="text-center p-8 bg-gradient-to-br from-slate-50 to-emerald-50/50 rounded-2xl border border-slate-200">
        <TrendingUp size={48} className="mx-auto text-emerald-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-700">No data available</h3>
        <p className="text-slate-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  return (
    <FinancialReport
      title="Sales Report"
      subtitle={data?.period ? formatPeriodRange(data.period.startDate, data.period.endDate) : "Sales Analysis"}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-sm border-l-4 border-l-emerald-500">
              <h3 className="text-sm font-medium text-emerald-700 mb-1">Total revenue</h3>
              <p className="min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-slate-800 sm:text-2xl">{formatCurrency(data.summary.totalRevenue)}</p>
              <p className="text-xs text-slate-500 mt-1">{data.summary.totalSalesCount} sales + {data.summary.totalInvoiceCount} invoices</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-sm border-l-4 border-l-blue-500">
              <h3 className="text-sm font-medium text-blue-700 mb-1">Average sale value</h3>
              <p className="min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-slate-800 sm:text-2xl">{formatCurrency(data.summary.averageSaleValue)}</p>
            </div>
            <div className="bg-gradient-to-br from-sky-50 to-white p-4 sm:p-5 rounded-2xl border border-sky-200/80 shadow-sm border-l-4 border-l-sky-500">
              <h3 className="text-sm font-medium text-sky-700 mb-1">Total tax collected</h3>
              <p className="min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-slate-800 sm:text-2xl">{formatCurrency(data.summary.totalTax)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {data.summary.totalTax > 0 ? ((data.summary.totalTax / data.summary.totalRevenue) * 100).toFixed(1) : 0}% of revenue
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-sm border-l-4 border-l-amber-500">
              <h3 className="text-sm font-medium text-amber-700 mb-1">Active customers</h3>
              <p className="text-2xl font-semibold text-slate-800">{data.salesByCustomer?.length || 0}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-l-4 border-emerald-500 pl-3">Sales trend</h3>
            <div className="flex flex-wrap justify-end mb-4">
              <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium ${
                    groupBy === 'day' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                  } border-r border-slate-200`}
                  onClick={() => setGroupBy('day')}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium ${
                    groupBy === 'week' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                  } border-r border-slate-200`}
                  onClick={() => setGroupBy('week')}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium ${
                    groupBy === 'month' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => setGroupBy('month')}
                >
                  Monthly
                </button>
              </div>
            </div>
            
            {data.salesByDate?.length > 0 ? (
              <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Sales</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Invoices</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Revenue</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.salesByDate.map((day, index) => (
                      <tr key={index} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-sm text-slate-800">{day.date}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{day.sales}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{day.invoices}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(day.totalRevenue)}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(day.totalTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-slate-500">No sales data available for the selected period.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <Package size={18} className="mr-2 text-slate-600" />
                Top products
              </h3>
              {data.salesByProduct?.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Product</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantity sold</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.salesByProduct.slice(0, 10).map((product, index) => (
                        <tr key={index} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 text-sm text-slate-800">{product.productName}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{product.quantity}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(product.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-slate-500">No product data available.</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <Users size={18} className="mr-2 text-slate-600" />
                Top customers
              </h3>
              {data.salesByCustomer?.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Sales</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Invoices</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.salesByCustomer.slice(0, 10).map((customer, index) => (
                        <tr key={index} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 text-sm text-slate-800">{customer.clientName}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{customer.salesCount}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{customer.invoiceCount}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(customer.totalSpent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-slate-500">No customer data available.</p>
                </div>
              )}
            </div>
          </div>

          {data.accountLines?.length > 0 && (
            <ReportAccountTable
              lines={data.accountLines}
              title="Income Accounts — General Ledger Detail"
              showOpeningClosing
            />
          )}
        </>
      )}
    </FinancialReport>
  );
};
