"use client";
import { useState, useEffect } from "react";
import {
  Calendar,
  Download,
  Edit,
  Filter,
  Plus,
  Search,
  Trash,
  X,
  Check,
  AlertCircle,
  Eye,
  FileText
} from "lucide-react";
import { formatCurrency } from '@/lib/currencyUtils';
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import {
  filterCoaAccountsForPostingPicker,
  journalAccountOptionLabel,
  sortAccountsForJournalSelect,
} from "@/lib/journalAccountSelect";
import { coerceJournalAmount } from "@/lib/journalEntryFormatter";

const JournalEntries = () => {
  // State variables
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewEntry, setViewEntry] = useState(null);
  const [editId, setEditId] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(50);
  
  // Filters
  const [dateRange, setDateRange] = useState("This Year");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("Manual");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("success");
  const [roleDenied, setRoleDenied] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  
  // Form data
  const [entryFormData, setEntryFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    entryType: "Correction",
    description: "",
    internalReference: "",
    lines: [
      { accountId: "", description: "", debit: "", credit: "" },
      { accountId: "", description: "", debit: "", credit: "" }
    ]
  });
  
  // Accounts state
  const [accounts, setAccounts] = useState([]);
  
  // Fetch accounts when component mounts
  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkRole = async () => {
      try {
        const ok = await getPermission("journalEntries.view");
        if (!mounted) return;
        setRoleDenied(!ok);
      } catch (err) {
        if (!mounted) return;
        setRoleDenied(true);
      } finally {
        if (mounted) setAccessChecked(true);
      }
    };
    checkRole();
    return () => {
      mounted = false;
    };
  }, []);
  
  // Fetch journal entries when filters change
  useEffect(() => {
    fetchJournalEntries();
  }, [page, limit, dateRange, statusFilter, sourceTypeFilter, searchTerm]);
  
  // Calculate date range based on selected option
  const getDateRangeParams = () => {
    const now = new Date();
    let startDate, endDate;
    
    switch (dateRange) {
      case "Today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
      case "This Week": {
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        startDate = weekStart.toISOString().split('T')[0];
        endDate = weekEnd.toISOString().split('T')[0];
        break;
      }
      case "This Month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case "Last Month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      case "This Quarter": {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0).toISOString().split('T')[0];
        break;
      }
      case "This Year":
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }
    
    return { startDate, endDate };
  };
  
  // Fetch all active accounts (full chart of accounts) for modal dropdown
  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/chart-of-accounts/picker');
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }
      
      const data = await response.json();
      const list = filterCoaAccountsForPostingPicker(data.accounts || []);
      setAccounts(sortAccountsForJournalSelect(list));
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setError("Failed to load accounts. Please try again later.");
      
      // Use mock accounts for demo purposes if API fails
      setAccounts([
        { id: "acc1", code: "1000", name: "Cash", type: "ASSET" },
        { id: "acc2", code: "1100", name: "Accounts Receivable", type: "ASSET" },
        { id: "acc3", code: "2000", name: "Accounts Payable", type: "LIABILITY" },
        { id: "acc4", code: "4000", name: "Revenue", type: "REVENUE" },
        { id: "acc5", code: "5000", name: "Office Expenses", type: "EXPENSE" },
        { id: "acc6", code: "5100", name: "Rent Expense", type: "EXPENSE" },
        { id: "acc7", code: "5200", name: "Utilities Expense", type: "EXPENSE" },
        { id: "acc8", code: "5200", name: "Salaries & Wages", type: "EXPENSE" }
      ]);
    }
  };
  
  // Fetch journal entries from API
  const fetchJournalEntries = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { startDate, endDate } = getDateRangeParams();
      
      const params = new URLSearchParams({
        page,
        limit,
        sortBy: 'entryDate',
        sortOrder: 'desc'
      });
      
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== "All Status") {
        params.append('status', statusFilter.toLowerCase());
      }
      if (sourceTypeFilter !== "All Types") {
        params.append('sourceType', sourceTypeFilter);
      }
      
      const response = await fetch(`/api/journal-entries?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch journal entries: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log('📥 Received journal entries:', data.entries?.length || 0);
      console.log('📊 Breakdown:', {
        sales: data.entries?.filter(e => e.sourceType === 'Sale').length || 0,
        expenses: data.entries?.filter(e => e.sourceType === 'Expense').length || 0,
        total: data.entries?.length || 0,
      });
      
      setEntries(data.entries || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || (data.entries || []).length);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      setError("Failed to load journal entries. Please try again later.");
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page when search changes
  };
  
  // Handle date range change
  const handleDateRangeChange = (e) => {
    setDateRange(e.target.value);
    setPage(1); // Reset to first page when date range changes
  };
  
  // Handle status filter change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1); // Reset to first page when status filter changes
  };
  
  // Handle source type filter change
  const handleSourceTypeFilterChange = (e) => {
    setSourceTypeFilter(e.target.value);
    setPage(1); // Reset to first page when source type filter changes
  };
  
  // Handle pagination
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };
  
  // Add line to journal entry form
  const handleAddLine = () => {
    setEntryFormData({
      ...entryFormData,
      lines: [
        ...entryFormData.lines,
        { accountId: "", description: "", debit: "", credit: "" }
      ]
    });
  };
  
  // Remove line from journal entry form
  const handleRemoveLine = (index) => {
    const newLines = [...entryFormData.lines];
    newLines.splice(index, 1);
    setEntryFormData({
      ...entryFormData,
      lines: newLines
    });
  };
  
  // Handle change in form line inputs
  const handleLineChange = (index, field, value) => {
    const newLines = [...entryFormData.lines];
    newLines[index][field] = value;
    
    // If debit is entered, clear credit and vice versa
    if (field === 'debit' && value) {
      newLines[index]['credit'] = '';
    } else if (field === 'credit' && value) {
      newLines[index]['debit'] = '';
    }
    
    setEntryFormData({
      ...entryFormData,
      lines: newLines
    });
  };
  
  // Submit journal entry form
  const handleSubmit = async (e, postStatus = "draft") => {
    e.preventDefault();
    if (isSubmitting) return;
    
    try {
      // Validate that the entry is balanced
      if (!isBalanced) {
        setAlertMessage("Journal entry must be balanced (debits must equal credits)");
        setAlertType("error");
        setShowAlert(true);
        return;
      }

      if (postStatus === "posted") {
        const confirmed = window.confirm(
          "Posting will permanently lock this entry and update ledger balances. Continue?"
        );
        if (!confirmed) {
          return;
        }
      }

      setIsSubmitting(true);
      
      // Prepare journal entry data
      const entryData = {
        date: entryFormData.date,
        description: entryFormData.description,
        entryType: entryFormData.entryType,
        internalReference: entryFormData.internalReference,
        status: postStatus,
        lines: entryFormData.lines.map(line => ({
          accountId: line.accountId,
          description: line.description || entryFormData.description,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0
        }))
      };
      
      // Make API call to create journal entry
      const response = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entryData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.details && Array.isArray(errorData.details)
          ? `${errorData.error}: ${errorData.details.join(', ')}`
          : errorData.error || "Failed to create journal entry";
        throw new Error(errorMessage);
      }
      
      // Show success message
      setAlertMessage(`Journal entry successfully ${postStatus === 'posted' ? 'posted' : 'saved as draft'}`);
      setAlertType("success");
      setShowAlert(true);
      
      // Close modal and refresh entries
      setShowEntryModal(false);
      fetchJournalEntries();
      
      // Reset form
      resetForm();
    } catch (error) {
      console.error("Error creating journal entry:", error);
      setAlertMessage(error.message || "Failed to create journal entry");
      setAlertType("error");
      setShowAlert(true);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Reset form to initial state
  const resetForm = () => {
    setEntryFormData({
      date: new Date().toISOString().split('T')[0],
      entryType: "Correction",
      description: "",
      internalReference: "",
      lines: [
        { accountId: "", description: "", debit: "", credit: "" },
        { accountId: "", description: "", debit: "", credit: "" }
      ]
    });
    setEditId(null);
  };
  
  // View journal entry details
  const handleViewEntry = (entry) => {
    setViewEntry(entry);
    setShowViewModal(true);
  };
  
  // Edit journal entry
  const handleEditEntry = (entry) => {
    if (entry.status === "Posted" || entry.status === "posted") {
      setAlertMessage("Posted journal entries are read-only. Use a reversal instead.");
      setAlertType("error");
      setShowAlert(true);
      return;
    }
    // Transform entry data to form data format
    const formData = {
      date: new Date(entry.date).toISOString().split('T')[0],
      entryType: entry.entryType || "Correction",
      description: entry.description || "",
      internalReference: entry.notes || "",
      lines: entry.lines.map(line => ({
        accountId: line.accountId,
        description: line.description || "",
        debit: (() => {
          const v = coerceJournalAmount(line.debit ?? line.debitAmount);
          return Math.abs(v) > 1e-9 ? String(v) : "";
        })(),
        credit: (() => {
          const v = coerceJournalAmount(line.credit ?? line.creditAmount);
          return Math.abs(v) > 1e-9 ? String(v) : "";
        })()
      }))
    };
    
    setEntryFormData(formData);
    setEditId(entry.id);
    setShowEntryModal(true);
  };

  const handlePostEntry = async (entry) => {
    if (!entry?.id || isSubmitting) return;
    const confirmed = window.confirm(
      "Posting will permanently lock this entry and update ledger balances. Continue?"
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/journal-entries/${entry.id}?action=post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to post journal entry");
      }
      setAlertMessage("Journal entry posted successfully");
      setAlertType("success");
      setShowAlert(true);
      fetchJournalEntries();
    } catch (error) {
      console.error("Error posting journal entry:", error);
      setAlertMessage(error.message || "Failed to post journal entry");
      setAlertType("error");
      setShowAlert(true);
    } finally {
      setIsSubmitting(false);
    }
  };
  
// Handle delete journal entry
const handleDeleteEntry = async (entryId) => {
  console.log("Attempting to delete entry:", entryId);
  
  // Check if entryId is directly a string (ID) or an object with id property
  const id = typeof entryId === 'object' ? entryId.id : entryId;
  
  // Make sure there's a valid ID
  if (!id) {
    console.error("Cannot delete entry: Missing ID", entryId);
    setAlertMessage("Cannot delete entry - missing ID");
    setAlertType("error");
    setShowAlert(true);
    return;
  }

  if (!confirm("Are you sure you want to delete this journal entry? This action cannot be undone.")) {
    return;
  }
  
  try {
    console.log("Deleting entry with ID:", id);
    
    const response = await fetch(`/api/journal-entries/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Delete error response:", errorData);
      throw new Error(errorData.error || "Failed to delete journal entry");
    }
    
    // Show success message
    setAlertMessage("Journal entry successfully deleted");
    setAlertType("success");
    setShowAlert(true);
    
    // Refresh entries
    fetchJournalEntries();
  } catch (error) {
    console.error("Error deleting journal entry:", error);
    setAlertMessage(error.message || "Failed to delete journal entry");
    setAlertType("error");
    setShowAlert(true);
  }
};
  // Export journal entries
  const handleExport = async (format = 'csv') => {
    try {
      const { startDate, endDate } = getDateRangeParams();
      
      // Build query params
      const params = new URLSearchParams({
        startDate,
        endDate,
        format
      });
      
      // Add search term if provided
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Add status filter if not "All Status"
      if (statusFilter !== "All Status") {
        params.append('status', statusFilter.toLowerCase());
      }
      
      // Add source type filter if not "All Types"
      if (sourceTypeFilter !== "All Types") {
        params.append('sourceType', sourceTypeFilter);
      }
      
      const response = await fetch(`/api/journal-entries/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to export journal entries: ${response.statusText}`);
      }
      
      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `journal-entries-${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show success message
      setAlertMessage(`Journal entries successfully exported as ${format.toUpperCase()}`);
      setAlertType("success");
      setShowAlert(true);
    } catch (error) {
      console.error("Error exporting journal entries:", error);
      setAlertMessage(error.message || "Failed to export journal entries");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Calculate totals for journal entry form
  const calculateTotals = () => {
    let totalDebit = 0;
    let totalCredit = 0;
    
    entryFormData.lines.forEach(line => {
      totalDebit += coerceJournalAmount(line.debit ?? line.debitAmount);
      totalCredit += coerceJournalAmount(line.credit ?? line.creditAmount);
    });
    
    return { totalDebit, totalCredit };
  };
  
  const { totalDebit, totalCredit } = calculateTotals();
  const isBalanced = totalDebit.toFixed(2) === totalCredit.toFixed(2);
  const [pagePermissions, setPagePermissions] = useState({
    canExportJournal:false,
    canCreateJournal:false,
    canDeleteJournal:false,
    canUpdateJournal:false,
    canPostJournal:false 
  });
 
  useEffect(() => {
    const fetchPermissions = async () => {   
      const canExportJournal= await getPermission("journalEntries.export");   
      const canCreateJournal = await getPermission("journalEntries.create")
      const canDeleteJournal= await getPermission("journalEntries.delete");   
      const canUpdateJournal = await getPermission("journalEntries.update")
      const canPostJournal= await getPermission("journalEntries.post");    
      setPagePermissions({
        canExportJournal:canExportJournal,
        canCreateJournal:canCreateJournal,
        canDeleteJournal:canDeleteJournal,
        canUpdateJournal:canUpdateJournal,
        canPostJournal:canPostJournal
      });
    };
  
    fetchPermissions();
  }, []);
  // Status options for the filter dropdown
  const statusOptions = ["All Status", "Posted", "Draft"];
  
  // Source type options for the filter dropdown
  const sourceTypeOptions = ["Manual"];

  const entryTypeOptions = ["Correction", "Accrual", "Opening Balance"];
  
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
  
  if (!accessChecked) {
    return null;
  }

  return (
    <PermissionGuard permission="journalEntries.view">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-12">
          {roleDenied && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 sm:p-8 text-center shadow-sm">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-rose-800 mb-2">Access Denied</h3>
              <p className="text-rose-600">You need journal entry access to use this page.</p>
            </div>
          )}
          {!roleDenied && (
            <>
              {showAlert && (
                <div className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg z-50 flex items-center gap-3 ${
                  alertType === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"
                }`}>
                  {alertType === "success" ? <Check className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                  <span>{alertMessage}</span>
                  <button type="button" className="ml-2 p-1 rounded-lg hover:bg-black/10" onClick={() => setShowAlert(false)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 shadow-xl shadow-indigo-200/50 p-6 sm:p-8 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                      <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Journal Entries</h1>
                      <p className="text-indigo-100 text-sm mt-0.5">View and manage general ledger entries</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pagePermissions.canCreateJournal && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 font-semibold transition-all shadow-lg"
                        onClick={() => { resetForm(); setShowEntryModal(true); }}
                      >
                        <Plus size={18} />
                        New Entry
                      </button>
                    )}
                    {pagePermissions.canExportJournal && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium transition-all border border-white/20"
                        onClick={() => handleExport('csv')}
                      >
                        <Download size={18} />
                        Export
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-4 sm:p-6 mb-6">
                <div className="flex flex-col lg:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search journal entries..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 focus:bg-white"
                        value={searchTerm}
                        onChange={handleSearchChange}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative min-w-[140px]">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                      <select
                        className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
                        value={dateRange}
                        onChange={handleDateRangeChange}
                      >
                        {dateRangeOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative min-w-[120px]">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                      <select
                        className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
                        value={statusFilter}
                        onChange={handleStatusFilterChange}
                      >
                        {statusOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative min-w-[120px]">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                      <select
                        className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
                        value={sourceTypeFilter}
                        onChange={handleSourceTypeFilterChange}
                      >
                        {sourceTypeOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">Loading entries...</p>
                  </div>
                ) : error ? (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 p-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                ) : entries.length === 0 ? (
                  <div className="text-center py-16">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">No journal entries found</p>
                    <p className="text-slate-500 text-sm mt-1">Create your first entry or adjust filters</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200">
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Entry #</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Reference</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Source Type</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Account</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Line Description</th>
                          <th className="px-4 py-3.5 text-right text-xs font-semibold text-amber-600 uppercase tracking-wider">Debit</th>
                          <th className="px-4 py-3.5 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider">Credit</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
              <tbody>
                {entries.filter(entry => entry && entry.id).map((entry) => {
                  const sourceType = entry.sourceType || 'Manual';
                  const sourceTypeColors = {
                    'Sale': 'bg-blue-100 text-blue-800',
                    'Expense': 'bg-red-100 text-red-800',
                    'Invoice': 'bg-purple-100 text-purple-800',
                    'InvoicePayment': 'bg-green-100 text-green-800',
                    'LiabilityPayment': 'bg-orange-100 text-orange-800',
                    'SupplierPayment': 'bg-yellow-100 text-yellow-800',
                    'Asset': 'bg-indigo-100 text-indigo-800',
                    'Payroll': 'bg-cyan-100 text-cyan-800',
                    'Transaction': 'bg-slate-100 text-slate-800',
                    'Manual': 'bg-gray-100 text-gray-800',
                  };
                  const sourceTypeColor = sourceTypeColors[sourceType] || 'bg-gray-100 text-gray-800';
                  const lines = entry.lines && entry.lines.length > 0 ? entry.lines : [{
                    account: { accountCode: '—', accountName: 'No lines recorded' },
                    debit: 0,
                    credit: 0
                  }];
                  const rowSpan = lines.length || 1;

                  return lines.map((line, index) => {
                    const debitValue = coerceJournalAmount(line.debit ?? line.debitAmount);
                    const creditValue = coerceJournalAmount(line.credit ?? line.creditAmount);
                    const accountCode = line.account?.accountCode || line.account?.code || line.accountCode || '—';
                    const accountName = line.account?.accountName || line.account?.name || line.accountName || 'Unnamed Account';

                    return (
                      <tr key={`${entry.id}-${line.id || index}`} className="border-t border-slate-100 hover:bg-indigo-50/30 transition-colors">
                        {index === 0 && (
                          <>
                            <td className="p-3 text-blue-600" rowSpan={rowSpan}>{entry.referenceNumber || '—'}</td>
                            <td className="p-3" rowSpan={rowSpan}>{entry.date ? (() => {
                              const date = new Date(entry.date);
                              const day = String(date.getDate()).padStart(2, '0');
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const year = date.getFullYear();
                              return `${day}-${month}-${year}`;
                            })() : 'N/A'}</td>
                            <td className="p-3" rowSpan={rowSpan}>{entry.referenceNumber || '-'}</td>
                            <td className="p-3" rowSpan={rowSpan}>
                              <span className={`px-2 py-1 rounded-full text-xs ${sourceTypeColor}`}>
                                {sourceType}
                              </span>
                            </td>
                            <td className="p-3" rowSpan={rowSpan}>{entry.description || 'N/A'}</td>
                          </>
                        )}
                        <td className="p-3">
                          <div className="text-gray-900 text-sm">
                            {accountCode} &mdash; {accountName}
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {line.description || entry.description || '—'}
                        </td>
                        <td className="p-3 text-right font-medium text-amber-700">
                          {Math.abs(debitValue) > 1e-9 ? formatCurrency(debitValue) : '—'}
                        </td>
                        <td className="p-3 text-right font-medium text-emerald-700">
                          {Math.abs(creditValue) > 1e-9 ? formatCurrency(creditValue) : '—'}
                        </td>
                        {index === 0 && (
                          <>
                            <td className="p-3" rowSpan={rowSpan}>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                entry.isReversal
                                  ? "bg-red-100 text-red-800"
                                  : entry.reversedAt
                                    ? "bg-slate-200 text-slate-700"
                                    : entry.status === "Posted" || entry.status === "posted"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-yellow-100 text-yellow-800"
                              }`}>
                                {entry.isReversal ? 'Reversal' : entry.reversedAt ? 'Reversed' : (entry.status || 'Draft')}
                              </span>
                              {entry.reversalReason && (
                                <div className="mt-1 text-xs text-slate-500 max-w-[180px] truncate" title={entry.reversalReason}>
                                  {entry.reversalReason}
                                </div>
                              )}
                            </td>
                            <td className="p-3" rowSpan={rowSpan}>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="text-blue-600 hover:text-blue-800"
                                  onClick={() => handleViewEntry(entry)}
                                  title="View"
                                >
                                  <Eye size={16} />
                                </button>
                                {pagePermissions.canUpdateJournal && !(entry.status === "Posted" || entry.status === "posted") && (
                                  <button
                                    type="button"
                                    className="text-blue-600 hover:text-blue-800"
                                    onClick={() => handleEditEntry(entry)}
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                )}
                                {pagePermissions.canPostJournal && !(entry.status === "Posted" || entry.status === "posted") && (
                                  <button
                                    type="button"
                                    className="text-green-600 hover:text-green-800"
                                    onClick={() => handlePostEntry(entry)}
                                    title="Post"
                                  >
                                    <Check size={16} />
                                  </button>
                                )}
                                {pagePermissions.canDeleteJournal && !(entry.status === "Posted" || entry.status === "posted") && (
                                  <button
                                    type="button"
                                    className="text-red-600 hover:text-red-800"
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    title="Delete"
                                  >
                                    <Trash size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  });
                }).flat()}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && entries.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 px-4 py-4 bg-slate-50/80 border-t border-slate-200 rounded-b-xl text-sm text-slate-600">
            <div>Showing {entries.length} of {totalCount} entries</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
                const pageNumber = page > 2 ? page - 2 + index : index + 1;
                if (pageNumber <= totalPages) {
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      className={`min-w-[2.25rem] px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        pageNumber === page
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'border border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                      onClick={() => handlePageChange(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                }
                return null;
              })}
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Journal Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <h2 className="text-xl font-semibold text-slate-800">{editId ? 'Edit Journal Entry' : 'New Journal Entry'}</h2>
              <button
                type="button"
                onClick={() => { setShowEntryModal(false); resetForm(); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => handleSubmit(e, 'draft')}>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-200 rounded"
                      value={entryFormData.date}
                      onChange={(e) => setEntryFormData({...entryFormData, date: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Entry Type</label>
                    <select
                      className="w-full p-2 border border-gray-200 rounded"
                      value={entryFormData.entryType}
                      onChange={(e) => setEntryFormData({...entryFormData, entryType: e.target.value})}
                      required
                    >
                      {entryTypeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-200 rounded"
                    placeholder="Purpose of this journal entry"
                    value={entryFormData.description}
                    onChange={(e) => setEntryFormData({...entryFormData, description: e.target.value})}
                    required
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium mb-1">Internal Reference / Tag (optional)</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-200 rounded"
                    placeholder="Internal reference or tag"
                    value={entryFormData.internalReference}
                    onChange={(e) => setEntryFormData({...entryFormData, internalReference: e.target.value})}
                  />
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold">Entry Lines</h3>
                    <button
                      type="button"
                      className="text-blue-600 text-sm"
                      onClick={handleAddLine}
                    >
                      + Add Line
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="p-2 font-medium">Account</th>
                          <th className="p-2 font-medium">Description</th>
                          <th className="p-2 font-medium text-right">Debit</th>
                          <th className="p-2 font-medium text-right">Credit</th>
                          <th className="p-2 font-medium w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {entryFormData.lines.map((line, index) => (
                          <tr key={index} className="border-t border-gray-200">
                            <td className="p-2">
                              <select
                                className="w-full p-2 border border-gray-200 rounded"
                                value={line.accountId}
                                onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                                required
                              >
                                <option value="">Select Account</option>
                                {accounts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {journalAccountOptionLabel(account)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                className="w-full p-2 border border-gray-200 rounded"
                                placeholder="Line description"
                                value={line.description}
                                onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                className="w-full p-2 border border-gray-200 rounded text-right"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                value={line.debit}
                                onChange={(e) => handleLineChange(index, 'debit', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                className="w-full p-2 border border-gray-200 rounded text-right"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                value={line.credit}
                                onChange={(e) => handleLineChange(index, 'credit', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              {entryFormData.lines.length > 2 && (
                                <button
                                  type="button"
                                  className="text-red-600 hover:text-red-800"
                                  onClick={() => handleRemoveLine(index)}
                                >
                                  <Trash size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-gray-200 bg-gray-50 font-medium">
                          <td colSpan="2" className="p-2 text-right">Totals</td>
                          <td className="p-2 text-right">{formatCurrency(totalDebit)}</td>
                          <td className="p-2 text-right">{formatCurrency(totalCredit)}</td>
                          <td className="p-2"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className={`mt-4 p-3 rounded text-sm ${
                    isBalanced 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  }`}>
                    {isBalanced 
                      ? "✅ Journal entry is balanced (debits equals credits)"
                      : "❌ Journal entry is not balanced (debits must equal credits)"}
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-200 rounded"
                  onClick={() => {
                    setShowEntryModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                  disabled={!isBalanced || isSubmitting}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'posted')}
                  className="px-4 py-2 bg-green-600 text-white rounded"
                  disabled={!isBalanced || isSubmitting}
                >
                  Post Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Journal Entry Modal */}
      {showViewModal && viewEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Journal Entry Details</h2>
                <button 
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6">
              {(viewEntry.status === "Posted" || viewEntry.status === "posted") && (
                <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  Posted entries are read-only. Corrections must be made via reversal or a new adjusting entry.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Date</p>
                  <p className="font-medium">{(() => {
                    const date = new Date(viewEntry.date);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}-${month}-${year}`;
                  })()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Entry Type</p>
                  <p className="font-medium">{viewEntry.entryType || "Correction"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Description</p>
                  <p className="font-medium">{viewEntry.description}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Internal Reference / Tag</p>
                  <p className="font-medium">{viewEntry.notes || "—"}</p>
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3">Entry Lines</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="p-3 font-medium">Account</th>
                        <th className="p-3 font-medium">Description</th>
                        <th className="p-3 font-medium text-right">Debit</th>
                        <th className="p-3 font-medium text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewEntry.lines.map((line, index) => (
                        <tr key={index} className="border-t border-gray-200">
                          <td className="p-3">{line.accountCode} - {line.accountName}</td>
                          <td className="p-3">{line.description || viewEntry.description}</td>
                          <td className="p-3 text-right">{formatCurrency(coerceJournalAmount(line.debit ?? line.debitAmount))}</td>
                          <td className="p-3 text-right">{formatCurrency(coerceJournalAmount(line.credit ?? line.creditAmount))}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-200 bg-gray-50 font-medium">
                        <td colSpan="2" className="p-3 text-right">Totals</td>
                        <td className="p-3 text-right">
                          {formatCurrency(viewEntry.lines.reduce((sum, line) => sum + coerceJournalAmount(line.debit ?? line.debitAmount), 0))}
                        </td>
                        <td className="p-3 text-right">
                          {formatCurrency(viewEntry.lines.reduce((sum, line) => sum + coerceJournalAmount(line.credit ?? line.creditAmount), 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                type="button"
                className="px-4 py-2 border border-gray-200 rounded"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
        </div>
      </div>
    </PermissionGuard>
  );
};

export default JournalEntries;
