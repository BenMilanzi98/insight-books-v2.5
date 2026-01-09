"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Calendar, 
  Download, 
  FileText, 
  Printer, 
  RefreshCw, 
  Search 
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
    
    // Simple mappings for common account types
    const typeMap = {
      "ASSET": "Assets",
      "LIABILITY": "Liabilities",
      "EQUITY": "Equity",
      "REVENUE": "Revenue",
      "EXPENSE": "Expenses",
      // Add more mappings as needed
    };
    
    return typeMap[type] || type;
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

  // Group accounts by type
  const accountsByType = {
    "Assets": filteredAccounts.filter(account => account.type === "Assets"),
    "Liabilities": filteredAccounts.filter(account => account.type === "Liabilities"),
    "Equity": filteredAccounts.filter(account => account.type === "Equity"),
    "Revenue": filteredAccounts.filter(account => account.type === "Revenue"),
    "Expenses": filteredAccounts.filter(account => account.type === "Expenses"),
    "Other": filteredAccounts.filter(account => 
      !["Assets", "Liabilities", "Equity", "Revenue", "Expenses"].includes(account.type))
  };

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
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Trial Balance</h1>
        <div className="flex space-x-2">
          <button 
            className="btn-outline flex items-center gap-2"
            onClick={handlePrint}
            disabled={isLoading || isPrinting}
          >
            <Printer size={16} />
            Print
          </button>
          
          <div className="relative">
          {pagePermissions.canExportTrial &&(   <button 
              className="btn-secondary flex items-center gap-2"
              onClick={() => setShowExportOptions(!showExportOptions)}
              disabled={isLoading || isExporting}
            >
              <Download size={16} />
              Export
            </button>)}
            
            {showExportOptions && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 p-1 z-10">
                <div className="p-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <select 
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel</option>
                  </select>
                </div>
                <div className="p-1">
                  <button 
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                    onClick={handleExport}
                  >
                    {isExporting ? "Exporting..." : "Download"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4 md:mb-0">
            <div className="relative">
              <select
                className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md"
                value={displayTimeframe}
                onChange={handleTimeframeChange}
              >
                {dateRangeOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search accounts..."
                className="input-search pl-10 pr-4 py-2 border border-gray-300 rounded-md"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-gray-500 text-sm mr-2">
              Last updated: {formatDate(lastUpdated)}
            </span>
            <button 
              className="text-blue-600 hover:text-blue-800"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="p-3 font-medium" style={{ width: '10%' }}>Account Code</th>
                    <th className="p-3 font-medium" style={{ width: '40%' }}>Account Name</th>
                    <th className="p-3 font-medium" style={{ width: '15%' }}>Type</th>
                    <th className="p-3 font-medium text-right" style={{ width: '17.5%' }}>Debit</th>
                    <th className="p-3 font-medium text-right" style={{ width: '17.5%' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length > 0 ? (
                    filteredAccounts.map((account, index) => (
                      <tr key={`${account.code}-${account.id || index}`} className="border-t border-gray-200 hover:bg-gray-50">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Summary by Account Type</h2>
            <Link href="/chart-of-accounts" className="text-blue-600 text-sm">
              View Chart of Accounts
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3 font-medium">Account Type</th>
                  <th className="p-3 font-medium text-right">Debit</th>
                  <th className="p-3 font-medium text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(accountsByType).map(([type, typedAccounts]) => {
                  if (typedAccounts.length === 0) return null;
                  
                  const typeDebits = typedAccounts.reduce((total, account) => total + (account.debit || 0), 0);
                  const typeCredits = typedAccounts.reduce((total, account) => total + (account.credit || 0), 0);
                  
                  return (
                    <tr key={type} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="p-3">{type}</td>
                      <td className="p-3 text-right">
                        {formatCurrency(typeDebits)}
                      </td>
                      <td className="p-3 text-right">
                        {formatCurrency(typeCredits)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4">Actions</h2>
          <div className="space-y-4">
          {pagePermissions.canCreateJournal &&(<Link href="/journal-entries/new" >
              <button style={{marginBottom: "20px"}} className="w-full p-3 border border-gray-200 rounded hover:bg-gray-50 text-left flex items-center">
                <FileText size={18} className="mr-2 text-blue-600" />
                <div>
                  <div className="font-medium">Create Journal Entry</div>
                  <div className="text-sm text-gray-500">Add a new journal entry to adjust accounts</div>
                </div>
              </button>
            </Link>)}
            
            {pagePermissions.canExportReports &&( <Link href="/reports/financial-statements">
              <button style={{marginBottom: "20px"}} className="w-full p-3 border border-gray-200 rounded hover:bg-gray-50 text-left flex items-center">
                <FileText size={18} className="mr-2 text-green-600" />
                <div>
                  <div className="font-medium">Financial Statements</div>
                  <div className="text-sm text-gray-500">Generate income statement and balance sheet</div>
                </div>
              </button>
            </Link>)}
            
            <Link href="/account-reconciliation">
              <button className="w-full p-3 border border-gray-200 rounded hover:bg-gray-50 text-left flex items-center">
                <FileText size={18} className="mr-2 text-purple-600" />
                <div>
                  <div className="font-medium">Reconcile Accounts</div>
                  <div className="text-sm text-gray-500">Match transactions with bank statements</div>
                </div>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Hidden print iframe - only used when printing */}
      <iframe 
        ref={printFrameRef}
        style={{ display: 'none' }} 
        title="Print Frame"
      />
    </div>
    </PermissionGuard>
  );
};

export default TrialBalance;