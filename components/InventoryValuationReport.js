// components/InventoryValuationReport.jsx
import React from 'react';
import { FinancialReport } from './FinancialReportComponents';
import { formatCurrency } from '@/lib/currencyUtils';
import { Package, AlertTriangle, ShoppingBag, Activity } from 'lucide-react';

/**
 * Component for Inventory Valuation Report
 */
export const InventoryValuationReport = ({ 
  data, 
  loading, 
  error,
  onRefresh,
  onExport
}) => {
  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 bg-gradient-to-br from-slate-50 to-emerald-50/50 rounded-2xl border border-slate-200">
        <Package size={48} className="mx-auto text-emerald-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-700">No data available</h3>
        <p className="text-slate-500 mt-2">Please generate the inventory report.</p>
      </div>
    );
  }
  
  return (
    <FinancialReport
      title="Inventory Valuation"
      subtitle={data?.generatedAt ? (() => {
        const date = new Date(data.generatedAt);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `As of ${day}-${month}-${year}`;
      })() : "Inventory Value Report"}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-sm border-l-4 border-l-emerald-500">
              <h3 className="text-sm font-medium text-emerald-700 mb-1">Total inventory value</h3>
              <p className="text-2xl font-semibold text-slate-800">{formatCurrency(data.summary.totalInventoryValue)}</p>
              <p className="text-xs text-slate-500 mt-1">{data.summary.totalInventoryCount} items in stock</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-sm border-l-4 border-l-blue-500">
              <h3 className="text-sm font-medium text-blue-700 mb-1">Total products</h3>
              <p className="text-2xl font-semibold text-slate-800">{data.summary.productCount}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-white p-4 sm:p-5 rounded-2xl border border-orange-200/80 shadow-sm border-l-4 border-l-orange-500">
              <h3 className="text-sm font-medium text-orange-700 mb-1">Low stock items</h3>
              <p className="text-2xl font-semibold text-orange-600">{data.lowStockItems?.length || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Items below reorder point</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5 rounded-2xl border border-violet-200/80 shadow-sm border-l-4 border-l-violet-500">
              <h3 className="text-sm font-medium text-violet-700 mb-1">Average item value</h3>
              <p className="text-2xl font-semibold text-slate-800">
                {formatCurrency(data.summary.productCount > 0 ? data.summary.totalInventoryValue / data.summary.productCount : 0)}
              </p>
            </div>
          </div>
          
          {data.lowStockItems?.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <AlertTriangle size={18} className="mr-2 text-orange-500" />
                Low stock items
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-orange-200 bg-orange-50/50 shadow-sm">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-orange-100/80">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider">Item</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-orange-800 uppercase tracking-wider">Stock level</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-orange-800 uppercase tracking-wider">Reorder point</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-orange-800 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-200">
                    {data.lowStockItems.map((item, index) => (
                      <tr key={index} className="hover:bg-orange-50/70">
                        <td className="px-4 py-2.5 text-sm text-slate-800">{item.name}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{item.sku || 'N/A'}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{item.stockLevel}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{item.reorderPoint ?? 'N/A'}</td>
                        <td className="px-4 py-2.5 text-sm text-right">
                          <span className={`px-2 py-1 text-xs rounded-full ${item.stockStatus === 'Out of Stock' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                            {item.stockStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center border-l-4 border-emerald-500 pl-3">
                <ShoppingBag size={18} className="mr-2 text-emerald-600" />
                Inventory by category
              </h3>
              {data.inventoryByCategory?.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Items</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Value</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">% of total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[...data.inventoryByCategory].sort((a, b) => b.totalValue - a.totalValue).map((category, index) => (
                        <tr key={index} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 text-sm text-slate-800">{category.category}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{category.itemCount}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(category.totalValue)}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-800 text-right">
                            {data.summary.totalInventoryValue > 0 ? ((category.totalValue / data.summary.totalInventoryValue) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-slate-500">No category data available.</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center border-l-4 border-blue-500 pl-3">
                <Activity size={18} className="mr-2 text-blue-600" />
                Recent inventory transactions
              </h3>
              {data.recentTransactions?.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Product</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.recentTransactions.map((transaction, index) => (
                        <tr key={index} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 text-sm text-slate-800">
                            {(() => {
                              const d = new Date(transaction.createdAt);
                              return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                            })()}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-slate-800">{transaction.product?.name ?? 'N/A'}</td>
                          <td className="px-4 py-2.5 text-sm text-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              transaction.type === 'Addition' || transaction.type === 'Purchase' ? 'bg-emerald-100 text-emerald-800' :
                              transaction.type === 'Removal' || transaction.type === 'Sale' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {transaction.type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{transaction.quantity > 0 ? '+' : ''}{transaction.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-slate-500">No recent transactions available.</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-l-4 border-violet-500 pl-3">Top inventory items by value</h3>
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock level</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Cost per unit</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(data.inventoryItems || []).filter(item => item.stockLevel > 0).slice(0, 10).map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 text-sm text-slate-800">{item.name}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{item.category || 'Uncategorized'}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{item.sku || 'N/A'}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{item.stockLevel}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(item.cost)}</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800 text-right">{formatCurrency(item.stockValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </FinancialReport>
  );
};