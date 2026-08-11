"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  Users,
  PieChart,
  Download
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import { formatCurrency } from "@/lib/currencyUtils";
import { UniversalDateRangeFilter } from "@/components/UniversalDateRangeFilter";
import { calculateDateRange } from "@/lib/dateUtils";
import StatCard from "@/components/ui/StatCard";

export default function SupplierReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeReport, setActiveReport] = useState("aging");
  const [agingReport, setAgingReport] = useState(null);
  const [topSpending, setTopSpending] = useState([]);
  const [summary, setSummary] = useState(null);
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [customDateRange, setCustomDateRange] = useState(null);

  // Load reports data
  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const tenantId = localStorage.getItem('tenantId');
      if (!tenantId) {
        throw new Error("Tenant ID not found");
      }

      const r = calculateDateRange(timeframe, false, timeframe === "custom" ? customDateRange : null);
      const start = r.startDate.toISOString().split("T")[0];
      const end = r.endDate.toISOString().split("T")[0];

      // Load aging report
      const agingRes = await fetch(
        `/api/suppliers/reports/aging?tenantId=${tenantId}&includeDetails=false&asOfDate=${encodeURIComponent(end)}`
      );
      const agingJson = await agingRes.json();
      if (agingRes.ok) {
        setAgingReport(agingJson);
      }

      // Load top spending
      const spendingRes = await fetch(
        `/api/suppliers/reports/top-spending?tenantId=${tenantId}&limit=10&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`
      );
      const spendingJson = await spendingRes.json();
      if (spendingRes.ok) {
        setTopSpending(spendingJson);
      }

      // Calculate summary from aging report
      if (agingJson?.totals) {
        setSummary({
          totalOutstanding: agingJson.totals.totalOutstanding,
          supplierCount: agingJson.totals.supplierCount,
          current: agingJson.totals.current,
          days31to60: agingJson.totals.days31to60,
          days61to90: agingJson.totals.days61to90,
          over90: agingJson.totals.over90
        });
      }

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [timeframe, customDateRange]);

  // Format currency helper
  const formatNumber = (num) => {
    if (num === null || num === undefined) return "-";
    return new Intl.NumberFormat('en-MW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Format date helper
  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get risk badge
  const getRiskBadge = (level) => {
    const styles = {
      high: "bg-red-100 text-red-700 border-red-200",
      medium: "bg-orange-100 text-orange-700 border-orange-200",
      low: "bg-green-100 text-green-700 border-green-200"
    };
    return styles[level] || styles.low;
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          Loading reports...
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission="suppliers.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link href="/suppliers" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft size={18} />
              Back to Suppliers
            </Link>
            
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Supplier Reports</h1>
                <p className="text-sm text-gray-600">
                  Accounts payable aging analysis and supplier spending insights.
                </p>
              </div>
              
              <button
                onClick={loadReports}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            <div className="mt-4">
              <UniversalDateRangeFilter
                timeframe={timeframe}
                onTimeframeChange={(tf) => setTimeframe(tf)}
                onCustomDateChange={(range) => setCustomDateRange(range)}
                onRefresh={loadReports}
                loading={loading}
                variant="compact"
              />
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-md text-red-700 flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total Outstanding"
                value={formatCurrency(summary.totalOutstanding || 0)}
                icon={DollarSign}
                valueClassName="text-red-600"
                barClassName="from-red-400 via-rose-500 to-pink-500"
                iconWrapClassName="bg-red-50 text-red-600"
              />
              <StatCard
                label="Current (0-30 Days)"
                value={formatCurrency(summary.current || 0)}
                icon={CheckCircle}
                valueClassName="text-green-600"
                barClassName="from-emerald-400 via-green-500 to-teal-500"
                iconWrapClassName="bg-green-50 text-green-600"
              />
              <StatCard
                label="Overdue (31+ Days)"
                value={formatCurrency((summary.days31to60 || 0) + (summary.days61to90 || 0) + (summary.over90 || 0))}
                icon={AlertTriangle}
                valueClassName="text-orange-600"
                barClassName="from-amber-400 via-orange-500 to-red-400"
                iconWrapClassName="bg-orange-50 text-orange-600"
              />
              <StatCard
                label="Suppliers with Balance"
                value={summary.supplierCount || 0}
                icon={Users}
                barClassName="from-blue-400 via-indigo-500 to-blue-600"
                iconWrapClassName="bg-blue-50 text-blue-600"
              />
            </div>
          )}

          {/* Report Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-4">
              {[
                { id: 'aging', label: 'Aging Analysis', icon: PieChart },
                { id: 'spending', label: 'Top Spending', icon: TrendingUp }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveReport(tab.id)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeReport === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Aging Report */}
          {activeReport === 'aging' && agingReport && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Accounts Payable Aging</h2>
                <span className="text-sm text-gray-500">As of {formatDate(agingReport.asOfDate)}</span>
              </div>

              {/* Aging Summary */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                {[
                  { label: 'Current', value: agingReport.totals?.current || 0, color: 'bg-green-500', percent: agingReport.totals?.current > 0 && agingReport.totals?.totalOutstanding > 0 ? ((agingReport.totals.current / agingReport.totals.totalOutstanding) * 100).toFixed(1) : 0 },
                  { label: '31-60 Days', value: agingReport.totals?.days31to60 || 0, color: 'bg-yellow-500', percent: agingReport.totals?.days31to60 > 0 && agingReport.totals?.totalOutstanding > 0 ? ((agingReport.totals.days31to60 / agingReport.totals.totalOutstanding) * 100).toFixed(1) : 0 },
                  { label: '61-90 Days', value: agingReport.totals?.days61to90 || 0, color: 'bg-orange-500', percent: agingReport.totals?.days61to90 > 0 && agingReport.totals?.totalOutstanding > 0 ? ((agingReport.totals.days61to90 / agingReport.totals.totalOutstanding) * 100).toFixed(1) : 0 },
                  { label: 'Over 90 Days', value: agingReport.totals?.over90 || 0, color: 'bg-red-500', percent: agingReport.totals?.over90 > 0 && agingReport.totals?.totalOutstanding > 0 ? ((agingReport.totals.over90 / agingReport.totals.totalOutstanding) * 100).toFixed(1) : 0 },
                  { label: 'Total', value: agingReport.totals?.totalOutstanding || 0, color: 'bg-gray-500', percent: 100, highlight: true }
                ].map((item) => (
                  <div key={item.label} className={`rounded-lg p-4 ${item.highlight ? 'bg-gray-900 text-white' : 'bg-gray-50'}`}>
                    <p className={`text-xs ${item.highlight ? 'text-gray-300' : 'text-gray-500'}`}>{item.label}</p>
                    <p className={`text-xl font-bold mt-1 ${item.highlight ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(item.value)}
                    </p>
                    <p className={`text-xs mt-1 ${item.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                      {item.percent}%
                    </p>
                    {!item.highlight && (
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                        <div 
                          className={`h-1 rounded-full ${item.color}`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Supplier Aging Table */}
              {agingReport.data && agingReport.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Current</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">31-60 Days</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">61-90 Days</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Over 90</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {agingReport.data.slice(0, 20).map((item) => (
                        <tr key={item.supplier.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link href={`/suppliers/${item.supplier.id}`} className="text-blue-600 hover:underline font-medium">
                              {item.supplier.name}
                            </Link>
                            <p className="text-xs text-gray-500">{item.supplier.code}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-green-600">{formatNumber(item.aging.current)}</td>
                          <td className="px-4 py-3 text-right text-yellow-600">{formatNumber(item.aging.days31to60)}</td>
                          <td className="px-4 py-3 text-right text-orange-600">{formatNumber(item.aging.days61to90)}</td>
                          <td className="px-4 py-3 text-right text-red-600">{formatNumber(item.aging.over90)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{formatNumber(item.aging.totalOutstanding)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getRiskBadge(item.riskAssessment.level)}`}>
                              {item.riskAssessment.label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {agingReport.data.length > 20 && (
                    <p className="text-sm text-gray-500 text-center py-3">
                      Showing 20 of {agingReport.data.length} suppliers
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign size={40} className="mx-auto mb-3 text-gray-300" />
                  <p>No outstanding balances found</p>
                </div>
              )}
            </div>
          )}

          {/* Top Spending Report */}
          {activeReport === 'spending' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Top Suppliers by Spending</h2>
              </div>

              {topSpending && topSpending.length > 0 ? (
                <div className="space-y-4">
                  {topSpending.map((item, index) => (
                    <div key={item.supplier?.id || index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <Link href={`/suppliers/${item.supplier?.id}`} className="text-blue-600 hover:underline font-medium">
                          {item.supplier?.name || 'Unknown Supplier'}
                        </Link>
                        <p className="text-xs text-gray-500">
                          {item.supplier?.contactPerson && `Contact: ${item.supplier.contactPerson} | `}
                          {item.supplier?.email}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(item.totalSpending)}</p>
                        <p className="text-xs text-gray-500">Total Spending</p>
                      </div>
                      
                      <div className="w-32">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-blue-500"
                            style={{ 
                              width: `${topSpending[0]?.totalSpending > 0 
                                ? (item.totalSpending / topSpending[0].totalSpending) * 100 
                                : 0}%` 
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-right">
                          {topSpending[0]?.totalSpending > 0 
                            ? ((item.totalSpending / topSpending[0].totalSpending) * 100).toFixed(1)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Total (Top 10)</span>
                      <span className="text-lg font-bold text-gray-900">
                        {formatCurrency(topSpending.reduce((sum, item) => sum + (item.totalSpending || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp size={40} className="mx-auto mb-3 text-gray-300" />
                  <p>No spending data available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
}
