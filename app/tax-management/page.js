"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import TaxSettlementModal from '@/components/TaxSettlementModal';
import { FaFileInvoiceDollar, FaMoneyBillWave, FaCog, FaSearch, FaFilter, FaDownload, FaEye, FaEdit, FaTrash, FaPlus, FaHandHoldingUsd } from 'react-icons/fa';
import { Search, Calendar, RefreshCw, Download, FileText, DollarSign, Percent as PercentIcon } from 'lucide-react';
import TaxSettings from "@/components/tax/TaxSettings";
import TaxSummaryChart from "@/components/tax/TaxSummaryChart";
import TaxCollectedTable from "@/components/tax/TaxCollectedTable";
import TaxPaidTable from "@/components/tax/TaxPaidTable";
import { calculateDateRange, getTimeframeLabel } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/currencyUtils";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";

export default function TaxManagement() {
  // State for filtering and data
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [taxData, setTaxData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary"); // summary, collected, paid, settings
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [exportTaxPermissions, setExportTaxPermissions] = useState(false);
  const [showTaxSettlementModal, setShowTaxSettlementModal] = useState(false);
  const [settlementMessage, setSettlementMessage] = useState('');
  
  useEffect(() => {
    const fetchPermissions = async () => {  
      const canExportTax = await getPermission("tax.export");  
  
      setExportTaxPermissions(canExportTax);
    };
  
    fetchPermissions();
  }, []);
  // Update date range when timeframe changes
  useEffect(() => {
    if (timeframe !== "custom") {
      const range = calculateDateRange(timeframe);
      setDateRange({
        startDate: range.startDate,
        endDate: range.endDate
      });
      setShowCustomDateRange(false);
    } else {
      setShowCustomDateRange(true);
    }
  }, [timeframe]);

  // Apply custom date range
  const applyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      setDateRange({
        startDate: customStartDate,
        endDate: customEndDate
      });
    }
  };

  // Fetch tax data
  useEffect(() => {
    if (!dateRange.startDate || !dateRange.endDate) return;
    
    const fetchTaxData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const url = `/api/reports/tax-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
        console.log('Fetching tax data from:', url);
        
        const response = await fetch(url);
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          throw new Error(`Error fetching tax data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Tax data received:', data);
        
        // Force use of API data - no fallback to mock data
        setTaxData(data);
        setLastUpdated(new Date());
        setError(null); // Clear any previous errors
      } catch (err) {
        console.error("Error fetching tax data:", err);
        setError(`API Error: ${err.message}`);
        
        // Temporarily disable mock data to see what's happening
        // setTaxData(generateMockTaxData());
        setTaxData(null); // This will show "No Tax Data Available"
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTaxData();
  }, [dateRange]);

  // Generate mock tax data for demo purposes
  const generateMockTaxData = () => {
    return {
      period: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      },
      collectedTaxes: {
        byRate: [
          {
            rate: 16.5,
            taxableAmount: 12500,
            taxAmount: 2062.5,
            items: [
              { type: 'invoice', id: 'INV-001', description: 'Website Development', taxableAmount: 5000, taxAmount: 825 },
              { type: 'invoice', id: 'INV-002', description: 'Hosting Services', taxableAmount: 3500, taxAmount: 577.5 },
              { type: 'sale', id: 'SALE-001', description: 'Software License', taxableAmount: 4000, taxAmount: 660 }
            ]
          },
          {
            rate: 20,
            taxableAmount: 7800,
            taxAmount: 1560,
            items: [
              { type: 'invoice', id: 'INV-003', description: 'Consulting Services', taxableAmount: 4800, taxAmount: 960 },
              { type: 'sale', id: 'SALE-002', description: 'Premium Support Package', taxableAmount: 3000, taxAmount: 600 }
            ]
          }
        ],
        totalTaxableAmount: 20300,
        totalCollectedTax: 3622.5
      },
      paidTaxes: {
        expenses: [
          { id: 'EXP-001', description: 'Office Rent', amount: 450, date: '2025-03-15' },
          { id: 'EXP-002', description: 'Utilities', amount: 125, date: '2025-03-10' },
          { id: 'EXP-003', description: 'Office Supplies', amount: 87.5, date: '2025-03-22' }
        ],
        totalTaxPaid: 662.5
      },
      netTaxLiability: 2960
    };
  };

  // Handle search
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      // Implementation would go here for filtering the displayed data
      // For now, we'll just use the search term to filter client-side
    }, 500);
    
    return () => clearTimeout(delaySearch);
  }, [searchTerm]);

  // Export tax report
  const handleExport = async (format = 'csv') => {
    try {
      window.location.href = `/api/reports/tax-summary/export?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&format=${format}`;
    } catch (err) {
      console.error("Error exporting tax data:", err);
      alert("Failed to export tax data. Please try again.");
    }
  };

  // Date range options for the filter dropdown
  const dateRangeOptions = [
    { value: "thisMonth", label: "This Month" },
    { value: "lastMonth", label: "Last Month" },
    { value: "thisQuarter", label: "This Quarter" },
    { value: "lastQuarter", label: "Last Quarter" },
    { value: "thisYear", label: "This Year" },
    { value: "lastYear", label: "Last Year" },
    { value: "custom", label: "Custom Range" }
  ];

  // Format date for display
  const formatDateForDisplay = (dateString) => {
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  };

  // Refresh data
  const refreshData = () => {
    if (dateRange.startDate && dateRange.endDate) {
      const fetchTaxData = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
          const response = await fetch(
            `/api/reports/tax-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
          );
          
          if (!response.ok) {
            throw new Error(`Error fetching tax data: ${response.statusText}`);
          }
          
          const data = await response.json();
          setTaxData(data);
          setLastUpdated(new Date());
        } catch (err) {
          console.error("Error fetching tax data:", err);
          setError("Failed to load tax data. Please try again.");
          
          // Set mock data for demo purposes
          setTaxData(generateMockTaxData());
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchTaxData();
    }
  };

  // Handle tax settlement
  const handleTaxSettlement = async (settlementData) => {
    try {
      const response = await fetch('/api/tax/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settlementData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record tax settlement');
      }

      const result = await response.json();
      
      // Show success message
      setSettlementMessage(`Tax settlement of ${result.settlement.amount} recorded successfully!`);
      
      // Auto-dismiss message after 5 seconds
      setTimeout(() => {
        setSettlementMessage('');
      }, 5000);
      
      // Refresh tax data to reflect the settlement
      refreshData();
      
    } catch (error) {
      console.error('Error recording tax settlement:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  return (
    <PermissionGuard permission="tax.view">
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Tax Management</h1>
        {exportTaxPermissions && ( <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="btn bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>
        </div>)}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`py-3 px-4 font-medium text-sm ${
            activeTab === "summary"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("summary")}
        >
          Tax Summary
        </button>
        <button
          className={`py-3 px-4 font-medium text-sm ${
            activeTab === "collected"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("collected")}
        >
          Collected Taxes
        </button>
        <button
          className={`py-3 px-4 font-medium text-sm ${
            activeTab === "paid"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("paid")}
        >
          Paid Taxes
        </button>
     
      </div>

      {activeTab !== "settings" && (
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tax items..."
                  className="border border-gray-300 pl-10 pr-4 py-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative">
                <select
                  className="border border-gray-300 pl-10 pr-8 py-2 rounded appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                >
                  {dateRangeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
              <button
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                onClick={refreshData}
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          {/* Custom date range inputs */}
          {showCustomDateRange && (
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="border border-gray-300 px-3 py-2 rounded w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="border border-gray-300 px-3 py-2 rounded w-full"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={applyCustomDateRange}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              <p>{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : taxData ? (
            <>
              {/* Status info */}
              <div className="text-sm text-gray-500 mb-6 flex justify-between items-center">
                <span>
                  Showing tax data for: {formatDateForDisplay(dateRange.startDate)} to{" "}
                  {formatDateForDisplay(dateRange.endDate)}
                </span>
                <span>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              </div>

              {/* Display appropriate content based on active tab */}
              {activeTab === "summary" && (
                <>
                  {/* Tax Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-blue-50 rounded-lg p-6">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium text-blue-800">Total Collected Tax</h3>
                        <DollarSign className="h-5 w-5 text-blue-500" />
                      </div>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatCurrency(taxData.collectedTaxes.totalCollectedTax)}
                      </p>
                      <p className="text-sm text-blue-600 mt-2">
                        On {formatCurrency(taxData.collectedTaxes.totalTaxableAmount)} taxable amount
                      </p>
                    </div>

                    <div className="bg-red-50 rounded-lg p-6">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium text-red-800">Total Paid Tax</h3>
                        <DollarSign className="h-5 w-5 text-red-500" />
                      </div>
                      <p className="text-2xl font-bold text-red-700">
                        {formatCurrency(taxData.paidTaxes.totalTaxPaid)}
                      </p>
                      <p className="text-sm text-red-600 mt-2">
                        From {taxData.paidTaxes.expenses.length} expense transactions
                      </p>
                    </div>

                    <div className="bg-green-50 rounded-lg p-6">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium text-green-800">Net Tax Liability</h3>
                        <PercentIcon className="h-5 w-5 text-green-500" />
                      </div>
                      <p className="text-2xl font-bold text-green-700">
                        {formatCurrency(taxData.netTaxLiability)}
                      </p>
                      <p className="text-sm text-green-600 mt-2">
                        Due to tax authority for this period
                      </p>
                    </div>
                  </div>

                  {/* VAT Summary: Purchase taxes → Input VAT, Sales taxes → Output VAT, Net VAT payable */}
                  {taxData.vatSummary != null && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">VAT Summary</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <p className="text-xs font-medium text-slate-600 uppercase">Input VAT (Purchases)</p>
                          <p className="text-xl font-bold text-slate-800 mt-1">
                            {formatCurrency(taxData.vatSummary.inputVat)}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            From supplier bills &amp; POs
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <p className="text-xs font-medium text-slate-600 uppercase">Output VAT (Sales)</p>
                          <p className="text-xl font-bold text-slate-800 mt-1">
                            {formatCurrency(taxData.vatSummary.outputVat)}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Tax collected on sales/invoices
                          </p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                          <p className="text-xs font-medium text-indigo-700 uppercase">Net VAT Payable</p>
                          <p className="text-xl font-bold text-indigo-800 mt-1">
                            {formatCurrency(taxData.vatSummary.netVatPayable)}
                          </p>
                          <p className="text-xs text-indigo-600 mt-1">
                            Output VAT − Input VAT
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tax Summary Chart */}
                  <TaxSummaryChart taxData={taxData} />
                </>
              )}

              {activeTab === "collected" && (
                <TaxCollectedTable 
                  collectedTaxes={taxData.collectedTaxes} 
                  searchTerm={searchTerm} 
                />
              )}

              {activeTab === "paid" && (
                <>
                  {/* Success Message */}
                  {settlementMessage && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
                      <p>{settlementMessage}</p>
                    </div>
                  )}

                  {/* Tax Status Card */}
                  {taxData?.netTaxLiability > 0 ? (
                    // Outstanding Tax Liability
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-semibold text-orange-800 mb-2">
                            Outstanding Tax Liability
                          </h3>
                          <p className="text-2xl font-bold text-orange-700 mb-2">
                            {formatCurrency(taxData.netTaxLiability)}
                          </p>
                          <p className="text-sm text-orange-600">
                            This amount needs to be settled with the tax authority
                          </p>
                        </div>
                        <div>
                          <PermissionGuard permission="tax.view" fallback={null}>
                            <button
                              onClick={() => setShowTaxSettlementModal(true)}
                              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors"
                            >
                              <FaHandHoldingUsd className="text-lg" />
                              Settle Tax
                            </button>
                          </PermissionGuard>
                        </div>
                      </div>
                    </div>
                  ) : taxData?.netTaxLiability < 0 ? (
                    // Tax Credit/Overpayment
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                      <div className="flex items-center">
                        <div>
                          <h3 className="text-lg font-semibold text-green-800 mb-2">
                            Tax Credit Available
                          </h3>
                          <p className="text-2xl font-bold text-green-700 mb-2">
                            {formatCurrency(Math.abs(taxData.netTaxLiability))}
                          </p>
                          <p className="text-sm text-green-600">
                            You have overpaid taxes. This credit can be applied to future tax liabilities or requested as a refund.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // No Tax Liability
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                      <div className="flex items-center">
                        <div>
                          <h3 className="text-lg font-semibold text-blue-800 mb-2">
                            Tax Status: Up to Date
                          </h3>
                          <p className="text-2xl font-bold text-blue-700 mb-2">
                            {formatCurrency(0)}
                          </p>
                          <p className="text-sm text-blue-600">
                            No outstanding tax liability for this period.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <TaxPaidTable 
                    paidTaxes={taxData?.paidTaxes || { expenses: [], totalTaxPaid: 0 }} 
                    searchTerm={searchTerm} 
                  />
                </>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Tax Data Available</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Select a date range to view tax information or try a different period.
              </p>
            </div>
          )}
        </div>
      )}

      {/* {activeTab === "settings" && <TaxSettings />} */}

      {/* Tax Settlement Modal */}
      <TaxSettlementModal
        isOpen={showTaxSettlementModal}
        onClose={() => setShowTaxSettlementModal(false)}
        onSubmit={handleTaxSettlement}
        taxLiability={taxData?.netTaxLiability || 0}
      />
    </div>
    </PermissionGuard>
  );
}