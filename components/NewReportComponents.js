// components/NewReportComponents.js
import React, { useState } from 'react';
import { Package, TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { FinancialReport } from './FinancialReportComponents';

/**
 * Stock Movement Report Component
 */
export const StockMovementReport = ({ 
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
        <Package size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  if (!data) return null;

  const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';

  return (
    <FinancialReport
      title="Stock Movement Report"
      subtitle={periodLabel}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >
      {data.productMovements && data.productMovements.length > 0 ? (
        <div className="space-y-6">
          {data.productMovements.map((productMovement, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {productMovement.product.name} ({productMovement.product.sku})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaction Type</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty In</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty Out</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {new Date(data.period.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">Opening Balance</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">-</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">-</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{productMovement.openingBalance}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">-</td>
                    </tr>
                    {productMovement.movements.map((movement, mIdx) => (
                      <tr key={mIdx}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {new Date(movement.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">{movement.transactionType}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {movement.qtyIn !== null ? movement.qtyIn : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {movement.qtyOut !== null ? movement.qtyOut : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{movement.balance}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{movement.reference}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={2} className="px-4 py-2 text-sm text-gray-900">TOTALS</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{productMovement.totals.qtyIn}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{productMovement.totals.qtyOut}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{productMovement.closingBalance}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        NET: {productMovement.totals.netMovement >= 0 ? '+' : ''}{productMovement.totals.netMovement}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 text-gray-500">
          No stock movements found for the selected period.
        </div>
      )}
    </FinancialReport>
  );
};

/**
 * Sales Analysis Report Component
 */
export const SalesAnalysisReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  // Use groupBy from data if available
  const groupBy = data?.groupBy || 'time';

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <TrendingUp size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  if (!data) return null;

  const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';

  return (
    <FinancialReport
      title="Sales Analysis Report"
      subtitle={periodLabel}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >

      {data.groupBy === 'time' && data.data && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"># of Invoices</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Sales Amount</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Invoice</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">% Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.month}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.invoiceCount}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.salesAmount)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.avgInvoice)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">
                    {item.percentChange !== null ? `${item.percentChange >= 0 ? '+' : ''}${item.percentChange.toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-gray-900">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{data.totals.totalInvoices}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.totalSales)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.avgInvoice)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(data.groupBy === 'product' || data.groupBy === 'category') && data.data && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{data.groupBy === 'product' ? 'Product' : 'Category'}</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"># of Sales</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity Sold</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.salesCount}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.quantitySold}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.percentOfTotal.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-gray-900">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{data.totals.totalSales}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{data.totals.totalQuantity}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.totalRevenue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">100%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data.groupBy === 'customer' && data.data && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer Name</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"># of Orders</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Order</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.rank}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.customerName}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.orderCount}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.totalSales)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.avgOrder)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.percentOfTotal.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-4 py-2 text-sm text-gray-900">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{data.totals.totalOrders}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.totalSales)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">-</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">100%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </FinancialReport>
  );
};

/**
 * Expense Analysis Report Component
 */
export const ExpenseAnalysisReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  const groupBy = data?.groupBy || 'category';

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <TrendingDown size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  if (!data) return null;

  const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';

  return (
    <FinancialReport
      title="Expense Analysis Report"
      subtitle={periodLabel}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >

      {data.groupBy === 'category' && data.data && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">This Period</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Last Period</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">% Change</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.category}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.thisPeriod)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.lastPeriod)}</td>
                  <td className={`px-4 py-2 text-sm text-right ${item.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.change >= 0 ? '+' : ''}{formatCurrency(item.change)}
                  </td>
                  <td className={`px-4 py-2 text-sm text-right ${item.percentChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.percentChange >= 0 ? '+' : ''}{item.percentChange.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.percentOfTotal.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-gray-900">TOTAL EXPENSES</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.thisPeriod)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.lastPeriod)}</td>
                  <td className={`px-4 py-2 text-sm text-right ${data.totals.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {data.totals.change >= 0 ? '+' : ''}{formatCurrency(data.totals.change)}
                  </td>
                  <td className={`px-4 py-2 text-sm text-right ${data.totals.percentChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {data.totals.percentChange >= 0 ? '+' : ''}{data.totals.percentChange.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">100%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data.groupBy === 'month' && data.data && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                {data.categories && data.categories.map((cat, idx) => (
                  <th key={idx} className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{cat}</th>
                ))}
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.month}</td>
                  {data.categories && data.categories.map((cat, cIdx) => (
                    <td key={cIdx} className="px-4 py-2 text-sm text-gray-900 text-right">
                      {formatCurrency(item.categories[cat] || 0)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-sm text-gray-900 text-right font-semibold">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FinancialReport>
  );
};

/**
 * Profitability Analysis Report Component
 */
export const ProfitabilityAnalysisReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  const groupBy = data?.groupBy || 'product';

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <PieChart size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  if (!data) return null;

  const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';

  return (
    <FinancialReport
      title="Profitability Analysis"
      subtitle={periodLabel}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >

      {data.groupBy === 'product' && data.data && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">COGS</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gross Profit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.productName}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.unitsSold}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.margin.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-gray-900">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{data.totals.unitsSold}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{data.totals.margin.toFixed(1)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data.groupBy === 'customer' && data.data && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">COGS</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gross Profit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.customerName}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.margin.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-gray-900">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{data.totals.margin.toFixed(1)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data.groupBy === 'time' && data.data && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">COGS</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gross Profit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.month}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.margin.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-gray-900">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.totals.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{data.totals.margin.toFixed(1)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </FinancialReport>
  );
};

