// components/NewReportComponents.js
import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { FinancialReport } from './FinancialReportComponents';

/** Group movements by day or week; returns array of { date, transactionType, qtyIn, qtyOut, balance, reference }. Balance = closing balance for that period. */
function groupMovements(movements, groupBy) {
  if (!movements?.length || groupBy === 'none') return movements || [];
  const groups = new Map();
  for (const m of movements) {
    const d = new Date(m.date);
    const key = groupBy === 'week'
      ? (() => { const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1); return mon.toISOString().slice(0, 10); })()
      : d.toISOString().slice(0, 10);
    if (!groups.has(key)) {
      groups.set(key, { date: key, qtyIn: 0, qtyOut: 0, balance: 0, transactionType: groupBy === 'week' ? 'Weekly total' : 'Daily total', reference: '' });
    }
    const g = groups.get(key);
    g.qtyIn += Number(m.qtyIn) || 0;
    g.qtyOut += Number(m.qtyOut) || 0;
    g.balance = Number(m.balance) ?? 0; // closing balance (last movement in group)
  }
  return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Stock Movement Report Component
 * Read-only. Shows Date, Transaction Type, Qty In, Qty Out, Balance, Reference. Opening row once per product; never "-" for qty (use 0).
 */
export const StockMovementReport = ({ 
  data, 
  loading,
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport,
  productId = null,
  onProductFilterChange = null
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [groupBy, setGroupBy] = useState('none'); // 'none' | 'day' | 'week'
  const [productList, setProductList] = useState([]); // Full list for dropdown (not tied to report data)
  const itemsPerPage = 5;
  
  const productMovements = data?.productMovements || [];
  const totalPages = Math.ceil(productMovements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageProducts = productMovements.slice(startIndex, endIndex);
  
  // Product filter dropdown: use full product list so selection always shows all products (report data is filtered by selected product)
  const productOptions = [{ id: null, name: 'All products' }, ...productList.map(p => ({ id: p.id, name: p.name || (p.sku ? `Product ${p.sku}` : 'Product') }))];
  const uniqueProducts = productOptions.filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);

  // Load full product list for dropdown when filter is available (so dropdown isn't limited to current report data)
  useEffect(() => {
    if (!onProductFilterChange) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stock?limit=0&page=1');
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const list = Array.isArray(json.products) ? json.products : [];
        if (!cancelled) setProductList(list);
      } catch (_) {
        if (!cancelled) setProductList([]);
      }
    })();
    return () => { cancelled = true; };
  }, [onProductFilterChange]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [data?.productMovements?.length]);

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 sm:p-10 bg-gradient-to-br from-slate-50 to-emerald-50/40 rounded-2xl border border-slate-200">
        <Package size={48} className="mx-auto text-emerald-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800">No data available</h3>
        <p className="text-slate-500 mt-2 text-sm">Select a time period and generate the report.</p>
      </div>
    );
  }

  if (!data) return null;

  const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';
  const companyName = data.companyName || 'Company';
  
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top of report
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

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
      {productMovements.length > 0 ? (
        <div className="space-y-6">
          {/* Product filter & time grouping */}
          <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-slate-200">
            {onProductFilterChange && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Filter by product</label>
                <select
                  value={productId || ''}
                  onChange={(e) => onProductFilterChange(e.target.value || null)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[180px] shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {uniqueProducts.map((p) => (
                    <option key={p.id || 'all'} value={p.id || ''}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Group by</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="none">No grouping</option>
                <option value="day">Per day</option>
                <option value="week">Per week</option>
              </select>
            </div>
          </div>
          {/* Company Header with Logo */}
          {data.logoUrl && (
            <div className="text-center mb-6">
              <img
                src={
                  typeof data.logoUrl === 'string' && data.logoUrl.startsWith('/uploads/')
                    ? `/api/uploads/${data.logoUrl.replace(/^\/+uploads\//, '')}`
                    : typeof data.logoUrl === 'string' && (data.logoUrl.startsWith('http://') || data.logoUrl.startsWith('https://'))
                    ? data.logoUrl
                    : typeof data.logoUrl === 'string'
                    ? data.logoUrl
                    : data.logoUrl
                }
                alt={`${companyName} Logo`}
                className="h-16 w-auto object-contain mx-auto"
              />
            </div>
          )}
          
          {/* Pagination Info */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
              <div className="text-sm text-slate-600">
                Showing {startIndex + 1} to {Math.min(endIndex, productMovements.length)} of {productMovements.length} products
              </div>
            </div>
          )}

          {currentPageProducts.map((productMovement, idx) => (
            <div key={productMovement.product?.id || idx} className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white shadow-sm overflow-hidden">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                {productMovement.product?.name ?? 'Product'} {productMovement.product?.sku ? `(${productMovement.product.sku})` : ''}
              </h3>
              <div className="overflow-x-auto -mx-1 rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Date</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Transaction type</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Qty in</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Qty out</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Balance</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    <tr className="bg-emerald-50/70">
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800">
                        {data.period?.startDate ? new Date(data.period.startDate).toLocaleDateString() : ''}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800">Opening balance</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800 text-right">0</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800 text-right">0</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800 text-right">{Number(productMovement.openingBalance) ?? 0}</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800">—</td>
                    </tr>
                    {(groupBy === 'none' ? productMovement.movements : groupMovements(productMovement.movements || [], groupBy)).map((movement, mIdx) => (
                      <tr key={mIdx} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-sm text-slate-800">
                          {movement.date ? new Date(movement.date).toLocaleDateString() : ''}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-800">{movement.transactionType || ''}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{Number(movement.qtyIn) || 0}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{Number(movement.qtyOut) || 0}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-800 text-right">{Number(movement.balance) ?? 0}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{movement.reference || '—'}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                      <td colSpan={2} className="px-4 py-2.5 text-sm text-slate-800">Totals</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{productMovement.totals?.qtyIn ?? 0}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{productMovement.totals?.qtyOut ?? 0}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{productMovement.closingBalance ?? 0}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">
                        Net: {productMovement.totals?.netDisplay ?? Math.abs((productMovement.totals?.qtyIn ?? 0) - (productMovement.totals?.qtyOut ?? 0))} ({productMovement.totals?.netDirection === 'out' ? 'out' : 'in'})
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => {
                  if (page === '...') {
                    return <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">…</span>;
                  }
                  return (
                    <button
                      type="button"
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm border rounded-xl transition-colors ${
                        currentPage === page
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Last
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center p-8 sm:p-10 text-slate-500 text-sm rounded-2xl bg-slate-50 border border-slate-200">
          No stock movements found for the selected period.
        </div>
      )}
    </FinancialReport>
  );
};

/**
 * Daily POS Micro Report – one calendar day, read-only.
 * Shows: Total Sales, Transaction Count, Items Sold, Average Sale, Payment Breakdown, optional COGS, Cashier breakdown.
 */
export const PosDailyReport = ({
  data,
  loading,
  error,
  date,
  onDateChange,
  onRefresh,
  onExport
}) => {
  const displayDate = date || data?.date || new Date().toISOString().split('T')[0];
  const totalSales = Number(data?.totalSales) || 0;
  const transactionCount = Number(data?.transactionCount) || 0;
  const itemsSold = Number(data?.itemsSold) || 0;
  const averageSaleValue = Number(data?.averageSaleValue) || 0;
  const paymentBreakdown = data?.paymentBreakdown || [];
  const paymentGrandTotal = Number(data?.paymentGrandTotal) || 0;
  const cashierBreakdown = data?.cashierBreakdown || [];
  const totalCogs = Number(data?.totalCogs) || 0;
  const grossProfit = Number(data?.grossProfit) ?? (totalSales - totalCogs);
  const voidedCount = Number(data?.voidedCount) || 0;
  const refundCount = Number(data?.refundCount) || 0;
  const productsAffected = Number(data?.productsAffected) || 0;

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 sm:p-10 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-slate-200">
        <TrendingUp size={48} className="mx-auto text-blue-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800">No data available</h3>
        <p className="text-slate-500 mt-2 text-sm">Select a date and generate the report.</p>
      </div>
    );
  }

  return (
    <FinancialReport
      title="Daily POS Report"
      subtitle={displayDate}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >
      {data && (
        <div className="space-y-6">
          {/* Date selector */}
          {onDateChange && (
            <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-slate-200">
              <label className="text-sm font-medium text-slate-700">Report date</label>
              <input
                type="date"
                value={displayDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          )}
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-emerald-200/80 p-4 sm:p-5 bg-gradient-to-br from-emerald-50 to-white shadow-sm border-l-4 border-l-emerald-500">
              <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Total sales</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(totalSales)}</p>
            </div>
            <div className="rounded-2xl border border-blue-200/80 p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-white shadow-sm border-l-4 border-l-blue-500">
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Transactions</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{transactionCount}</p>
            </div>
            <div className="rounded-2xl border border-violet-200/80 p-4 sm:p-5 bg-gradient-to-br from-violet-50 to-white shadow-sm border-l-4 border-l-violet-500">
              <p className="text-xs font-medium text-violet-700 uppercase tracking-wide">Items sold</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{itemsSold}</p>
            </div>
            <div className="rounded-2xl border border-amber-200/80 p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-white shadow-sm border-l-4 border-l-amber-500">
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Avg sale</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(averageSaleValue)}</p>
            </div>
          </div>
          {/* Payment breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Payment breakdown</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Method</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {paymentBreakdown.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 text-sm text-slate-800">{row.label || row.method || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium text-slate-800">{formatCurrency(row.total || 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                    <td className="px-4 py-2.5 text-sm text-slate-800">Grand total</td>
                    <td className="px-4 py-2.5 text-sm text-right text-slate-800">{formatCurrency(paymentGrandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {/* COGS (optional) */}
          {(totalCogs > 0 || grossProfit !== totalSales) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-amber-200/80 p-4 bg-gradient-to-br from-amber-50/80 to-white shadow-sm border-l-4 border-l-amber-500">
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Total COGS</p>
                <p className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(totalCogs)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200/80 p-4 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm border-l-4 border-l-emerald-500">
                <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Gross profit</p>
                <p className={`text-lg font-bold mt-1 ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(grossProfit)}</p>
              </div>
            </div>
          )}
          {/* Void & Refund */}
          {(voidedCount > 0 || refundCount > 0) && (
            <div className="flex flex-wrap gap-4 text-sm">
              {voidedCount > 0 && <span className="text-amber-700">Voided: {voidedCount}</span>}
              {refundCount > 0 && <span className="text-amber-700">Refunds: {refundCount}</span>}
            </div>
          )}
          {/* Stock impact */}
          <div className="rounded-2xl border border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-emerald-50/50 border-l-4 border-l-emerald-500">
            <p className="text-sm font-medium text-slate-800">Stock impact</p>
            <p className="text-sm text-slate-600 mt-1">Total qty out today: <strong>{itemsSold}</strong> · Products affected: <strong>{productsAffected}</strong></p>
            <a href="/reports?report=stock-movement" className="text-sm text-emerald-600 hover:underline mt-2 inline-block font-medium">View Stock Movement</a>
          </div>
          {/* Cashier breakdown */}
          {cashierBreakdown.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">By cashier</h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Cashier</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Transactions</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {cashierBreakdown.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-sm text-slate-800">{row.name || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-slate-700">{row.transactions ?? 0}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-medium text-slate-800">{formatCurrency(row.sales || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Show 20 items per page
  
  // Use groupBy from data if available
  const groupBy = data?.groupBy || 'time';
  
  // Pagination logic - calculate these before conditional returns
  const reportData = data?.data || [];
  const totalPages = Math.ceil(reportData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = reportData.slice(startIndex, endIndex);
  
  // Reset to page 1 when data changes - MUST be before any conditional returns
  useEffect(() => {
    setCurrentPage(1);
  }, [data?.data?.length, data?.groupBy]);

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 sm:p-10 bg-slate-50 rounded-2xl border border-slate-200">
        <TrendingUp size={48} className="mx-auto text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800">No data available</h3>
        <p className="text-slate-500 mt-2 text-sm">Select a time period and generate the report.</p>
      </div>
    );
  }

  if (!data) return null;

  const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';
  const companyName = data.companyName || 'Company';

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

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
      {/* Company Header with Logo */}
      {data.logoUrl && (
        <div className="text-center mb-6">
          <img
            src={
              typeof data.logoUrl === 'string' && data.logoUrl.startsWith('/uploads/')
                ? `/api/uploads/${data.logoUrl.replace(/^\/+uploads\//, '')}`
                : typeof data.logoUrl === 'string' && (data.logoUrl.startsWith('http://') || data.logoUrl.startsWith('https://'))
                ? data.logoUrl
                : typeof data.logoUrl === 'string'
                ? data.logoUrl
                : data.logoUrl
            }
            alt={`${companyName} Logo`}
            className="h-16 w-auto object-contain mx-auto"
          />
        </div>
      )}

      {data.groupBy === 'time' && data.data && (
        <div className="space-y-4">
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
              <div className="text-sm text-slate-600">
                Showing {startIndex + 1} to {Math.min(endIndex, reportData.length)} of {reportData.length} months
              </div>
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Month</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide"># of invoices</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Sales amount</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Avg invoice</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">% change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {currentPageData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 text-sm text-slate-800">{item.month}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{item.invoiceCount}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(item.salesAmount)}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(item.avgInvoice)}</td>
                    <td className={`px-4 py-2.5 text-sm text-right ${item.percentChange != null ? (item.percentChange >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-500'}`}>
                      {item.percentChange != null ? `${item.percentChange >= 0 ? '+' : ''}${Number(item.percentChange).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
                {data.totals && (
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                    <td className="px-4 py-2.5 text-sm text-slate-800">Total</td>
                    <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{data.totals.totalInvoices}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(data.totals.totalSales)}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(data.totals.avgInvoice)}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-500 text-right">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6 pt-6 border-t border-slate-200">
              <button type="button" onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">First</button>
              <button type="button" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Previous</button>
              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => (
                  page === '...' ? <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">…</span> : (
                    <button type="button" key={page} onClick={() => handlePageChange(page)} className={`px-3 py-2 text-sm border rounded-xl transition-colors ${currentPage === page ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>{page}</button>
                  )
                ))}
              </div>
              <button type="button" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next</button>
              <button type="button" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Last</button>
            </div>
          )}
        </div>
      )}

      {(data.groupBy === 'product' || data.groupBy === 'category') && data.data && (
        <div className="space-y-4">
          {/* Pagination Info */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-xl">
              <div className="text-sm text-slate-700">
                Showing {startIndex + 1} to {Math.min(endIndex, reportData.length)} of {reportData.length} {data.groupBy === 'product' ? 'products' : 'categories'}
              </div>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{data.groupBy === 'product' ? 'Product' : 'Category'}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase"># of Sales</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Quantity Sold</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentPageData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-800">{item.name}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.salesCount}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.quantitySold}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.revenue)}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.percentOfTotal.toFixed(1)}%</td>
                  </tr>
                ))}
                {data.totals && (
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                    <td className="px-4 py-2 text-sm text-slate-800">TOTAL</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{data.totals.totalSales}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{data.totals.totalQuantity}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.totalRevenue)}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">100%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-slate-200">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => {
                  if (page === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">
                        ...
                      </span>
                    );
                  }
                  
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 text-sm border rounded-md ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          )}
        </div>
      )}

      {data.groupBy === 'customer' && data.data && (
        <div className="space-y-4">
          {/* Pagination Info */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-xl">
              <div className="text-sm text-slate-700">
                Showing {startIndex + 1} to {Math.min(endIndex, reportData.length)} of {reportData.length} customers
              </div>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Rank</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Customer Name</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase"># of Orders</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total Sales</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Avg Order</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentPageData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-800">{item.rank}</td>
                    <td className="px-4 py-2 text-sm text-slate-800">{item.customerName}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.orderCount}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.totalSales)}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.avgOrder)}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.percentOfTotal.toFixed(1)}%</td>
                  </tr>
                ))}
                {data.totals && (
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                    <td colSpan={2} className="px-4 py-2 text-sm text-slate-800">TOTAL</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{data.totals.totalOrders}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.totalSales)}</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">-</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">100%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-slate-200">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => {
                  if (page === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">
                        ...
                      </span>
                    );
                  }
                  
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 text-sm border rounded-md ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          )}
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
      <div className="text-center p-8 bg-gradient-to-br from-slate-50 to-amber-50/50 rounded-2xl border border-slate-200">
        <TrendingDown size={48} className="mx-auto text-amber-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-700">No data available</h3>
        <p className="text-slate-500 mt-2">Please select a time period and generate the report.</p>
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
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-amber-50/80 to-slate-50">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">This Period</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Last Period</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Change</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">% Change</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-slate-800">{item.category}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.thisPeriod)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.lastPeriod)}</td>
                  <td className={`px-4 py-2 text-sm text-right ${item.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.change >= 0 ? '+' : ''}{formatCurrency(item.change)}
                  </td>
                  <td className={`px-4 py-2 text-sm text-right ${item.percentChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.percentChange >= 0 ? '+' : ''}{item.percentChange.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.percentOfTotal.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-slate-800">TOTAL EXPENSES</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.thisPeriod)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.lastPeriod)}</td>
                  <td className={`px-4 py-2 text-sm text-right ${data.totals.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {data.totals.change >= 0 ? '+' : ''}{formatCurrency(data.totals.change)}
                  </td>
                  <td className={`px-4 py-2 text-sm text-right ${data.totals.percentChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {data.totals.percentChange >= 0 ? '+' : ''}{data.totals.percentChange.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">100%</td>
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
              <tr className="bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Month</th>
                {data.categories && data.categories.map((cat, idx) => (
                  <th key={idx} className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">{cat}</th>
                ))}
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-slate-800">{item.month}</td>
                  {data.categories && data.categories.map((cat, cIdx) => (
                    <td key={cIdx} className="px-4 py-2 text-sm text-slate-800 text-right">
                      {formatCurrency(item.categories[cat] || 0)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-sm text-slate-800 text-right font-semibold">
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
      <div className="text-center p-8 bg-gradient-to-br from-slate-50 to-violet-50/50 rounded-2xl border border-slate-200">
        <PieChart size={48} className="mx-auto text-violet-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-700">No data available</h3>
        <p className="text-slate-500 mt-2">Please select a time period and generate the report.</p>
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
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-50/80 to-slate-50">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Product</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Units Sold</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">COGS</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Gross Profit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-slate-800">{item.productName}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.unitsSold}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.margin.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-slate-800">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{data.totals.unitsSold}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{data.totals.margin.toFixed(1)}%</td>
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
              <tr className="bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">COGS</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Gross Profit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-slate-800">{item.customerName}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.margin.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-slate-800">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{data.totals.margin.toFixed(1)}%</td>
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
              <tr className="bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Month</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">COGS</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Gross Profit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.data.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-slate-800">{item.month}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.margin.toFixed(1)}%</td>
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2 text-sm text-slate-800">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.revenue)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.cogs)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(data.totals.grossProfit)}</td>
                  <td className="px-4 py-2 text-sm text-slate-800 text-right">{data.totals.margin.toFixed(1)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </FinancialReport>
  );
};

