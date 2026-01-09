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
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <Package size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please generate the inventory report.</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Inventory Value</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {formatCurrency(data.summary.totalInventoryValue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.summary.totalInventoryCount} items in stock
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Products</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {data.summary.productCount}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Low Stock Items</h3>
              <p className="text-2xl font-semibold text-orange-500">
                {data.lowStockItems?.length || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Items below reorder point
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Average Item Value</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {formatCurrency(
                  data.summary.productCount > 0
                    ? data.summary.totalInventoryValue / data.summary.productCount
                    : 0
                )}
              </p>
            </div>
          </div>
          
          {data.lowStockItems && data.lowStockItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                <div className="flex items-center">
                  <AlertTriangle size={18} className="mr-2 text-orange-500" />
                  Low Stock Items
                </div>
              </h3>
              <div className="overflow-x-auto bg-orange-50 rounded-lg border border-orange-200">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-orange-100">
                      <th className="px-4 py-2 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-orange-800 uppercase tracking-wider">
                        Stock Level
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-orange-800 uppercase tracking-wider">
                        Reorder Point
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-orange-800 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-200">
                    {data.lowStockItems.map((item, index) => (
                      <tr key={index} className="hover:bg-orange-100">
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {item.sku || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {item.stockLevel}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {item.reorderPoint || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            item.stockStatus === 'Out of Stock'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
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
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                <div className="flex items-center">
                  <ShoppingBag size={18} className="mr-2" />
                  Inventory by Category
                </div>
              </h3>
              {data.inventoryByCategory && data.inventoryByCategory.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Items
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Value
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          % of Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.inventoryByCategory
                        .sort((a, b) => b.totalValue - a.totalValue)
                        .map((category, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {category.category}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {category.itemCount}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(category.totalValue)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {data.summary.totalInventoryValue > 0
                                ? ((category.totalValue / data.summary.totalInventoryValue) * 100).toFixed(1)
                                : 0}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No category data available.</p>
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                <div className="flex items-center">
                  <Activity size={18} className="mr-2" />
                  Recent Inventory Transactions
                </div>
              </h3>
              {data.recentTransactions && data.recentTransactions.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.recentTransactions.map((transaction, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {(() => {
                              const date = new Date(transaction.createdAt);
                              const day = String(date.getDate()).padStart(2, '0');
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const year = date.getFullYear();
                              return `${day}-${month}-${year}`;
                            })()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {transaction.product.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              transaction.type === 'Addition' || transaction.type === 'Purchase'
                                ? 'bg-green-100 text-green-800'
                                : transaction.type === 'Removal' || transaction.type === 'Sale'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {transaction.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No recent transactions available.</p>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-4">Top Inventory Items by Value</h3>
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Level
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost per Unit
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.inventoryItems
                    .filter(item => item.stockLevel > 0)
                    .slice(0, 10) // Top 10 items
                    .map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {item.category || 'Uncategorized'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {item.sku || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {item.stockLevel}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {formatCurrency(item.cost)}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(item.stockValue)}
                        </td>
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