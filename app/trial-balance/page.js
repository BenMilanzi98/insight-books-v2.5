"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Calendar, 
  Download, 
  FileText, 
  Printer, 
  RefreshCw, 
  Search,
  X,
  Clock,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { fetchTrialBalance, exportTrialBalance } from "@/app/services/trialBalanceService";
import { formatCurrency } from "@/lib/currencyUtils";
import { getTimeframeLabel } from "@/lib/dateUtils";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";

const TrialBalance = () => {
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [displayTimeframe, setDisplayTimeframe] = useState("This Month");
  const [searchTerm, setSearchTerm] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [pagePermissions, setPagePermissions] = useState({ 
    canCreateJournal:false,
    canExportReports:false,
    canExportTrial:false 
  });
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountHistory, setAccountHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  useEffect(() => {
    const fetchPermissions = async () => {   
      const canCreateJournal= await getPermission("journalEntries.create");   
      const canExportReports = await getPermission("reports.delete")
      const canExportTrial= await getPermission("trialBalance.update");  
      setPagePermissions({
        canCreateJournal,
        canExportReports,
        canExportTrial 
      });
    };
  
    fetchPermissions();
  }, []);
  const printFrameRef = useRef(null);

  // Map of user-friendly timeframe options to API timeframes
  const timeframeMapping = {
    "Today": "today",
    "This Week": "thisWeek",
    "This Month": "thisMonth",
    "Last Month": "lastMonth",
    "This Quarter": "thisQuarter",
    "Last Quarter": "lastQuarter",
    "This Year": "thisYear",
    "Last Year": "lastYear",
    "Custom Range": "custom"
  };

  // Helper function to normalize account types
  const normalizeAccountType = (type) => {
    if (!type) return "Other";
    
    const typeStr = String(type).trim();
    const lower = typeStr.toLowerCase();
    
    // Map API types to display types
    if (lower === 'asset' || lower === 'assets') return "Assets";
    if (lower === 'liability' || lower === 'liabilities') return "Liabilities";
    if (lower === 'equity') return "Equity";
    if (lower === 'income' || lower === 'revenue') return "Revenue";
    if (lower === 'expense' || lower === 'expenses') return "Expenses";
    
    // Handle uppercase variants
    if (typeStr === "ASSET" || typeStr === "ASSETS") return "Assets";
    if (typeStr === "LIABILITY" || typeStr === "LIABILITIES") return "Liabilities";
    if (typeStr === "EQUITY") return "Equity";
    if (typeStr === "INCOME" || typeStr === "REVENUE") return "Revenue";
    if (typeStr === "EXPENSE" || typeStr === "EXPENSES") return "Expenses";
    
    // Return as-is if no mapping found
    return typeStr;
  };

  // Helper to format dates from API
  const formatApiDate = (dateString) => {
    if (!dateString) return "";
    try {
      // Handle date strings or date objects
      try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      } catch (error) {
        return 'N/A';
      }
    } catch (error) {
      console.error("Error parsing date:", error, dateString);
      return String(dateString); // Fallback
    }
  };

  // Fetch trial balance data based on selected timeframe
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Convert display timeframe to API timeframe
      const apiTimeframe = timeframeMapping[displayTimeframe] || "thisMonth";
      
      console.log("Fetching trial balance for timeframe:", apiTimeframe);
      
      const data = await fetchTrialBalance(apiTimeframe);
      console.log('Trial balance data received:', data);
      
      // If accounts are available, process them
      if (data && data.accounts) {
        console.log('Account types detected:', [...new Set(data.accounts.map(a => a.type))]);
        
        // Deduplicate accounts by accountCode (keep the one with highest balance)
        const accountMap = new Map();
        data.accounts.forEach(account => {
          const code = String(account.code || account.accountCode || '').trim();
          if (!code || code === 'N/A') return;
          
          const existing = accountMap.get(code);
          if (!existing) {
            accountMap.set(code, account);
          } else {
            // Keep the account with higher balance
            const existingBalance = (existing.debit || 0) + (existing.credit || 0);
            const currentBalance = (account.debit || 0) + (account.credit || 0);
            if (currentBalance > existingBalance) {
              accountMap.set(code, account);
            }
          }
        });
        
        // Process the accounts to ensure they have isHeader and normalized type
        const processedAccounts = Array.from(accountMap.values()).map(account => ({
          ...account,
          // Ensure isHeader exists (default to false if not provided)
          isHeader: account.isHeader !== undefined ? account.isHeader : false,
          // Normalize account type for consistent filtering
          type: normalizeAccountType(account.type)
        }));
        
        console.log('Processed accounts count:', processedAccounts.length);
        console.log('Sample account:', processedAccounts[0]);
        
        setAccounts(processedAccounts);
      } else {
        setAccounts([]);
        console.warn("No accounts data found in API response");
      }
      
      setLastUpdated(new Date());
      setTimeframe(apiTimeframe);
    } catch (err) {
      console.error("Error fetching trial balance data:", err);
      setError("Failed to load trial balance data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize data on component mount and when timeframe changes
  useEffect(() => {
    fetchData();
  }, [displayTimeframe]);

  const handleRefresh = () => {
    fetchData();
  };

  // Fetch account history when an account is clicked
  const fetchAccountHistory = async (account) => {
    try {
      setIsLoadingHistory(true);
      setSelectedAccount(account);
      setShowHistoryModal(true);

      // Get date range for current timeframe
      const apiTimeframe = timeframeMapping[displayTimeframe] || "thisMonth";
      const { calculateDateRange } = await import('@/lib/dateUtils');
      const { startDate, endDate } = calculateDateRange(apiTimeframe);
      
      // Format dates as YYYY-MM-DD
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Fetch account history from the new API endpoint
      const queryParams = new URLSearchParams({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      });

      const response = await fetch(`/api/accounts/${account.id}/history?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch account history');
      }

      const data = await response.json();
      setAccountHistory(data.transactions || []);
    } catch (err) {
      console.error("Error fetching account history:", err);
      setAccountHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleAccountClick = (account) => {
    fetchAccountHistory(account);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleTimeframeChange = (e) => {
    setDisplayTimeframe(e.target.value);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const blob = await exportTrialBalance(timeframe, exportFormat);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trial-balance-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setShowExportOptions(false);
    } catch (err) {
      console.error("Error exporting trial balance:", err);
      alert("Failed to export trial balance. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Filter accounts based on search term
  const filteredAccounts = accounts.filter(account => {
    // Include all accounts if no search term is provided
    if (!searchTerm.trim()) return true;
    
    // Check if name or code contains the search term
    return (
      (account.name && account.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (account.code && account.code.includes(searchTerm))
    );
  });

  // Date range options for the filter dropdown
  const dateRangeOptions = [
    "Today",
    "This Week",
    "This Month",
    "Last Month",
    "This Quarter",
    "This Year",
    "Custom Range"
  ];

  // Calculate totals
  const totalDebits = filteredAccounts.reduce((total, account) => total + (account.debit || 0), 0);
  const totalCredits = filteredAccounts.reduce((total, account) => total + (account.credit || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01; // Allow for floating point imprecision

  // Format date for display
  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <PermissionGuard permission="trialBalance.view">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 shadow-xl shadow-indigo-200/50 p-6 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Trial Balance</h1>
                  <p className="text-indigo-100 text-sm mt-0.5">Debits and credits by account for the selected period</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/20 transition-all"
                  onClick={handlePrint}
                  disabled={isLoading || isPrinting}
                >
                  <Printer size={18} />
                  Print
                </button>
                {pagePermissions.canExportTrial && (
                  <div className="relative">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 font-medium transition-all"
                      onClick={() => setShowExportOptions(!showExportOptions)}
                      disabled={isLoading || isExporting}
                    >
                      <Download size={18} />
                      Export
                    </button>
                    {showExportOptions && (
                      <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg bg-white border border-slate-200 p-3 z-10">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
                        <select
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 mb-3"
                          value={exportFormat}
                          onChange={(e) => setExportFormat(e.target.value)}
                        >
                          <option value="pdf">PDF</option>
                          <option value="csv">CSV</option>
                          <option value="xlsx">Excel</option>
                        </select>
                        <button
                          type="button"
                          className="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                          onClick={handleExport}
                        >
                          {isExporting ? "Exporting..." : "Download"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-4 sm:p-6 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-4">
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[140px]">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  <select
                    className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
                    value={displayTimeframe}
                    onChange={handleTimeframeChange}
                  >
                    {dateRangeOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search accounts..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Last updated: {formatDate(lastUpdated)}</span>
                <button
                  type="button"
                  className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 p-4 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Loading trial balance...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200">
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider" style={{ width: '10%' }}>Account Code</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider" style={{ width: '40%' }}>Account Name</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider" style={{ width: '15%' }}>Type</th>
                        <th className="px-4 py-3.5 text-right text-xs font-semibold text-amber-600 uppercase tracking-wider" style={{ width: '17.5%' }}>Debit</th>
                        <th className="px-4 py-3.5 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider" style={{ width: '17.5%' }}>Credit</th>
                      </tr>
                    </thead>
                <tbody>
                  {filteredAccounts.length > 0 ? (
                    filteredAccounts.map((account, index) => (
                      <tr 
                        key={`${account.code}-${account.id || index}`} 
                        className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleAccountClick(account)}
                      >
                        <td className="p-3">{account.code}</td>
                        <td className="p-3">{account.name}</td>
                        <td className="p-3">{account.type}</td>
                        <td className="p-3 text-right">
                          {account.debit && account.debit > 0 ? formatCurrency(account.debit, "", 2) : '-'}
                        </td>
                        <td className="p-3 text-right">
                          {account.credit && account.credit > 0 ? formatCurrency(account.credit, "", 2) : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-3 text-center text-gray-500">
                        {searchTerm ? "No accounts match your search" : "No accounts found for this period"}
                      </td>
                    </tr>
                  )}
                  
                  {/* Totals row */}
                  {filteredAccounts.length > 0 && (
                    <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                      <td className="p-3" colSpan={3}>Totals</td>
                      <td className="p-3 text-right">{formatCurrency(totalDebits)}</td>
                      <td className="p-3 text-right">{formatCurrency(totalCredits)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {filteredAccounts.length > 0 && (
              <div className={`mt-4 p-3 rounded text-sm ${
                isBalanced 
                  ? "bg-green-100 text-green-800" 
                  : "bg-red-100 text-red-800"
              }`}>
                {isBalanced 
                  ? "✅ Trial balance is balanced (debits equals credits)"
                  : `❌ Trial balance is not balanced (difference: ${formatCurrency(Math.abs(totalDebits - totalCredits))})`}
              </div>
            )}
          </>
        )}
          </div>

          {/* Hidden print iframe - only used when printing */}
          <iframe
            ref={printFrameRef}
            style={{ display: 'none' }}
            title="Print Frame"
          />

          {/* Account History Modal */}
          {showHistoryModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowHistoryModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <div>
                <h2 className="text-xl font-bold">Account History</h2>
                {selectedAccount && (
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedAccount.code} - {selectedAccount.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingHistory ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : accountHistory.length > 0 ? (
                <div className="space-y-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left border-b">
                        <th className="p-3 font-medium">Date</th>
                        <th className="p-3 font-medium">Reference</th>
                        <th className="p-3 font-medium">Description</th>
                        <th className="p-3 font-medium text-right">Debit</th>
                        <th className="p-3 font-medium text-right">Credit</th>
                        <th className="p-3 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountHistory.map((transaction, idx) => (
                        <tr key={`${transaction.id || idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3">
                            {transaction.date ? formatApiDate(transaction.date) : 'N/A'}
                          </td>
                          <td className="p-3">{transaction.reference || '-'}</td>
                          <td className="p-3">{transaction.description || '-'}</td>
                          <td className="p-3 text-right">
                            {transaction.debit && transaction.debit > 0 ? formatCurrency(transaction.debit, "", 2) : '-'}
                          </td>
                          <td className="p-3 text-right">
                            {transaction.credit && transaction.credit > 0 ? formatCurrency(transaction.credit, "", 2) : '-'}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                              {transaction.source || 'Transaction'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Clock size={48} className="mx-auto mb-4 text-gray-400" />
                  <p>No transaction history found for this account in the selected period.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </PermissionGuard>
  );
};                                                                                                                                                                                        

export default TrialBalance;                                                                                                                                                                                                                                                                                                                                                  