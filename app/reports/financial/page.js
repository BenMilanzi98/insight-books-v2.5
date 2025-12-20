"use client";
import { useState, useEffect } from "react";
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
import { formatCurrency, formatDate } from "@/lib/dateUtils";

const FinancialReportsPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [financialData, setFinancialData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedReport, setSelectedReport] = useState("overview");

  useEffect(() => {
    fetchFinancialData();
  }, [selectedPeriod]);

  const fetchFinancialData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/dashboard/income-expenses?period=${selectedPeriod}`);
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
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
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
              { id: "income", name: "Income Analysis", icon: TrendingUp },
              { id: "expenses", name: "Expense Analysis", icon: TrendingDown },
              { id: "profitability", name: "Profitability", icon: BarChart3 },
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

            {selectedReport === "income" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Income Analysis</h3>
                  <p className="text-gray-600">
                    Detailed breakdown of income sources and revenue streams.
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Income Sources</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Product Sales:</span>
                      <span className="font-medium">{formatCurrency(750000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service Revenue:</span>
                      <span className="font-medium">{formatCurrency(250000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Other Income:</span>
                      <span className="font-medium">{formatCurrency(50000)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedReport === "expenses" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Expense Analysis</h3>
                  <p className="text-gray-600">
                    Detailed breakdown of expenses by category and department.
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Expense Categories</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Operating Expenses:</span>
                      <span className="font-medium">{formatCurrency(400000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cost of Goods Sold:</span>
                      <span className="font-medium">{formatCurrency(300000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Administrative:</span>
                      <span className="font-medium">{formatCurrency(200000)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedReport === "profitability" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Profitability Analysis</h3>
                  <p className="text-gray-600">
                    Analysis of profit margins, return on investment, and financial ratios.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Profitability Ratios</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Gross Margin:</span>
                        <span className="font-medium">45.2%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Margin:</span>
                        <span className="font-medium">24.3%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ROI:</span>
                        <span className="font-medium">18.7%</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Trends</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Margin Trend:</span>
                        <span className="text-green-600 font-medium">↗ Improving</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Efficiency:</span>
                        <span className="text-green-600 font-medium">↗ Improving</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedReport === "cashflow" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Cash Flow Analysis</h3>
                  <p className="text-gray-600">
                    Analysis of cash inflows, outflows, and cash position.
                  </p>
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