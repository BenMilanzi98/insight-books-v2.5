"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  Download, 
  FileText, 
  Plus, 
  Search, 
  SlidersHorizontal,
  Eye,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Hash
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [entryDetails, setEntryDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

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

  const openDetails = async (entry) => {
    setSelectedEntry(entry);
    setEntryDetails(null);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const params = new URLSearchParams({
        entryType: entry.entryType || "Transaction",
        entryId: entry.transactionId || entry.id
      });
      const response = await fetch(`/api/general-ledger/transaction?${params}`);
      if (!response.ok) {
        throw new Error("Failed to load ledger entry details");
      }
      const data = await response.json();
      setEntryDetails(data.entries?.[0] || null);
    } catch (error) {
      console.error("Error loading ledger entry details:", error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedEntry(null);
    setEntryDetails(null);
  };
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

    const btnClass = (active) =>
      cn(
        "min-w-[2.25rem] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      );

    buttons.push(
      <button
        key="page-1"
        type="button"
        onClick={() => goToPage(1)}
        className={btnClass(page === 1)}
      >
        1
      </button>
    );

    if (totalPages > 1) {
      if (page > 3) {
        buttons.push(<span key="ellipsis-1" className="px-1 text-slate-400">…</span>);
      }

      for (let i = Math.max(2, page - 1); i <= Math.min(page + 1, totalPages - 1); i++) {
        buttons.push(
          <button
            key={`page-${i}`}
            type="button"
            onClick={() => goToPage(i)}
            className={btnClass(page === i)}
          >
            {i}
          </button>
        );
      }

      if (page < totalPages - 2) {
        buttons.push(<span key="ellipsis-2" className="px-1 text-slate-400">…</span>);
      }

      if (totalPages > 1) {
        buttons.push(
          <button
            key={`page-${totalPages}`}
            type="button"
            onClick={() => goToPage(totalPages)}
            className={btnClass(page === totalPages)}
          >
            {totalPages}
          </button>
        );
      }
    }

    return buttons;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 shadow-xl shadow-indigo-200/50 p-6 sm:p-8 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">General Ledger</h1>
                <p className="text-indigo-100 text-sm sm:text-base mt-0.5">View and filter journal entries</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {pagePermissions.canExportLedger && (
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium transition-all shadow-sm border border-white/20"
                >
                  <Download size={18} />
                  Export
                </button>
              )}
              {pagePermissions.canCreateJournal && (
                <Link href="/journal-entries/new">
                  <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 font-semibold transition-all shadow-lg">
                    <Plus size={18} />
                    New Entry
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-6 flex justify-between items-center shadow-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-red-600 hover:text-red-800">×</button>
          </div>
        )}

        {/* Summary cards - above filters on mobile for quick glance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Transactions</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{summary.totalTransactions}</p>
                <p className="text-xs text-slate-400 mt-2">{formatDateDisplay(dateRange.startDate)} – {formatDateDisplay(dateRange.endDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-100">
                <Hash className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Debits</p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1">{formatCurrency(summary.totalDebits)}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {((summary.totalDebits / (summary.totalDebits + summary.totalCredits || 1)) * 100).toFixed(1)}% of volume
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-100">
                <TrendingDown className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Credits</p>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">{formatCurrency(summary.totalCredits)}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {((summary.totalCredits / (summary.totalDebits + summary.totalCredits || 1)) * 100).toFixed(1)}% of volume
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters card */}
        <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-4 sm:p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by description, account, or reference..."
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 focus:bg-white transition-all"
                  )}
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[140px]">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <select
                  className="w-full sm:w-auto pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 appearance-none cursor-pointer"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                >
                  {dateRangeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1 sm:flex-initial min-w-[160px]">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <select
                  className="w-full sm:w-auto pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 appearance-none cursor-pointer"
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
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
                  showAdvancedFilters
                    ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/80"
                )}
              >
                <SlidersHorizontal size={18} />
                {showAdvancedFilters ? "Hide filters" : "More filters"}
              </button>
            </div>
          </div>

          {showCustomDateRange && (
            <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">End date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={applyCustomDateRange}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {showAdvancedFilters && (
            <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
                <input
                  type="text"
                  placeholder="Invoice or payment reference"
                  value={referenceFilter}
                  onChange={(e) => setReferenceFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Balance type</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/50"
                  value={balanceFilter}
                  onChange={(e) => setBalanceFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Per page</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/50"
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
        </div>

        {/* Table card */}
        <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
              <p className="text-slate-500 font-medium">Loading ledger...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="p-4 rounded-2xl bg-slate-100 mb-4">
                <FileText className="w-12 h-12 text-slate-400" />
              </div>
              <p className="text-lg font-semibold text-slate-700 mb-1">No transactions found</p>
              <p className="text-slate-500 text-sm text-center">Try adjusting filters or date range</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200">
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Reference</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Account</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold text-amber-600 uppercase tracking-wider">Debit</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider">Credit</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Balance</th>
                      <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((transaction, idx) => (
                      <tr
                        key={transaction.id}
                        className={cn(
                          "hover:bg-indigo-50/50 transition-colors",
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                        )}
                      >
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDateDisplay(transaction.date)}</td>
                        <td className="px-4 py-3 text-slate-800 max-w-[200px] truncate" title={transaction.description}>{transaction.description}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-indigo-600">{transaction.reference}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <span className="font-semibold text-slate-800">{transaction.accountCode}</span>
                          <span className="text-slate-500"> – {transaction.accountName}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-amber-700">
                          {transaction.debit > 0 ? formatCurrency(transaction.debit) : "–"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">
                          {transaction.credit > 0 ? formatCurrency(transaction.credit) : "–"}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right font-medium",
                          transaction.balance < 0 ? "text-rose-600" : "text-emerald-600"
                        )}>
                          {formatCurrency(Math.abs(transaction.balance))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="View details"
                            onClick={() => openDetails(transaction)}
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isLoading && transactions.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4 py-4 bg-slate-50/80 border-t border-slate-200">
                  <p className="text-sm text-slate-600 order-2 sm:order-1">
                    Showing {Math.min((page - 1) * limit + 1, summary.totalTransactions)}–{Math.min(page * limit, summary.totalTransactions)} of {summary.totalTransactions}
                  </p>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <button
                      type="button"
                      onClick={handlePrevPage}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div className="flex items-center gap-1">
                      {renderPaginationButtons()}
                    </div>
                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={page >= summary.totalPages}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Entry details modal */}
      {detailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <h2 className="text-lg font-semibold text-slate-800">Ledger entry details</h2>
              <button
                type="button"
                onClick={closeDetails}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {detailsLoading && (
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  Loading details...
                </div>
              )}
              {!detailsLoading && entryDetails && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {[
                      { label: "Entry type", value: entryDetails.entryType },
                      { label: "Entry ID", value: entryDetails.entryId },
                      { label: "Source type", value: entryDetails.sourceType || "N/A" },
                      { label: "Source ID", value: entryDetails.sourceId || "N/A" },
                      { label: "Reference", value: entryDetails.reference || "N/A" },
                      { label: "Date", value: formatDateDisplay(entryDetails.date) },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
                        <p className="font-medium text-slate-800 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Lines</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Account</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-amber-600">Debit</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-emerald-600">Credit</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entryDetails.lines?.map((line) => (
                            <tr key={line.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5">
                                <span className="font-medium text-slate-800">{line.accountCode}</span>
                                <span className="text-slate-500"> – {line.accountName}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-amber-700">{line.debit ? formatCurrency(line.debit) : "–"}</td>
                              <td className="px-4 py-2.5 text-right text-emerald-700">{line.credit ? formatCurrency(line.credit) : "–"}</td>
                              <td className="px-4 py-2.5 text-slate-600">{line.description || "–"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
              {!detailsLoading && !entryDetails && (
                <p className="text-sm text-rose-600">No details available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralLedger;