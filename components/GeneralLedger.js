"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  Download, 
  FileText, 
  Filter, 
  Plus, 
  Search, 
  SlidersHorizontal,
  Eye
} from "lucide-react";
import Link from "next/link";
import { calculateDateRange } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";
import { getPermission } from "@/lib/permissions";

const GeneralLedger = () => {
  // Helper function to format dates safely
  const formatDateString = (dateString) => {
    if (!dateString) return "";
    try {
      // If it's already a string in YYYY-MM-DD format, return it
      if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      
      // Otherwise, try to convert it to a string
      return new Date(dateString).toISOString().split('T')[0];
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Invalid date";
    }
  };

  // State for filters and pagination
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [accountFilter, setAccountFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [referenceFilter, setReferenceFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all"); // "debit", "credit", "all"

  // State for data
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({
    totalTransactions: 0,
    totalDebits: 0,
    totalCredits: 0,
    totalPages: 1
  });

  // State for date range
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  });

  // State for custom date range
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [pagePermissions, setPagePermissions] = useState({
    canExportLedger:false,
    canCreateJournal:false
  });
 
  useEffect(() => {
    const fetchPermissions = async () => {   
      const canExportLedger= await getPermission("generalLedger.export");   
      const canCreateJournal = await getPermission("journalEntries.create")
      setPagePermissions({
        canExportLedger:canExportLedger,
        canCreateJournal:canCreateJournal
      });
    };
  
    fetchPermissions();
  }, []);
  // Update date range when timeframe changes
  useEffect(() => {
    if (timeframe !== "custom") {
      const range = calculateDateRange(timeframe);
      // Ensure we store dates as strings
      setDateRange({
        startDate: formatDateString(range.startDate),
        endDate: formatDateString(range.endDate)
      });
      // Reset custom date inputs when switching to predefined timeframe
      setShowCustomDateRange(false);
    } else {
      setShowCustomDateRange(true);
    }
  }, [timeframe]);

  // Apply custom date range
  const applyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      setDateRange({
        startDate: customStartDate, // These are already strings from the input
        endDate: customEndDate
      });
    }
  };

  // Fetch accounts for filtering
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch('/api/accounts');
        if (!response.ok) {
          throw new Error(`Error fetching accounts: ${response.statusText}`);
        }
        
        const data = await response.json();
        setAccounts(data.accounts || []);
      } catch (err) {
        console.error("Error fetching accounts:", err);
        // Use mock accounts if API fails
        setAccounts([
          { id: "acc1", code: "1000", name: "Cash" },
          { id: "acc2", code: "1100", name: "Accounts Receivable" },
          { id: "acc3", code: "2000", name: "Accounts Payable" },
          { id: "acc4", code: "4000", name: "Revenue" },
          { id: "acc5", code: "5000", name: "Office Expenses" },
          { id: "acc6", code: "5100", name: "Rent Expense" }
        ]);
      }
    };

    fetchAccounts();
  }, []);

  // Fetch transactions based on filters
  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const queryParams = new URLSearchParams({
          page,
          limit,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        });
        
        if (accountFilter !== "all") {
          queryParams.append("accountId", accountFilter);
        }
        
        if (searchTerm) {
          queryParams.append("search", searchTerm);
        }
        
        if (referenceFilter) {
          queryParams.append("reference", referenceFilter);
        }
        
        if (balanceFilter !== "all") {
          queryParams.append("balanceType", balanceFilter);
        }
        
        const response = await fetch(`/api/general-ledger?${queryParams}`);
        
        if (!response.ok) {
          throw new Error(`Error fetching transactions: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Handle API response
        if (data.transactions) {
          setTransactions(data.transactions);
          setSummary({
            totalTransactions: data.totalCount || data.transactions.length,
            totalDebits: data.totalDebits || data.transactions.reduce((sum, t) => sum + (t.debit || 0), 0),
            totalCredits: data.totalCredits || data.transactions.reduce((sum, t) => sum + (t.credit || 0), 0),
            totalPages: data.totalPages || Math.ceil(data.totalCount / limit) || 1
          });
        } else {
          throw new Error("Invalid data structure received from API");
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setError("Failed to load transactions. Please try again later.");
        
        // Use mock data if API fails for demo purposes
        const mockTransactions = generateMockTransactions();
        setTransactions(mockTransactions);
        setSummary({
          totalTransactions: mockTransactions.length,
          totalDebits: mockTransactions.reduce((sum, t) => sum + (t.debit || 0), 0),
          totalCredits: mockTransactions.reduce((sum, t) => sum + (t.credit || 0), 0),
          totalPages: 3
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only fetch if we have date range
    if (dateRange.startDate && dateRange.endDate) {
      fetchTransactions();
    }
  }, [dateRange, page, limit, accountFilter, searchTerm, referenceFilter, balanceFilter]);

  // Function to generate mock transactions for demo purposes
  const generateMockTransactions = () => {
    return [
      {
        id: "TR-001",
        date: "2025-03-05",
        description: "Office Supplies Purchase",
        reference: "INV-2354",
        accountId: "acc5",
        accountCode: "5000",
        accountName: "Office Expenses",
        debit: 250.00,
        credit: 0,
        balance: -250.00
      },
      {
        id: "TR-002",
        date: "2025-03-05", 
        description: "Office Supplies Purchase",
        reference: "INV-2354",
        accountId: "acc3",
        accountCode: "2000",
        accountName: "Accounts Payable",
        debit: 0,
        credit: 250.00,
        balance: 250.00
      },
      {
        id: "TR-003",
        date: "2025-03-06",
        description: "Client Payment",
        reference: "PMT-1087",
        accountId: "acc2",
        accountCode: "1100",
        accountName: "Accounts Receivable",
        debit: 0,
        credit: 1500.00,
        balance: -1500.00
      },
      {
        id: "TR-004",
        date: "2025-03-06",
        description: "Client Payment",
        reference: "PMT-1087",
        accountId: "acc4",
        accountCode: "4000",
        accountName: "Revenue",
        debit: 1500.00,
        credit: 0,
        balance: 1500.00
      },
      {
        id: "TR-005",
        date: "2025-03-07",
        description: "Rent Payment",
        reference: "CHK-456",
        accountId: "acc6",
        accountCode: "5100",
        accountName: "Rent Expense",
        debit: 800.00,
        credit: 0,
        balance: -800.00
      },
      {
        id: "TR-006",
        date: "2025-03-07",
        description: "Rent Payment",
        reference: "CHK-456",
        accountId: "acc1",
        accountCode: "1000",
        accountName: "Cash",
        debit: 0,
        credit: 800.00,
        balance: -800.00
      }
    ];
  };

  // Format date for display
  const formatDateDisplay = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error("Error formatting date for display:", error);
      return dateString; // Return the original string if parsing fails
    }
  };

  // Perform search as user types
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      // Reset to first page when search term changes
      if (page !== 1) setPage(1);
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchTerm]);

  // Handle search term change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Export function
  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        format: 'csv'
      });
      
      if (accountFilter !== "all") {
        queryParams.append("accountId", accountFilter);
      }
      
      if (searchTerm) {
        queryParams.append("search", searchTerm);
      }
      
      // Trigger file download
      window.location.href = `/api/general-ledger/export?${queryParams}`;
    } catch (err) {
      console.error("Error exporting data:", err);
      alert("Failed to export data. Please try again.");
    }
  };

  // Date range options for the filter dropdown
  const dateRangeOptions = [
    { value: "today", label: "Today" },
    { value: "thisWeek", label: "This Week" },
    { value: "thisMonth", label: "This Month" },
    { value: "lastMonth", label: "Last Month" },
    { value: "thisQuarter", label: "This Quarter" },
    { value: "thisYear", label: "This Year" },
    { value: "custom", label: "Custom Range" }
  ];

  // Pagination handlers
  const handleNextPage = () => {
    if (page < summary.totalPages) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= summary.totalPages) {
      setPage(pageNum);
    }
  };

  // Generate pagination buttons
  const renderPaginationButtons = () => {
    const buttons = [];
    const totalPages = summary.totalPages;
    
    // Always show first page
    buttons.push(
      <button 
        key="page-1"
        onClick={() => goToPage(1)}
        className={`px-3 py-1 ${page === 1 ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50'} rounded`}
      >
        1
      </button>
    );
    
    // Logic for ellipsis and neighboring pages
    if (totalPages > 1) {
      if (page > 3) {
        buttons.push(<span key="ellipsis-1">...</span>);
      }
      
      // Show current page and neighbors
      for (let i = Math.max(2, page - 1); i <= Math.min(page + 1, totalPages - 1); i++) {
        buttons.push(
          <button 
            key={`page-${i}`}
            onClick={() => goToPage(i)}
            className={`px-3 py-1 ${page === i ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50'} rounded`}
          >
            {i}
          </button>
        );
      }
      
      if (page < totalPages - 2) {
        buttons.push(<span key="ellipsis-2">...</span>);
      }
      
      // Always show last page if more than 1 page
      if (totalPages > 1) {
        buttons.push(
          <button 
            key={`page-${totalPages}`}
            onClick={() => goToPage(totalPages)}
            className={`px-3 py-1 ${page === totalPages ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50'} rounded`}
          >
            {totalPages}
          </button>
        );
      }
    }
    
    return buttons;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">General Ledger</h1>
        <div className="flex flex-wrap gap-2">
        {pagePermissions.canExportLedger &&( <button 
            onClick={handleExport}
            className="btn bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>)}
          {pagePermissions.canCreateJournal &&(   <Link href="/journal-entries/new">
            <button className="btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2">
              <Plus size={16} />
              New Entry
            </button>
          </Link>)}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by description, account, or reference..."
                className="border border-gray-300 pl-10 pr-4 py-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative">
              <select
                className="border border-gray-300 pl-10 pr-4 py-2 rounded appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              >
                {dateRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
            <div className="relative">
              <select
                className="border border-gray-300 pl-10 pr-8 py-2 rounded appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
              >
                <option value="all">All Accounts</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
              <FileText className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
            <button 
              className="border border-gray-300 px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-50"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <SlidersHorizontal size={16} />
              {showAdvancedFilters ? 'Hide Filters' : 'Advanced Filters'}
            </button>
          </div>
        </div>

        {/* Custom date range inputs */}
        {showCustomDateRange && (
          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
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

        {/* Advanced filters */}
        {showAdvancedFilters && (
          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                placeholder="Invoice or payment reference"
                value={referenceFilter}
                onChange={(e) => setReferenceFilter(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Balance Type</label>
              <select
                className="border border-gray-300 px-3 py-2 rounded w-full"
                value={balanceFilter}
                onChange={(e) => setBalanceFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Items Per Page</label>
              <select
                className="border border-gray-300 px-3 py-2 rounded w-full"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText size={48} className="mb-4 text-gray-400" />
            <p className="text-xl font-medium mb-2">No transactions found</p>
            <p>Try adjusting your filters or search criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Description</th>
                  <th className="p-3 font-medium">Reference</th>
                  <th className="p-3 font-medium">Account</th>
                  <th className="p-3 font-medium text-right">Debit</th>
                  <th className="p-3 font-medium text-right">Credit</th>
                  <th className="p-3 font-medium text-right">Balance</th>
                  <th className="p-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="p-3">{formatDateDisplay(transaction.date)}</td>
                    <td className="p-3">{transaction.description}</td>
                    <td className="p-3 text-blue-600">{transaction.reference}</td>
                    <td className="p-3">
                      <span className="font-medium">{transaction.accountCode}</span> - {transaction.accountName}
                    </td>
                    <td className="p-3 text-right">
                      {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {transaction.credit > 0 ? formatCurrency(transaction.credit) : '-'}
                    </td>
                    <td className={`p-3 text-right ${transaction.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(transaction.balance))}
                    </td>
                    <td className="p-3 text-center">
  <div className="flex justify-center space-x-2">
    {/* Make sure we're using the transactionId property, not id */}
    <Link href={`/journal-entries/${transaction.transactionId || transaction.id}`}>
      <button className="text-gray-500 hover:text-blue-600" title="View journal entry">
        <Eye size={18} />
      </button>
    </Link>
  </div>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && transactions.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500">
            <div className="mb-4 sm:mb-0">
              Showing {Math.min((page - 1) * limit + 1, summary.totalTransactions)} - {Math.min(page * limit, summary.totalTransactions)} of {summary.totalTransactions} transactions
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={handlePrevPage} 
                disabled={page === 1}
                className={`px-3 py-1 border border-gray-200 rounded ${page === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                Previous
              </button>
              
              <div className="flex items-center space-x-2">
                {renderPaginationButtons()}
              </div>
              
              <button 
                onClick={handleNextPage} 
                disabled={page >= summary.totalPages}
                className={`px-3 py-1 border border-gray-200 rounded ${page >= summary.totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4">Total Transactions</h2>
          <div className="flex justify-between items-center">
            <span className="text-3xl font-bold">{summary.totalTransactions}</span>
            <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full text-sm">
              Period: {formatDateDisplay(dateRange.startDate)} - {formatDateDisplay(dateRange.endDate)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4">Total Debits</h2>
          <div className="flex justify-between items-center">
            <span className="text-3xl font-bold">
              {formatCurrency(summary.totalDebits)}
            </span>
            <span className="text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full text-sm">
              {((summary.totalDebits / (summary.totalDebits + summary.totalCredits || 1)) * 100).toFixed(1)}% of volume
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4">Total Credits</h2>
          <div className="flex justify-between items-center">
            <span className="text-3xl font-bold">
              {formatCurrency(summary.totalCredits)}
            </span>
            <span className="text-blue-600 bg-blue-100 px-3 py-1 rounded-full text-sm">
              {((summary.totalCredits / (summary.totalDebits + summary.totalCredits || 1)) * 100).toFixed(1)}% of volume
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralLedger;