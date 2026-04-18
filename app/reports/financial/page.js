"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Calendar,
  DollarSign,
  PieChart,
  Activity,
  RefreshCw
} from "lucide-react";
import { formatCurrency, formatDate, formatYmdInTimeZone } from "@/lib/dateUtils";
import { UniversalDateRangeFilter } from "@/components/UniversalDateRangeFilter";
import { calculateDateRange } from "@/lib/dateUtils";

const FinancialReportsPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [financialData, setFinancialData] = useState(null);
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [customDateRange, setCustomDateRange] = useState(null);
  const [selectedReport, setSelectedReport] = useState("overview");

  useEffect(() => {
    fetchFinancialData();
  }, [timeframe, customDateRange]);

  const fetchFinancialData = async () => {
    try {
      setIsLoading(true);
      const r = calculateDateRange(timeframe, false, timeframe === "custom" ? customDateRange : null);
      const params = new URLSearchParams();
      params.set("dateRange", timeframe === "custom" ? "custom" : timeframe);
      if (timeframe === "custom") {
        params.set("startDate", formatYmdInTimeZone(r.startDate));
        params.set("endDate", formatYmdInTimeZone(r.endDate));
      }
      const response = await fetch(`/api/dashboard/income-expenses?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data.incomeExpenses);
      }
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = (reportType) => {
    alert(`Exporting ${reportType} report...`);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Financial Reports</h1>
            <p className="text-gray-600">Comprehensive financial analysis and reporting</p>
          </div>
          <div className="flex space-x-3">
            <UniversalDateRangeFilter
              timeframe={timeframe}
              onTimeframeChange={(tf) => setTimeframe(tf)}
              onCustomDateChange={(range) => setCustomDateRange(range)}
              onRefresh={fetchFinancialData}
              loading={isLoading}
              variant="compact"
            />
            <button
              onClick={fetchFinancialData}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center"
            >
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Report Type Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "overview", name: "Overview", icon: Activity },
              { id: "cashflow", name: "Cash Flow", icon: DollarSign }
            ].map((report) => {
              const IconComponent = report.icon;
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
                    selectedReport === report.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <IconComponent size={16} className="mr-2" />
                  {report.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {financialData ? formatCurrency(financialData.totalIncome || 0) : 'MWK 0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">
                  {financialData ? formatCurrency(financialData.totalExpenses || 0) : 'MWK 0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="text-red-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Profit</p>
                <p className="text-2xl font-bold text-blue-600">
                  {financialData ? formatCurrency((financialData.totalIncome || 0) - (financialData.totalExpenses || 0)) : 'MWK 0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                <p className="text-2xl font-bold text-purple-600">
                  {financialData && financialData.totalIncome ? 
                    (((financialData.totalIncome - financialData.totalExpenses) / financialData.totalIncome) * 100).toFixed(1) + '%' : 
                    '0%'
                  }
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <PieChart className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                {selectedReport.charAt(0).toUpperCase() + selectedReport.slice(1)} Report
              </h2>
              <button
                onClick={() => exportReport(selectedReport)}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 flex items-center"
              >
                <Download size={16} className="mr-2" />
                Export Report
              </button>
            </div>
          </div>
          <div className="p-6">
            {selectedReport === "overview" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Financial Overview</h3>
                  <p className="text-gray-600">
                    This report provides a comprehensive overview of your financial performance for the selected period.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Key Metrics</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Revenue Growth: +12.5%</li>
                      <li>• Expense Growth: +8.2%</li>
                      <li>• Profit Margin: 24.3%</li>
                      <li>• Cash Flow: Positive</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Trends</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Revenue trending upward</li>
                      <li>• Expenses under control</li>
                      <li>• Profit margins improving</li>
                      <li>• Strong cash position</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {selectedReport === "cashflow" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Cash Flow Analysis</h3>
                  <p className="text-gray-600">
                    High-level cash view for this dashboard. For the full direct-method Cash Flow Statement (and exports), use the main Reports hub.
                  </p>
                  <Link
                    href="/reports"
                    className="inline-flex mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Open Reports →
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Cash Flow Summary</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Operating Cash Flow:</span>
                        <span className="font-medium text-green-600">{formatCurrency(800000)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Investing Cash Flow:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(200000)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Financing Cash Flow:</span>
                        <span className="font-medium text-blue-600">-{formatCurrency(100000)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Cash Position</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Beginning Balance:</span>
                        <span className="font-medium">{formatCurrency(500000)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Change:</span>
                        <span className="font-medium text-green-600">+{formatCurrency(500000)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ending Balance:</span>
                        <span className="font-medium">{formatCurrency(1000000)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialReportsPage; 