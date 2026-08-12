"use client";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import PageHeader from "@/components/shell/PageHeader";
import ClickableStatCard from "@/components/ui/ClickableStatCard";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Receipt,
  FileText,
  Edit,
  Trash2,
  ArrowUpDown,
  FilePlus,
  Camera,
  Upload,
  MoreHorizontal,
  CheckCircle,
  Clock,
  XCircle,
  BarChart,
  X,
  CreditCard,
  Image as ImageIcon,
  File,
  Paperclip,
  Eye,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  History,
  Package,
  TrendingUp,
  DollarSign,
  RotateCcw
} from "lucide-react";
import { 
  fetchExpenses, 
  createExpense, 
  updateExpense, 
  deleteExpense,
  deleteSalaryAdvance,
  updateSalaryAdvance,
  reversePostedGlTransaction,
  reverseSalePosting,
  uploadAttachment,
  deleteAttachment,
  getExpenseStatistics,
  createExpenseWithAttachments,
  exportExpenses,
  batchDeleteExpenses,
  fetchDeletedExpenses,
  restoreExpense
} from "@/app/services/expenseService";
import { 
  createRecurringExpense,
  fetchRecurringExpenses,
  fetchRecurringExpenseById,
  updateRecurringExpense,
  deleteRecurringExpense
} from "@/app/services/recurringExpenseService";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";

const scanReceipt = (...args) =>
  import("@/lib/receipt-scanner").then((m) => m.scanReceipt(...args));
const ExpensePartialPaymentModal = dynamic(() => import("@/components/ExpensePartialPaymentModal"), { ssr: false });
const ExpensePaymentHistory = dynamic(() => import("@/components/ExpensePaymentHistory"), { ssr: false });
const ExpenseModal = dynamic(() => import("@/components/Expenses/ExpenseModal"), { ssr: false });
const RecurringExpenseModal = dynamic(() => import("@/components/Expenses/RecurringExpenseModal"), { ssr: false });
const HistoricalExpenseUpload = dynamic(() => import("@/components/Expenses/HistoricalExpenseUpload"), { ssr: false });
const HistoricalExpenseModal = dynamic(() => import("@/components/Expenses/HistoricalExpenseModal"), { ssr: false });
const COGSManagement = dynamic(() => import("@/app/cogs/page"), { ssr: false });
const COGSSettlementModal = dynamic(() => import("@/components/COGSSettlementModal"), { ssr: false });
const COGSSummaryChart = dynamic(() => import("@/components/COGSSummaryChart"), { ssr: false });
const COGSExpensesTable = dynamic(() => import("@/components/COGSExpensesTable"), { ssr: false });
const ReversalStatusBadge = dynamic(
  () => import("@/components/TransactionReversal/ReversalStatusBadge").then((m) => m.ReversalStatusBadge),
  { ssr: false }
);

/** Matches server validation in transactionReversalService / expenses batch-delete. */
const MIN_EXPENSE_DELETE_REASON_LENGTH = 10;

const SALARY_ADVANCE_ID_PREFIX = 'salary-advance-';
const COGS_ROW_ID_PREFIX = 'cogs-';

function partitionExpenseListDeleteIds(ids) {
  const salaryAdvanceIds = [];
  const cogsIds = [];
  const expenseIds = [];
  for (const id of ids) {
    const s = id == null ? '' : String(id).trim();
    if (!s) continue;
    if (s.startsWith(SALARY_ADVANCE_ID_PREFIX)) {
      const raw = s.slice(SALARY_ADVANCE_ID_PREFIX.length);
      if (raw && raw !== 'receivable') salaryAdvanceIds.push(raw);
    } else if (s.startsWith(COGS_ROW_ID_PREFIX)) {
      cogsIds.push(s);
    } else {
      expenseIds.push(s);
    }
  }
  return { salaryAdvanceIds, cogsIds, expenseIds };
}

function isCogsListRow(expense) {
  if (!expense) return false;
  if (expense.isCOGS === true) return true;
  const id = expense.id;
  return typeof id === 'string' && id.startsWith(COGS_ROW_ID_PREFIX);
}

function collectLinkedSaleIdsFromCogsRowIds(rowIds, list) {
  const ids = new Set();
  for (const rid of rowIds) {
    const row = list.find((e) => e.id === rid);
    if (row?.linkedSaleId) ids.add(row.linkedSaleId);
  }
  return [...ids];
}

function collectUniqueCogsTransactionIds(rowIds, list) {
  const txn = new Set();
  for (const rid of rowIds) {
    const row = list.find((e) => e.id === rid);
    if (row?.isCOGS && row.transactionId) txn.add(row.transactionId);
  }
  return [...txn];
}

/** COGS rows that are not tied to a POS sale id (journal reversal only). */
function collectOrphanCogsTransactionIds(cogsRowIds, list) {
  const txn = new Set();
  for (const rid of cogsRowIds) {
    const row = list.find((e) => e.id === rid);
    if (row?.isCOGS && row.transactionId && !row.linkedSaleId) {
      txn.add(row.transactionId);
    }
  }
  return [...txn];
}

function getCogsDeleteContext(expenseToDelete, deleteType, list) {
  const empty = { hasCogs: false, cogsRowIds: [], hasAnyLinkedSale: false, linkedSaleCount: 0 };
  if (!expenseToDelete) return empty;

  if (deleteType === 'single') {
    const id = expenseToDelete;
    if (list?.length) {
      const row = list.find((e) => e.id === id);
      if (!row?.isCOGS) return empty;
      const linked = collectLinkedSaleIdsFromCogsRowIds([id], list);
      return {
        hasCogs: true,
        cogsRowIds: [id],
        hasAnyLinkedSale: linked.length > 0,
        linkedSaleCount: linked.length,
      };
    }
    const s = String(id);
    if (!s.startsWith(COGS_ROW_ID_PREFIX)) return empty;
    return {
      hasCogs: true,
      cogsRowIds: [s],
      hasAnyLinkedSale: false,
      linkedSaleCount: 0,
    };
  }

  const { cogsIds } = partitionExpenseListDeleteIds(expenseToDelete);
  if (cogsIds.length === 0) return empty;
  const linked = list?.length ? collectLinkedSaleIdsFromCogsRowIds(cogsIds, list) : [];
  return {
    hasCogs: true,
    cogsRowIds: cogsIds,
    hasAnyLinkedSale: linked.length > 0,
    linkedSaleCount: linked.length,
  };
}

function classifyExpenseRowDeleteId(expenseId) {
  const s = expenseId == null ? '' : String(expenseId).trim();
  if (!s) return { kind: 'invalid' };
  if (s.startsWith(SALARY_ADVANCE_ID_PREFIX)) {
    const raw = s.slice(SALARY_ADVANCE_ID_PREFIX.length);
    if (raw && raw !== 'receivable') return { kind: 'salaryAdvance', id: raw };
    return { kind: 'invalid' };
  }
  if (s.startsWith(COGS_ROW_ID_PREFIX)) return { kind: 'cogs' };
  return { kind: 'expense', id: s };
}

function isSalaryAdvanceDeleteBlockedByDeductions(message) {
  const m = (message || '').toLowerCase();
  return m.includes('deduction') || m.includes('cancelled instead');
}

/** Try hard-delete each advance; for blocked ones, optionally mark Cancelled (hidden from expenses list). */
async function deleteSalaryAdvancesWithOptionalCancel(advanceIds) {
  const blocked = [];
  let hardDeleted = 0;
  for (const advId of advanceIds) {
    try {
      await deleteSalaryAdvance(advId);
      hardDeleted += 1;
    } catch (e) {
      if (isSalaryAdvanceDeleteBlockedByDeductions(e?.message)) {
        blocked.push(advId);
      } else {
        throw e;
      }
    }
  }

  let cancelled = 0;
  if (blocked.length > 0) {
    const msg =
      blocked.length === 1
        ? 'This salary advance has payroll deductions and cannot be permanently deleted.\n\nMark it as Cancelled? It will disappear from this list but remain in HR → Advances for audit.'
        : `${blocked.length} salary advances have payroll deductions and cannot be permanently deleted.\n\nMark them as Cancelled? They will disappear from this list but remain in HR → Advances for audit.`;
    if (typeof window !== 'undefined' && !window.confirm(msg)) {
      throw new Error(
        blocked.length === 1
          ? 'Salary advance was not deleted or cancelled.'
          : 'Salary advances with deductions were not cancelled.'
      );
    }
    for (const id of blocked) {
      await updateSalaryAdvance(id, { status: 'Cancelled' });
      cancelled += 1;
    }
  }

  return { hardDeleted, cancelled };
}

const ExpensesPage = () => {
  const searchParams = useSearchParams();
  // State management
  const [mainTab, setMainTab] = useState("expenses"); // Main tab: "expenses" or "cogs"
  const [activeTab, setActiveTab] = useState("all");
  /** Card filter: null | 'partially' | 'pending' | 'fullyPaid' | 'historical' */
  const [cardFilter, setCardFilter] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') || '');
  const [expenses, setExpenses] = useState([]);
  const [recurringExpenseModalOpen, setRecurringExpenseModalOpen] = useState(false);
  const [isSubmittingRecurring, setIsSubmittingRecurring] = useState(false);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [isLoadingRecurringExpenses, setIsLoadingRecurringExpenses] = useState(false);
  const [viewAllRecurringExpensesModalOpen, setViewAllRecurringExpensesModalOpen] = useState(false);
  const [viewRecurringExpenseModalOpen, setViewRecurringExpenseModalOpen] = useState(false);
  const [selectedRecurringExpense, setSelectedRecurringExpense] = useState(null);
  const [editingRecurringExpense, setEditingRecurringExpense] = useState(null);
  const [isLoadingRecurringExpenseDetails, setIsLoadingRecurringExpenseDetails] = useState(false);
  const [historicalExpenseModalOpen, setHistoricalExpenseModalOpen] = useState(false);
  const [isSubmittingHistorical, setIsSubmittingHistorical] = useState(false);
  
  // Payment modal states
  const [partialPaymentModalOpen, setPartialPaymentModalOpen] = useState(false);
  const [selectedExpenseForPayment, setSelectedExpenseForPayment] = useState(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  
  const [statistics, setStatistics] = useState({
    total: {
      count: 0,
      amount: '0',
      cogsIncluded: false,
      cogsAmount: 0,
      cogsPostingCount: 0,
      salaryAdvanceAmount: 0,
      grandTotalAmount: '0'
    },
    approved: { count: 0, amount: '0' },
    pending: { count: 0, amount: '0' },
    pendingApproval: { count: 0, amount: '0' },
    paymentPending: { count: 0, amount: '0' },
    partiallyPaid: { count: 0, amount: '0' },
    fullyPaid: { count: 0, amount: '0' },
    historical: { count: 0, amount: '0' },
    rejected: { count: 0, amount: '0' },
    draft: { count: 0, amount: '0' },
    otherStatuses: { count: 0, amount: '0' },
    reconciliation: { matches: true },
    byCategory: []
  });
  const [categoryPagination, setCategoryPagination] = useState({
    currentPage: 1,
    itemsPerPage: 6
  });
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 1
  });
  const [scannedReceipt, setScannedReceipt] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [receiptVerifyModalOpen, setReceiptVerifyModalOpen] = useState(false);
  // File upload related states
  const fileInputRef = useRef(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [viewReceiptModalOpen, setViewReceiptModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [selectedPreviewOpen, setSelectedPreviewOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchDebounceMountRef = useRef(true);

  // Batch operations state
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showDeletedExpenses, setShowDeletedExpenses] = useState(false);
  const [deletedExpenses, setDeletedExpenses] = useState([]);
  
  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteType, setDeleteType] = useState('single'); // 'single' or 'batch'
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  /** When deleting COGS rows: full sale reversal vs COGS journal only. */
  const [cogsRemovalStrategy, setCogsRemovalStrategy] = useState('full_sale');
  
  // Restore modal states
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoreType, setRestoreType] = useState('single'); // 'single' or 'batch'
  const [expenseToRestore, setExpenseToRestore] = useState(null);
  
  // Expense modal states
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState("view"); // view, create, edit
  const [selectedExpenseForModal, setSelectedExpenseForModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pagePermissions, setPagePermissions] = useState({ 
    canApproveExpenses: false,
    canCreateExpenses: false,
    canDeleteExpenses:false, 
    canExportExpenses:false,  
    canUpdateExpenses:false, 
  });       
  const [categories, setCategories] = useState([]); // NEW: Categories state
  
  // COGS Management State
  const [cogsSummary, setCogsSummary] = useState(null);
  const [cogsExpenses, setCogsExpenses] = useState([]);
  const [cogsSettlementModalOpen, setCogsSettlementModalOpen] = useState(false);
  const [isSettlingCogs, setIsSettlingCogs] = useState(false);
  const [cogsSettlementSuccess, setCogsSettlementSuccess] = useState(false);
  const [cogsActiveTab, setCogsActiveTab] = useState("settlement"); // settlement, tracking
  const [recordedCogsAmount, setRecordedCogsAmount] = useState(0);
  const [lastRecordedCogsTotal, setLastRecordedCogsTotal] = useState(0);
  const [isRecordingCogs, setIsRecordingCogs] = useState(false);
  const [cogsRecordingSuccess, setCogsRecordingSuccess] = useState(false);
  const [isLoadingCogs, setIsLoadingCogs] = useState(false);
  const [cogsDateRange, setCogsDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });
  
  // Reversal modal states
  
  useEffect(() => {
    const fetchPermissions = async () => { 
      const canApproveExpenses = await getPermission("expenses.approve");
      const canCreateExpenses = await getPermission("expenses.create");
      const canDeleteExpenses = await getPermission("expenses.delete");
      const canExportExpenses = await getPermission("expenses.export");  
      const canUpdateExpenses = await getPermission("expenses.update"); 
  
      setPagePermissions({ 
        canApproveExpenses,
        canCreateExpenses,
        canDeleteExpenses, 
        canExportExpenses,  
        canUpdateExpenses, 
        });
    };
  
    fetchPermissions();

    // Load recorded COGS amount from localStorage
    const savedRecordedAmount = localStorage.getItem('recordedCogsAmount');
    const savedLastRecordedTotal = localStorage.getItem('lastRecordedCogsTotal');
    if (savedRecordedAmount) {
      setRecordedCogsAmount(parseFloat(savedRecordedAmount));
    }
    if (savedLastRecordedTotal) {
      setLastRecordedCogsTotal(parseFloat(savedLastRecordedTotal));
    }
  }, []);
  // Expense categories are sourced from the Chart of Accounts
  const expenseCategories = [];
  useEffect(() => {
    if (isScanning) {
      console.log("Setting up test progress updates");
      
      // If nothing happens after 5 seconds, show test progress
      const testTimer = setTimeout(() => {
        console.log("Starting test progress updates");
        let testProgress = 0;
        
        const testInterval = setInterval(() => {
          testProgress += 10;
          console.log(`Test progress: ${testProgress}%`);
          
          setScanningProgress(testProgress);
          
          if (testProgress >= 100) {
            clearInterval(testInterval);
          }
        }, 1000);
        
        // Clean up the interval after 15 seconds
        setTimeout(() => {
          clearInterval(testInterval);
        }, 15000);
      }, 5000);
      
      return () => {
        clearTimeout(testTimer);
      };
    }
  }, [isScanning]);
  // Load expenses and statistics on initial render and when filters change
  useLayoutEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [activeTab, selectedCategory, showDeletedExpenses, cardFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadExpenses();
    loadStatistics(true);
    loadRecurringExpenses();
  }, [activeTab, selectedCategory, pagination.page, showDeletedExpenses, cardFilter, dateFrom, dateTo]);

  // Keep date filters in sync when navigating from dashboard KPI links
  useEffect(() => {
    const from = searchParams.get('dateFrom') || '';
    const to = searchParams.get('dateTo') || '';
    setDateFrom(from);
    setDateTo(to);
  }, [searchParams]);

  // Debounced search: reset to page 1 and reload (server merges search with branch OR correctly)
  useEffect(() => {
    if (searchDebounceMountRef.current) {
      searchDebounceMountRef.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
      loadExpenses();
      loadStatistics(true);
    }, 450);
    return () => clearTimeout(timeout);
  }, [searchQuery]);
  
  // Close modals when escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedPreviewOpen) setSelectedPreviewOpen(false);
        else if (viewReceiptModalOpen) setViewReceiptModalOpen(false);
        else if (uploadModalOpen) setUploadModalOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uploadModalOpen, viewReceiptModalOpen, selectedPreviewOpen]);
  
  // Disable body scroll when modal is open
  useEffect(() => {
    if (uploadModalOpen || viewReceiptModalOpen || selectedPreviewOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [uploadModalOpen, viewReceiptModalOpen, selectedPreviewOpen]);
  
  // Load expense data from the API
  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (showDeletedExpenses) {
        // Load deleted expenses
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          search: searchQuery || null
        };
        
        const response = await fetchDeletedExpenses(params);
        setDeletedExpenses(response.expenses);
        setPagination({
          page: response.pagination.page,
          limit: response.pagination.limit,
          totalCount: response.pagination.total,
          totalPages: response.pagination.pages
        });
      } else {
        // Load regular expenses (exclude deleted ones)
        let statusFilter = null;
        if (activeTab === 'pending') statusFilter = 'Pending';
        if (activeTab === 'approved') statusFilter = 'Approved';
        if (activeTab === 'rejected') statusFilter = 'Rejected';

        const paymentStatusByCard = {
          partially: 'Partially',
          pending: 'Pending',
          fullyPaid: 'Fully paid',
        };
        
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          sortBy: 'date',
          sortOrder: 'desc',
          status: statusFilter,
          accountId: selectedCategory !== 'all' && selectedCategory !== 'salary-advance' ? selectedCategory : null,
          category: selectedCategory === 'salary-advance' ? 'Salary Advance' : null,
          search: searchQuery || null,
          includeDeleted: false, // Explicitly exclude deleted expenses
          paymentStatus: paymentStatusByCard[cardFilter] || null,
          isHistorical: cardFilter === 'historical' ? true : null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        };
        
        const response = await fetchExpenses(params);
        setExpenses(response.expenses);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error("Error loading expenses:", error);
      setError("Failed to load expenses. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle batch delete with confirmation
  const handleBatchDelete = async () => {
    if (selectedExpenses.length === 0) return;

    const listForCtx = showDeletedExpenses ? deletedExpenses : expenses;
    const ctx = getCogsDeleteContext(selectedExpenses, 'batch', listForCtx);
    setCogsRemovalStrategy(
      ctx.hasCogs && ctx.hasAnyLinkedSale ? 'full_sale' : ctx.hasCogs ? 'journal_only' : 'full_sale'
    );
    setExpenseToDelete(selectedExpenses);
    setDeleteType('batch');
    setDeleteReason('');
    setDeleteModalOpen(true);
  };

  // Handle confirmed deletion from modal
  const handleConfirmDelete = async () => {
    const trimmed = deleteReason.trim();
    if (!trimmed || trimmed.length < MIN_EXPENSE_DELETE_REASON_LENGTH) return;

    try {
      if (deleteType === 'single') {
        const target = classifyExpenseRowDeleteId(expenseToDelete);
        const listForRow = showDeletedExpenses ? deletedExpenses : expenses;
        if (target.kind === 'cogs') {
          const row = listForRow.find((e) => e.id === expenseToDelete);
          const txnId = row?.transactionId;
          if (!txnId) {
            alert('Could not resolve this COGS posting to a journal entry.');
            return;
          }
          const doFullSale = cogsRemovalStrategy === 'full_sale' && row?.linkedSaleId;
          if (doFullSale) {
            await reverseSalePosting({
              saleId: row.linkedSaleId,
              reversalReason: `${trimmed} (full sale reversal from expenses)`,
            });
            setSuccessMessage(
              'The linked sale was fully reversed (revenue, tax, payments, GL—original entries kept for audit).'
            );
          } else {
            await reversePostedGlTransaction({ transactionId: txnId, reversalReason: trimmed });
            setSuccessMessage(
              'COGS journal reversed in the general ledger (original entry retained for audit). Sale revenue and tax were not changed.'
            );
          }
        } else if (target.kind === 'salaryAdvance') {
          try {
            await deleteSalaryAdvance(target.id);
            setSuccessMessage('Salary advance deleted successfully');
          } catch (e) {
            if (isSalaryAdvanceDeleteBlockedByDeductions(e?.message)) {
              if (
                typeof window !== 'undefined' &&
                !window.confirm(
                  'This salary advance has payroll deductions and cannot be permanently deleted.\n\nMark it as Cancelled? It will disappear from this list but remain in HR → Advances for audit.'
                )
              ) {
                return;
              }
              await updateSalaryAdvance(target.id, { status: 'Cancelled' });
              setSuccessMessage('Salary advance marked as cancelled (removed from this list)');
            } else {
              throw e;
            }
          }
        } else if (target.kind === 'expense') {
          await deleteExpense(target.id, trimmed);
          setSuccessMessage('Expense deleted successfully');
        } else {
          alert('Invalid item selected for deletion.');
          return;
        }
      } else {
        const list = showDeletedExpenses ? deletedExpenses : expenses;
        const { salaryAdvanceIds, cogsIds, expenseIds } = partitionExpenseListDeleteIds(expenseToDelete);
        const cogsTxnIds = collectUniqueCogsTransactionIds(cogsIds, list);

        if (salaryAdvanceIds.length === 0 && expenseIds.length === 0 && cogsIds.length === 0) {
          setDeleteModalOpen(false);
          setDeleteReason('');
          setExpenseToDelete(null);
          setSuccessMessage('Nothing to delete.');
          setTimeout(() => setSuccessMessage(''), 5000);
          return;
        }

        let cogsReversed = 0;
        let fullSalesReversed = 0;
        const linkedSaleIds = collectLinkedSaleIdsFromCogsRowIds(cogsIds, list);

        if (cogsIds.length > 0) {
          if (cogsRemovalStrategy === 'full_sale') {
            for (const sid of linkedSaleIds) {
              await reverseSalePosting({
                saleId: sid,
                reversalReason: `${trimmed} (full sale reversal from expenses)`,
              });
              fullSalesReversed += 1;
            }
            const orphanTxnIds = collectOrphanCogsTransactionIds(cogsIds, list);
            for (const txnId of orphanTxnIds) {
              await reversePostedGlTransaction({ transactionId: txnId, reversalReason: trimmed });
              cogsReversed += 1;
            }
          } else {
            for (const txnId of cogsTxnIds) {
              await reversePostedGlTransaction({ transactionId: txnId, reversalReason: trimmed });
              cogsReversed += 1;
            }
          }
        }

        const saResult = await deleteSalaryAdvancesWithOptionalCancel(salaryAdvanceIds);
        if (expenseIds.length > 0) {
          await batchDeleteExpenses(expenseIds, trimmed);
        }
        const summaryParts = [];
        if (cogsReversed > 0) {
          summaryParts.push(
            `${cogsReversed} COGS journal${cogsReversed !== 1 ? 's' : ''} reversed (GL audit trail kept)`
          );
        }
        if (fullSalesReversed > 0) {
          summaryParts.push(
            `${fullSalesReversed} linked sale${fullSalesReversed !== 1 ? 's' : ''} fully reversed`
          );
        }
        if (saResult.hardDeleted > 0) {
          summaryParts.push(
            `${saResult.hardDeleted} salary advance${saResult.hardDeleted !== 1 ? 's' : ''} deleted`
          );
        }
        if (saResult.cancelled > 0) {
          summaryParts.push(
            `${saResult.cancelled} marked cancelled (removed from list)`
          );
        }
        if (expenseIds.length > 0) {
          summaryParts.push(
            `${expenseIds.length} expense${expenseIds.length !== 1 ? 's' : ''} deleted`
          );
        }
        setSuccessMessage(
          summaryParts.length > 0 ? summaryParts.join(' · ') : 'Done'
        );
      }
      
      await loadExpenses();
      setSelectedExpenses([]);
      setDeleteModalOpen(false);
      setDeleteReason('');
      setExpenseToDelete(null);
      setCogsRemovalStrategy('full_sale');

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error deleting expense(s):', error);
      await loadExpenses();
      alert(error?.message || 'Failed to delete expense(s). Please try again.');
    }
  };

  // Handle batch restore with confirmation
  const handleBatchRestore = async () => {
    if (selectedExpenses.length === 0) return;

    setExpenseToRestore(selectedExpenses);
    setRestoreType('batch');
    setRestoreReason('');
    setRestoreModalOpen(true);
  };

  // Handle restore expense with confirmation
  const handleRestoreExpense = async (expenseId) => {
    setExpenseToRestore(expenseId);
    setRestoreType('single');
    setRestoreReason('');
    setRestoreModalOpen(true);
  };

  // Handle confirmed restoration from modal
  const handleConfirmRestore = async () => {
    if (!restoreReason.trim()) return;

    try {
      if (restoreType === 'single') {
        await restoreExpense(expenseToRestore, restoreReason.trim());
        setSuccessMessage('Expense restored successfully');
      } else {
        // Restore each expense in batch
        for (const expenseId of expenseToRestore) {
          await restoreExpense(expenseId, restoreReason.trim());
        }
        setSuccessMessage(`${expenseToRestore.length} expenses restored successfully`);
      }
      
      await loadExpenses();
      setSelectedExpenses([]);
      setRestoreModalOpen(false);
      setRestoreReason('');
      setExpenseToRestore(null);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error restoring expense(s):', error);
      alert('Failed to restore expense(s). Please try again.');
    }
  };

  // Handle individual delete with confirmation
  const handleDeleteExpenseWithConfirmation = async (expenseId) => {
    if (!confirm('Are you sure you want to delete this expense? This action can be undone later by restoring from the deleted expenses view.')) {
      return;
    }
    
    const reason = prompt(
      `Reason for deletion (at least ${MIN_EXPENSE_DELETE_REASON_LENGTH} characters for audit):`
    );
    if (reason === null) return;
    const trimmed = reason.trim();
    if (trimmed.length < MIN_EXPENSE_DELETE_REASON_LENGTH) {
      alert(`Please enter at least ${MIN_EXPENSE_DELETE_REASON_LENGTH} characters, or use batch delete from the list.`);
      return;
    }

    try {
      await deleteExpense(expenseId, trimmed);
      
      // Remove from expenses list
      setExpenses(expenses.filter(expense => expense.id !== expenseId));
      
      // Refresh statistics
      loadStatistics();
      
      alert('Expense deleted successfully');
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense: ' + error.message);
    }
  };

  // Handle expense selection
  const handleExpenseSelect = (expense) => {
    const expenseId = expense.id;
    if (selectedExpenses.includes(expenseId)) {
      setSelectedExpenses(selectedExpenses.filter((id) => id !== expenseId));
    } else {
      setSelectedExpenses([...selectedExpenses, expenseId]);
    }
  };

  // Handle select all expenses
  const handleSelectAll = () => {
    const allIds = expenses.map((e) => e.id);
    const allSelected =
      allIds.length > 0 && allIds.every((id) => selectedExpenses.includes(id));
    if (allSelected) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(allIds);
    }
  };
  
  // Load statistics (scoped to same account / category / search as the list — not status tab)
  const loadStatistics = async (forceRefresh = false) => {
    try {
      setIsLoadingStatistics(true);
      const params = {
        ...(selectedCategory !== 'all' && selectedCategory !== 'salary-advance'
          ? { accountId: selectedCategory }
          : {}),
        ...(selectedCategory === 'salary-advance' ? { category: 'Salary Advance' } : {}),
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(forceRefresh ? { _t: Date.now() } : {}),
      };
      const stats = await getExpenseStatistics(params);
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
    } finally {
      setIsLoadingStatistics(false);
    }
  };
  
  // Handle receipt upload
// Update your handleFileUpload function to ensure progress updates affect the UI
const handleFileUpload = async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  
  // Process the files normally first
  processFiles(files);
  
  // If it's an image, try to scan it for receipt data
  const file = files[0]; // Use the first file for scanning
  if (file.type.startsWith('image/')) {
    try {
      // // Set scanning status
      // setIsScanning(true);
      // setScanningProgress(0);
      
      // // Show a scanning notification
      // setUploadModalOpen(true);
      
      // // Define a clear lastProgress variable in closure scope to track changes
      // let lastProgress = 0;
      
      // // Define the progress callback
      // const updateProgress = (progress) => {
      //   // Only log and update if progress has increased
      //   if (progress > lastProgress) {
      //     console.log(`Updating progress: ${lastProgress}% -> ${progress}%`);
      //     lastProgress = progress;
          
      //     // Important: Use this form to force React to update
      //     setScanningProgress((prevProgress) => {
      //       // If new progress is smaller than what we have, keep the higher value
      //       return Math.max(prevProgress, progress);
      //     });
          
      //     // As a backup, directly update the DOM
      //     requestAnimationFrame(() => {
      //       const progressBar = document.getElementById('scan-progress-bar');
      //       if (progressBar) {
      //         progressBar.style.width = `${progress}%`;
      //       }
            
      //       const progressText = document.getElementById('scan-progress-text');
      //       if (progressText) {
      //         progressText.innerText = `${progress}% complete`;
      //       }
      //     });
      //   }
      // };
      
      // // Scan the receipt with our progress callback
      // const receiptData = await scanReceipt(file, updateProgress);
      
      // // Set the scanned data
      // setScannedReceipt({
      //   ...receiptData,
      //   file: file,
      //   previewUrl: URL.createObjectURL(file)
      // });
      
      // // Open the verification modal
      // setReceiptVerifyModalOpen(true);
      
      // // Close the upload modal
      // setUploadModalOpen(false);
    } catch (error) {
      console.error("Error scanning receipt:", error);
      alert("Failed to scan receipt. You can still upload it normally.");
    } finally {
      setIsScanning(false);
    }
  }
};
  const handleReceiptVerify = async (verifiedData) => {
    try {
      setIsSubmitting(true);
      
      // Create a FormData object
      const formData = new FormData();
      
      // Add the verified expense data
      formData.append('data', JSON.stringify(verifiedData));
      
      // Add the receipt image
      if (scannedReceipt.file) {
        formData.append('file-0', scannedReceipt.file);
      }
      
      // Call the API to create the expense with attachment
      const response = await fetch('/api/expenses/with-attachments', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error creating expense: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Add the new expense to the list
      setExpenses([result.expense, ...expenses]);
      
      // Refresh statistics
      loadStatistics();
      
      // Show success message
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      
      // Close the verification modal
      setReceiptVerifyModalOpen(false);
      
      // Clear the scanned receipt
      setScannedReceipt(null);
    } catch (error) {
      console.error("Error creating expense:", error);
      alert("Failed to create expense. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  // Load recurring expenses
  const loadRecurringExpenses = async () => {
    try {
      setIsLoadingRecurringExpenses(true);
      const response = await fetchRecurringExpenses({ 
        page: 1, 
        limit: 100, // Get all for the modal, we'll show first 3 in the list
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      setRecurringExpenses(response.recurringExpenses || []);
    } catch (error) {
      console.error("Error loading recurring expenses:", error);
      setRecurringExpenses([]);
    } finally {
      setIsLoadingRecurringExpenses(false);
    }
  };

  const handleRecurringExpenseSubmit = async (formData) => {
    setIsSubmittingRecurring(true);
    
    try {
      if (editingRecurringExpense) {
        // Update existing
        await updateRecurringExpense(editingRecurringExpense.id, formData);
        alert("Recurring expense updated successfully!");
      } else {
        // Create new
        await createRecurringExpense(formData);
        alert("Recurring expense created successfully! It will automatically generate expenses according to your schedule.");
      }
      
      // Show success message
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      
      // Close the modal
      setRecurringExpenseModalOpen(false);
      setEditingRecurringExpense(null);
      
      // Reload the list
      await loadRecurringExpenses();
      
    } catch (error) {
      console.error("Error saving recurring expense:", error);
      alert(`Failed to ${editingRecurringExpense ? 'update' : 'create'} recurring expense. Please try again.`);
    } finally {
      setIsSubmittingRecurring(false);
    }
  };

  const handleRecurringExpense = () => {
    setEditingRecurringExpense(null);
    setRecurringExpenseModalOpen(true);
  };

  const handleViewRecurringExpense = async (expense) => {
    try {
      setIsLoadingRecurringExpenseDetails(true);
      // Fetch full details including history
      const fullExpense = await fetchRecurringExpenseById(expense.id);
      setSelectedRecurringExpense(fullExpense);
      setViewRecurringExpenseModalOpen(true);
    } catch (error) {
      console.error("Error fetching recurring expense details:", error);
      alert("Failed to load recurring expense details.");
    } finally {
      setIsLoadingRecurringExpenseDetails(false);
    }
  };

  const handleEditRecurringExpense = async (expense) => {
    try {
      // Fetch full details
      const fullExpense = await fetchRecurringExpenseById(expense.id);
      setEditingRecurringExpense(fullExpense);
      setRecurringExpenseModalOpen(true);
    } catch (error) {
      console.error("Error fetching recurring expense:", error);
      alert("Failed to load recurring expense details.");
    }
  };

  const handleDeleteRecurringExpense = async (expense) => {
    if (!confirm(`Are you sure you want to delete the recurring expense "${expense.description}"?`)) {
      return;
    }

    try {
      await deleteRecurringExpense(expense.id);
      alert("Recurring expense deleted successfully!");
      await loadRecurringExpenses();
    } catch (error) {
      console.error("Error deleting recurring expense:", error);
      alert("Failed to delete recurring expense. Please try again.");
    }
  };

  const handleExportRecurringExpenses = () => {
    // Convert recurring expenses to CSV
    const headers = ['Description', 'Amount', 'Category', 'Frequency', 'Start Date', 'End Date', 'Status', 'Next Run Date'];
    const rows = recurringExpenses.map(exp => [
      exp.description || '',
      exp.amount || '0',
      exp.category || '',
      exp.frequency || '',
      exp.startDate || '',
      exp.endDate || '',
      exp.status || '',
      exp.nextRunDate || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recurring-expenses-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Handle historical expense submission
  const handleHistoricalExpenseSubmit = async (formData) => {
    setIsSubmittingHistorical(true);
    
    try {
      const result = await createExpense(formData);
      
      // Small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Refresh expenses and statistics
      await loadExpenses();
      await loadStatistics(true); // Force refresh statistics
      
      // Show success message
      setSuccessMessage('Historical expense created successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Close modal
      setHistoricalExpenseModalOpen(false);
    } catch (error) {
      console.error("Error creating historical expense:", error);
      alert("Failed to create historical expense. Please try again.");
    } finally {
      setIsSubmittingHistorical(false);
    }
  };
  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  // Handle drag leave
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    processFiles(files);
  };
  
  // Process uploaded files
  const processFiles = (files) => {
    if (!files || files.length === 0) return;
    
    // Simulate uploading state for better UX
    setIsUploading(true);
    
    setTimeout(() => {
      const newFiles = Array.from(files).map((file, index) => {
        // Generate a preview URL for images
        const previewUrl = file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : null;
        
        // Format file size
        const size = formatFileSize(file.size);
        
        return {
          id: `upload-${Date.now()}-${index}`,
          file,
          name: file.name,
          type: file.type,
          size,
          previewUrl
        };
      });
      
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      setIsUploading(false);
    }, 500); // Small delay for UX
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
  };
  
  // Remove file from upload list
  const removeFile = (fileId) => {
    const updatedFiles = uploadedFiles.filter(file => file.id !== fileId);
    setUploadedFiles(updatedFiles);
  };
  
  // Remove attachment from expense
  const handleDeleteAttachment = async (expenseId, attachmentId) => {
    try {
      await deleteAttachment(expenseId, attachmentId);
      
      // Update local state
      const updatedExpenses = expenses.map(exp => {
        if (exp.id === expenseId) {
          return {
            ...exp,
            attachments: exp.attachments.filter(att => att.id !== attachmentId)
          };
        }
        return exp;
      });
      
      setExpenses(updatedExpenses);
      
      // If we're in the view mode and there are no more attachments, close the modal
      if (viewReceiptModalOpen) {
        const expense = updatedExpenses.find(e => e.id === expenseId);
        if (expense.attachments.length === 0) {
          setViewReceiptModalOpen(false);
        }
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert("Failed to delete attachment. Please try again.");
    }
  };
  
  // Get file icon based on mime type
  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };
  
  // Open file upload dialog
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Open upload modal for a specific expense
  const openUploadModal = (expense) => {
    if (isCogsListRow(expense)) {
      alert('Receipts cannot be attached to Cost of Goods Sold entries. COGS comes from inventory when items are sold.');
      return;
    }
    setSelectedExpense(expense);
    setUploadedFiles([]);
    setUploadModalOpen(true);
  };

  // Open receipt viewer for a specific expense (virtual COGS PDFs open in a new tab)
  const viewReceipts = (expense) => {
    if (isCogsListRow(expense)) {
      const virtual = (expense.attachments || []).find((a) => a?.virtual && a?.url);
      if (virtual?.url) {
        window.open(virtual.url, '_blank', 'noopener,noreferrer');
        return;
      }
      alert('No linked invoice or POS receipt found for this COGS entry.');
      return;
    }
    setSelectedExpense(expense);
    setViewReceiptModalOpen(true);
  };
  
  const downloadExpenseAttachment = async (attachment) => {
    if (!attachment?.url) {
      alert('No receipt file is available to download.');
      return;
    }
    try {
      const res = await fetch(attachment.url, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = attachment.name || 'receipt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Expense receipt download failed:', err);
      alert('Could not download this receipt. Try again or re-upload the file.');
    }
  };

  // Open individual attachment preview
  const openAttachmentPreview = (attachment) => {
    setSelectedAttachment(attachment);
    setSelectedPreviewOpen(true);
  };
  
  // Handle individual expense deletion
  const handleDeleteExpense = async (expenseId) => {
    const listForCtx = showDeletedExpenses ? deletedExpenses : expenses;
    const ctx = getCogsDeleteContext(expenseId, 'single', listForCtx);
    setCogsRemovalStrategy(
      ctx.hasCogs && ctx.hasAnyLinkedSale ? 'full_sale' : ctx.hasCogs ? 'journal_only' : 'full_sale'
    );
    setExpenseToDelete(expenseId);
    setDeleteType('single');
    setDeleteReason('');
    setDeleteModalOpen(true);
  };
  
  // Handle viewing expense details
  const handleViewExpense = (expense) => {
    setSelectedExpenseForModal(expense);
    setExpenseModalMode("view");
    setExpenseModalOpen(true);
  };
  
  // Handle creating new expense
  const handleCreateExpense = () => {
    setSelectedExpenseForModal(null);
    setExpenseModalMode("create");
    setExpenseModalOpen(true);
  };
  
  // Handle editing expense
  const handleEditExpense = (expense) => {
    if (isCogsListRow(expense)) {
      handleViewExpense(expense);
      return;
    }
    setSelectedExpenseForModal(expense);
    setExpenseModalMode("edit");
    setExpenseModalOpen(true);
  };
  
  // Handle expense form submission
  const handleExpenseSubmit = async (formData) => {
    setIsSubmitting(true);
    
    try {
      if (expenseModalMode === "create") {
        // Create new expense
        const result = await createExpense(formData);
        
        // Add to expenses list
        setExpenses([result.expense, ...expenses]);
        
        // Show success message
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      } else if (expenseModalMode === "edit") {
        // Update existing expense
        const result = await updateExpense(selectedExpenseForModal.id, formData);
        
        // Update expenses list
        setExpenses(expenses.map(exp => 
          exp.id === result.expense.id ? result.expense : exp
        ));
      }
      
      // Close modal
      setExpenseModalOpen(false);
      
      // Refresh statistics
      loadStatistics();
    } catch (error) {
      console.error("Error submitting expense:", error);
      alert(error?.message || "Failed to save expense. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete the upload process and attach to expense
  const completeUpload = async () => {
    if (uploadedFiles.length === 0) return;
    if (isCogsListRow(selectedExpense)) {
      alert('Receipts cannot be attached to Cost of Goods Sold entries.');
      return;
    }
    
    // Start uploading
    setIsUploading(true);
    
    try {
      if (selectedExpense) {
        // Upload attachments to existing expense
        const formData = new FormData();
        uploadedFiles.forEach((file, index) => {
          // formData.append(`file-${index}`, file.file);
          formData.append('file', file.file);
        });
        
        // Upload the files
        const result = await uploadAttachment(selectedExpense.id, formData);
        
        // Update the expense with new attachments
        const updatedExpenses = expenses.map(exp => {
          if (exp.id === selectedExpense.id) {
            return {
              ...exp,
              attachments: [...exp.attachments, ...result.attachments]
            };
          }
          return exp;
        });
        
        setExpenses(updatedExpenses);
      } else {
        // Create new expense with attachments
        // Collect uploaded files
        const files = uploadedFiles.map(file => file.file);
        
        // Create a basic expense object with all REQUIRED fields
        const defaultAccount = categories[0] || null;
        const newExpense = {
          description: "New expense from receipt", 
          amount: 0, 
          date: new Date().toISOString().split('T')[0], // Today's date - CRITICAL field
          expenseAccountId: defaultAccount?.id || "",
          category: defaultAccount?.name || "",
          status: "Approved"
        };
        
        // Create expense with attachments by sending proper JSON for expense data
        const formData = new FormData();
        
        // Add expense data as a properly formatted JSON string
        formData.append('data', JSON.stringify(newExpense));
        
        // Add attachments
        files.forEach((file, index) => {
          formData.append(`file-${index}`, file);
        });
        
        // Use fetch directly since createExpenseWithAttachments may have issues
        const response = await fetch('/api/expenses/with-attachments', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error creating expense with attachments: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Add the new expense to the list
        setExpenses([result.expense, ...expenses]);
        
        // Refresh statistics
        loadStatistics();
      }
      
      // Show success message
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);
      
      // Close the modal
      setUploadModalOpen(false);
    } catch (error) {
      console.error("Error uploading attachments:", error);
      alert("Failed to upload attachments. Please try again. Error: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };
  
  
  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination({
      ...pagination,
      page: newPage
    });
  };

  // Handle partial payment
  const handlePartialPayment = (expense) => {
    if (isCogsListRow(expense)) return;
    setSelectedExpenseForPayment(expense);
    setPartialPaymentModalOpen(true);
  };

  // Handle payment success
  const handlePaymentSuccess = async () => {
    await loadExpenses();
    await loadStatistics(true);
    setSuccessMessage('Payment processed successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Toggle payment history
  const togglePaymentHistory = (expense) => {
    if (isCogsListRow(expense)) return;
    setSelectedExpenseForPayment(expense);
    setShowPaymentHistory(!showPaymentHistory);
  };

  // Helper function to check if expense is eligible for partial payment
  const isEligibleForPartialPayment = (expense) => {
    if (isCogsListRow(expense)) return false;
    return expense.paymentStatus === 'Pending' || expense.paymentStatus === 'Partially';
  };
  
  // Handle export
  const handleExport = async (format = 'csv') => {
    try {
      // Create filter object based on current filters
      const filters = {
        status: activeTab === 'all' ? null : activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
        accountId: selectedCategory !== 'all' && selectedCategory !== 'salary-advance' ? selectedCategory : null,
        category: selectedCategory === 'salary-advance' ? 'Salary Advance' : null,
        search: searchQuery.trim() || null
      };
      
      const blob = await exportExpenses(filters, format);
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `expenses-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting expenses:", error);
      alert("Failed to export expenses. Please try again.");
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    let badgeClass = "";
    let icon = null;
    
    switch (status) {
      case "Approved":
        badgeClass = "bg-green-100 text-green-800";
        icon = <CheckCircle className="w-3.5 h-3.5 mr-1" />;
        break;
      case "Pending":
        badgeClass = "bg-yellow-100 text-yellow-800";
        icon = <Clock className="w-3.5 h-3.5 mr-1" />;
        break;
      case "Submitted":
      case "In review":
        badgeClass = "bg-blue-100 text-blue-800";
        icon = <Clock className="w-3.5 h-3.5 mr-1" />;
        break;
      case "Draft":
        badgeClass = "bg-slate-100 text-slate-700";
        break;
      case "Rejected":
      case "Reversed":
        badgeClass = "bg-red-100 text-red-800";
        icon = <XCircle className="w-3.5 h-3.5 mr-1" />;
        break;
      default:
        badgeClass = "bg-gray-100 text-gray-800";
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs flex items-center whitespace-nowrap ${badgeClass}`}>
        {icon}
        {status || 'Draft'}
      </span>
    );
  };

  // Payment status badge component
  const PaymentStatusBadge = ({ paymentStatus, paidAmount, totalAmount }) => {
    const getPaymentStatusColor = (status) => {
      switch (status) {
        case 'Fully paid':
          return 'bg-green-100 text-green-800';
        case 'Partially':
          return 'bg-yellow-100 text-yellow-800';
        case 'Pending':
          return 'bg-red-100 text-red-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };

    const formatAmount = (amount) => {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    };

    return (
      <div className="flex flex-col items-center">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(paymentStatus)}`}>
          {paymentStatus || 'Fully paid'}
        </span>
        {paymentStatus === 'Partially' && paidAmount && totalAmount && (
          <span className="text-xs text-gray-500 mt-1">
            MK {formatAmount(paidAmount)} / MK {formatAmount(totalAmount)}
          </span>
        )}
      </div>
    );
  };

  // Load expense categories from active, postable Chart of Accounts expense accounts.
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories?type=expense');
      const data = response.ok ? await response.json() : {};
      const raw = Array.isArray(data.categories) ? data.categories : [];
      // Dedupe by id so UI never shows duplicate categories
      const seen = new Set();
      const categoriesDeduped = raw.filter((c) => {
        const id = c?.id ?? c?.accountId;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      setCategories(categoriesDeduped);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    }
  };

  // Category pagination functions
  const getTotalPages = () => {
    return Math.ceil(statistics.byCategory.length / categoryPagination.itemsPerPage);
  };

  const getCurrentPageCategories = () => {
    const startIndex = (categoryPagination.currentPage - 1) * categoryPagination.itemsPerPage;
    const endIndex = startIndex + categoryPagination.itemsPerPage;
    return statistics.byCategory.slice(startIndex, endIndex);
  };

  const handleNextPage = () => {
    const totalPages = getTotalPages();
    if (totalPages === 0) return;
    
    setCategoryPagination(prev => ({
      ...prev,
      currentPage: prev.currentPage >= totalPages ? 1 : prev.currentPage + 1
    }));
  };

  const handlePreviousPage = () => {
    const totalPages = getTotalPages();
    if (totalPages === 0) return;
    
    setCategoryPagination(prev => ({
      ...prev,
      currentPage: prev.currentPage <= 1 ? totalPages : prev.currentPage - 1
    }));
  };

  // Load COGS data
  const loadCogsData = async () => {
    try {
      setIsLoadingCogs(true);
      // Build query params with date range
      const queryParams = new URLSearchParams();
      if (cogsDateRange.startDate) {
        queryParams.append('startDate', cogsDateRange.startDate);
      }
      if (cogsDateRange.endDate) {
        queryParams.append('endDate', cogsDateRange.endDate);
      }
      
      const queryString = queryParams.toString();
      const summaryUrl = `/api/expenses/cogs-summary${queryString ? `?${queryString}` : ''}`;
      
      const [summaryResponse, expensesResponse] = await Promise.all([
        fetch(summaryUrl),
        fetch('/api/expenses/cogs-settlement')
      ]);
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setCogsSummary(summaryData);
      }
      
      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json();
        setCogsExpenses(expensesData.expenses || []);
      }
    } catch (error) {
      console.error('Error loading COGS data:', error);
    } finally {
      setIsLoadingCogs(false);
    }
  };

  // Handle COGS settlement
  const handleCogsSettlement = async (settlementData) => {
    try {
      setIsSettlingCogs(true);
      
      // If no amount is provided, use the total COGS amount
      const finalSettlementData = {
        ...settlementData,
        amount: settlementData.amount || cogsSummary?.summary?.totalCOGS || 0,
        description: settlementData.description || `Total COGS Settlement - MK ${(cogsSummary?.summary?.totalCOGS || 0).toLocaleString()}`
      };
      
      const response = await fetch('/api/expenses/cogs-settlement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalSettlementData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create COGS settlement');
      }

      setCogsSettlementSuccess(true);
      setCogsSettlementModalOpen(false);
      
      // Refresh COGS data
      await loadCogsData();
      
      // Show success message
      setTimeout(() => {
        setCogsSettlementSuccess(false);
      }, 3000);

    } catch (error) {
      console.error('Error settling COGS:', error);
      alert(`Failed to settle COGS: ${error.message}`);
    } finally {
      setIsSettlingCogs(false);
    }
  };

  // Handle recording COGS as expense (new functionality)
  const handleRecordCogsAsExpense = async () => {
    try {
      setIsRecordingCogs(true);
      
      const totalCogsAmount = cogsSummary?.summary?.totalCOGS || 0;
      const newCogsAmount = totalCogsAmount - lastRecordedCogsTotal;
      
      if (newCogsAmount <= 0) {
        alert('No new COGS amount to record as expense');
        return;
      }

      // Create COGS settlement entry (this creates both the expense and COGS settlement)
      const cogsSettlementResponse = await fetch('/api/expenses/cogs-settlement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: newCogsAmount,
          description: `COGS Batch Settlement - MK ${newCogsAmount.toLocaleString()}`,
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'cash',
          notes: `COGS batch recording for new transactions. Amount: MK ${newCogsAmount.toLocaleString()}`
        })
      });

      const cogsSettlementData = await cogsSettlementResponse.json();
      
      if (cogsSettlementResponse.ok) {
        // Update recorded amount by adding the new amount
        const newRecordedAmount = recordedCogsAmount + newCogsAmount;
        setRecordedCogsAmount(newRecordedAmount);
        setLastRecordedCogsTotal(totalCogsAmount);
        
        // Save to localStorage
        localStorage.setItem('recordedCogsAmount', newRecordedAmount.toString());
        localStorage.setItem('lastRecordedCogsTotal', totalCogsAmount.toString());
        
        // Show success message
        setCogsRecordingSuccess(true);
        setTimeout(() => {
          setCogsRecordingSuccess(false);
        }, 3000);

        // Refresh both expenses and COGS data
        await Promise.all([
          loadExpenses(),
          loadCogsData()
        ]);
        
        alert(`Successfully recorded MK ${newCogsAmount.toLocaleString()} as COGS batch in both regular expenses and COGS tab!`);
      } else {
        const errorMsg = cogsSettlementData.error || 'Failed to record COGS batch';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error recording COGS as expense:', error);
      alert(`Failed to record COGS expense: ${error.message}`);
    } finally {
      setIsRecordingCogs(false);
    }
  };

  // Function to reset recorded amount when new COGS transactions occur
  const resetRecordedCogsAmount = () => {
    if (window.confirm('Are you sure you want to reset the recorded COGS amount? This will allow you to re-record the same amount.')) {
      setRecordedCogsAmount(0);
      setLastRecordedCogsTotal(0);
      localStorage.removeItem('recordedCogsAmount');
      localStorage.removeItem('lastRecordedCogsTotal');
      alert('Recorded COGS amount has been reset. You can now record the current amount again.');
    }
  };

  // Function to clear all COGS data (for debugging/admin use)
  const clearAllCogsData = () => {
    if (window.confirm('Are you sure you want to clear ALL COGS data? This will reset everything and cannot be undone.')) {
      setRecordedCogsAmount(0);
      setLastRecordedCogsTotal(0);
      localStorage.removeItem('recordedCogsAmount');
      localStorage.removeItem('lastRecordedCogsTotal');
      setCogsRecordingSuccess(false);
      alert('All COGS data has been cleared. The system will start fresh.');
    }
  };


  // Load data on component mount
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        loadExpenses(),
        loadStatistics(),
        loadCategories() // NEW: Load categories
      ]);
    };
    
    initializeData();
  }, []);

  // Load COGS data when switching to COGS tab or when date range changes
  useEffect(() => {
    if (mainTab === "cogs") {
      loadCogsData();
    }
  }, [mainTab, cogsDateRange.startDate, cogsDateRange.endDate]);

  const listForDeleteModal = showDeletedExpenses ? deletedExpenses : expenses;
  const deleteModalCogsCtx = deleteModalOpen
    ? getCogsDeleteContext(expenseToDelete, deleteType, listForDeleteModal)
    : { hasCogs: false, cogsRowIds: [], hasAnyLinkedSale: false, linkedSaleCount: 0 };
  const deleteModalBatchPartition =
    deleteModalOpen && deleteType === 'batch' && Array.isArray(expenseToDelete)
      ? partitionExpenseListDeleteIds(expenseToDelete)
      : { salaryAdvanceIds: [], cogsIds: [], expenseIds: [] };
  const deleteModalHasMixedBatch =
    deleteModalCogsCtx.hasCogs &&
    deleteType === 'batch' &&
    (deleteModalBatchPartition.expenseIds.length > 0 ||
      deleteModalBatchPartition.salaryAdvanceIds.length > 0);

  return (
    <PermissionGuard permission="expenses.view">
      <div className="w-full">
        <div className="w-full">
      {/* Success notification */}
      {uploadSuccess && (
        <div className="fixed top-6 right-6 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 text-green-800 p-4 rounded-lg shadow-xl z-50 flex items-center animate-fadeIn max-w-md backdrop-blur-sm">
          <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0 text-green-600" />
          <div className="mr-2 flex-grow">
            <p className="font-semibold text-sm">Receipts successfully attached!</p>
            <p className="text-xs text-green-700 mt-0.5">{selectedExpense ? `Expense ID: ${selectedExpense.id}` : 'New expense created'}</p>
          </div>
          <button 
            className="text-green-700 hover:text-green-900 flex-shrink-0 transition-colors rounded-full p-1 hover:bg-green-100"
            onClick={() => setUploadSuccess(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="mb-8">
        <PageHeader
          title={mainTab === "expenses" ? "Expense Tracking" : "Cost of Goods Sold (COGS) Management"}
          description={
            mainTab === "expenses"
              ? "Manage and track all your business expenses efficiently"
              : "Monitor and manage your cost of goods sold"
          }
          actions={
            <>
              {pagePermissions.canCreateExpenses && mainTab === "expenses" && (
                <button
                  type="button"
                  className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--action-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[var(--action-primary-hover)]"
                  onClick={handleCreateExpense}
                >
                  <PlusCircle className="mr-2 h-5 w-5" aria-hidden="true" />
                  <span className="whitespace-nowrap">Add Expense</span>
                </button>
              )}
              {pagePermissions.canExportExpenses && mainTab === "expenses" && (
                <button
                  type="button"
                  className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-primary)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  onClick={() => handleExport('csv')}
                >
                  <Download className="mr-2 h-5 w-5" aria-hidden="true" />
                  <span className="whitespace-nowrap">Export CSV</span>
                </button>
              )}
            </>
          }
        />


      {/* Main Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 inline-flex">
            <nav className="flex space-x-1">
            <button
              onClick={() => setMainTab("expenses")}
                className={`px-6 py-3 rounded-lg font-semibold text-sm flex items-center transition-all duration-200 ${
                mainTab === "expenses"
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
                <Receipt className="h-5 w-5 mr-2" />
              Expenses
            </button>
            <button
              onClick={() => setMainTab("cogs")}
                className={`px-6 py-3 rounded-lg font-semibold text-sm flex items-center transition-all duration-200 ${
                mainTab === "cogs"
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
                <Package className="h-5 w-5 mr-2" />
              Cost of Goods
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {mainTab === "expenses" && (
        <>
            {/* Statistics Cards — click to filter the expense list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
              {[
                {
                  key: 'partially',
                  label: 'Partially Paid',
                  amount: statistics.partiallyPaid?.amount ?? '0.00',
                  count: statistics.partiallyPaid?.count ?? 0,
                  countLabel: 'partially paid',
                  amountClass: 'text-amber-700',
                  barClass: 'from-amber-400 via-yellow-500 to-orange-500',
                },
                {
                  key: 'pending',
                  label: 'Pending',
                  amount: statistics.paymentPending?.amount ?? '0.00',
                  count: statistics.paymentPending?.count ?? 0,
                  countLabel: 'awaiting payment',
                  amountClass: 'text-orange-700',
                  barClass: 'from-orange-400 via-amber-500 to-red-400',
                },
                {
                  key: 'fullyPaid',
                  label: 'Fully Paid',
                  amount: statistics.fullyPaid?.amount ?? '0.00',
                  count: statistics.fullyPaid?.count ?? 0,
                  countLabel: 'fully paid',
                  amountClass: 'text-green-700',
                  barClass: 'from-green-400 via-emerald-500 to-teal-500',
                },
                {
                  key: 'historical',
                  label: 'Historical Expenses',
                  amount: statistics.historical?.amount ?? '0.00',
                  count: statistics.historical?.count ?? 0,
                  countLabel: 'historical records',
                  amountClass: 'text-blue-700',
                  barClass: 'from-blue-500 via-sky-500 to-indigo-500',
                },
              ].map((card) => {
                const isActive = cardFilter === card.key;
                return (
                  <ClickableStatCard
                    key={card.key}
                    label={card.label}
                    value={`MK ${card.amount}`}
                    count={card.count}
                    countLabel={card.countLabel}
                    active={isActive}
                    onClick={() => {
                      const next = isActive ? null : card.key;
                      setCardFilter(next);
                      if (activeTab === 'historical') setActiveTab('all');
                      setShowDeletedExpenses(false);
                      setSelectedExpenses([]);
                    }}
                    title={isActive ? `Clear ${card.label} filter` : `Show ${card.label} expenses`}
                    valueClassName={card.amountClass}
                    barClassName={card.barClass}
                  />
                );
              })}
            </div>

            {/* Main Content Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 overflow-hidden">
              {/* Sub Tab Navigation */}
              <div className="px-4 sm:px-6 py-3 border-b border-gray-100/50 bg-gradient-to-r from-blue-500/5 via-transparent to-indigo-500/5">
                <div className="flex gap-2 overflow-x-auto">
          <button 
                    className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                      activeTab === "all" 
                        ? "bg-white text-blue-600 shadow-md border border-blue-200" 
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                    }`}
            onClick={() => setActiveTab("all")}
          >
            All Expenses
          </button>
          <button 
                    className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                      activeTab === "historical" 
                        ? "bg-white text-blue-600 shadow-md border border-blue-200" 
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                    }`}
            onClick={() => setActiveTab("historical")}
          >
            Historical Import
          </button>
                </div>
        </div>

        {activeTab !== "historical" && (
                <div className="p-4 sm:p-6 border-b border-gray-100/50 bg-gray-50/30">
          {/* Batch Operations Bar */}
          {selectedExpenses.length > 0 && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50/80 border-2 border-blue-200/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md backdrop-blur-sm">
              <div className="flex items-center gap-4">
                        <div className="rounded-full bg-blue-500 p-2">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-blue-900 block">
                  {selectedExpenses.length} expense{selectedExpenses.length !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedExpenses([])}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                >
                  Clear selection
                </button>
                        </div>
              </div>
              <div className="flex items-center gap-2">
                {!showDeletedExpenses && pagePermissions.canDeleteExpenses && (
                  <button
                    onClick={handleBatchDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                            Delete ({selectedExpenses.length})
                  </button>
                )}
                {showDeletedExpenses && (
                  <button
                    onClick={handleBatchRestore}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                            Restore ({selectedExpenses.length})
                  </button>
                )}
              </div>
            </div>
          )}

                  {/* Filters Section */}
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search expenses..." 
                          className="w-full p-3 pl-11 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                          <Search className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="relative flex-1 min-w-[150px]">
                <select 
                          className="w-full appearance-none bg-white border-2 border-gray-200 rounded-lg px-4 py-3 pr-10 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="salary-advance">Salary Advance</option>
                  {categories.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code ? `${account.code} - ${account.name}` : account.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                </div>
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-3 border-2 border-gray-200 rounded-lg bg-white text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                title="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-3 border-2 border-gray-200 rounded-lg bg-white text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                title="To date"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="px-3 py-3 border-2 border-gray-200 rounded-lg bg-white text-sm shadow-sm hover:bg-gray-50"
                >
                  Clear dates
                </button>
              )}
              <div className="flex gap-2">
                <button 
                          className="px-4 py-3 border-2 border-gray-200 rounded-lg bg-white text-sm flex items-center hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm font-medium"
                  onClick={() => setShowDeletedExpenses(!showDeletedExpenses)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                          {showDeletedExpenses ? 'Active' : 'Deleted'}
                </button>
                {pagePermissions.canExportExpenses && (
                  <button 
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg bg-white flex items-center text-sm hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm font-medium"
                    onClick={() => handleExport('csv')}
                  >
                            <Download className="w-4 h-4 mr-2 text-gray-600" />
                    <span className="text-gray-700">Export</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {activeTab === "historical" ? (
          <div className="p-6">
            <HistoricalExpenseUpload 
              onUploadComplete={async (result) => {
                // Delay to ensure database transaction is fully committed
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // Refresh expenses after successful upload
                await loadExpenses();
                await loadStatistics(true); // Force refresh statistics
                
                // Show success message
                setSuccessMessage(`Successfully imported ${result.totalProcessed} historical expenses`);
                setTimeout(() => setSuccessMessage(''), 5000);
              }}
              onSingleExpenseClick={() => setHistoricalExpenseModalOpen(true)}
            />
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-500">Loading expenses...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500">{error}</p>
            <button 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={loadExpenses}
            >
              Try Again
            </button>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No expenses found</h3>
            <p className="text-gray-500 mb-4">
              {activeTab !== "all" || selectedCategory !== "all" || searchQuery || cardFilter
                ? "Try changing your filters or search query"
                : "Get started by adding your first expense"}
            </p>
            {pagePermissions.canCreateExpenses &&(   <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={handleCreateExpense}
            >
              <PlusCircle className="w-4 h-4 mr-2 inline-block" />
              Add Expense
            </button>)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                        <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                    Description
                  </th>
                        <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                    Date
                  </th>
                        <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                    Category
                  </th>
                        <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                    Merchant
                  </th>
                        <th className="px-4 sm:px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                    Amount
                  </th>
                        <th className="px-4 sm:px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                    Payment Status
                  </th>
                  {!showDeletedExpenses && (
                          <th className="px-4 sm:px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Status
                    </th>
                  )}
                  {showDeletedExpenses && (
                          <th className="px-4 sm:px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Deleted At
                    </th>
                  )}
                        <th className="px-4 sm:px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                    Receipts
                  </th>
                        <th className="px-4 sm:px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showDeletedExpenses ? deletedExpenses : expenses).map((expense) => (
                  <tr 
                    key={expense.id} 
                          className={`cursor-pointer transition-all duration-200 ${
                      selectedExpenses.includes(expense.id) 
                              ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 shadow-sm' 
                              : 'hover:bg-gray-50 hover:shadow-sm'
                    } ${isCogsListRow(expense) ? 'bg-slate-50/40' : ''}`}
                    title={
                      isCogsListRow(expense)
                        ? 'COGS from a sale: remove via Delete to post a reversing GL entry (original journal kept for audit).'
                        : undefined
                    }
                    onClick={() => handleExpenseSelect(expense)}
                  >
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 max-w-sm">
                      <div className="flex items-start gap-2">
                        <span
                          className="font-semibold text-gray-900 line-clamp-2"
                          title={expense.description || expense.id}
                        >
                          {expense.description || '—'}
                        </span>
                        {isCogsListRow(expense) && (
                          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                            COGS
                          </span>
                        )}
                        {expense.isHistorical && (
                          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <History className="w-3 h-3 mr-1" />
                            Historical
                          </span>
                        )}
                      </div>
                    </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex flex-col">
                              <span className={`font-medium ${expense.isHistorical ? 'text-amber-700' : 'text-gray-900'}`}>
                          {expense.date}
                        </span>
                        {expense.isHistorical && expense.historicalDate && expense.historicalDate !== expense.date && (
                                <span className="text-xs text-gray-500 mt-1">
                            Created: {(() => {
                              const date = new Date(expense.createdAt);
                              const day = String(date.getDate()).padStart(2, '0');
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const year = date.getFullYear();
                              return `${day}-${month}-${year}`;
                            })()}
                          </span>
                        )}
                      </div>
                    </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {expense.category}
                            </span>
                    </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                      {expense.merchant || "-"}
                    </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm font-bold text-gray-900">MK {expense.amount}</span>
                            {expense.taxAmount != null && Number(expense.taxAmount) > 0 && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                Net: MK {((typeof expense.amount === 'number' ? expense.amount : parseFloat(String(expense.amount).replace(/,/g, '')) || 0) - Number(expense.taxAmount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Tax: MK {Number(expense.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            )}
                    </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center">
                      <PaymentStatusBadge 
                        paymentStatus={expense.paymentStatus} 
                        paidAmount={expense.paidAmount}
                        totalAmount={expense.amount}
                      />
                    </td>
                    {!showDeletedExpenses && (
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center gap-1">
                          <StatusBadge status={expense.status} />
                          <ReversalStatusBadge status={expense.status} isReversed={expense.isReversed} reversedAt={expense.reversedAt} />
                        </div>
                      </td>
                    )}
                    {showDeletedExpenses && (
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600 font-medium">
                        {(() => {
                          const date = new Date(expense.deletedAt);
                          const day = String(date.getDate()).padStart(2, '0');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const year = date.getFullYear();
                          return `${day}-${month}-${year}`;
                        })()}
                      </td>
                    )}
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-center items-center gap-2">
                        {isCogsListRow(expense) ? (
                          expense.attachments?.length > 0 ? (
                            <button
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center text-sm transition-all rounded-lg px-2 py-1.5 font-medium"
                              onClick={() => viewReceipts(expense)}
                              title={
                                expense.attachments[0]?.name ||
                                'View linked invoice / POS receipt'
                              }
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 italic">N/A</span>
                          )
                        ) : expense.attachments && expense.attachments.length > 0 ? (
                          <>
                            <button 
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center text-sm transition-all rounded-lg px-2 py-1.5 font-medium"
                              onClick={() => viewReceipts(expense)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline">View ({expense.attachments.length})</span>
                                    <span className="sm:hidden">{expense.attachments.length}</span>
                            </button>
                            {!showDeletedExpenses && pagePermissions.canUpdateExpenses && (
                              <button 
                                      className="text-green-600 hover:text-green-800 hover:bg-green-50 transition-all rounded-lg p-1.5"
                                onClick={() => openUploadModal(expense)}
                                title="Add more receipts"
                              >
                                <PlusCircle className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          !showDeletedExpenses && pagePermissions.canUpdateExpenses && (
                            <button 
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center text-sm transition-all rounded-lg px-2 py-1.5 font-medium"
                              onClick={() => openUploadModal(expense)}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline">Add Receipt</span>
                                    <span className="sm:hidden">Add</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1 sm:gap-2">
                        {!showDeletedExpenses ? (
                          <>
                            {/* Payment actions only for real expenses (not synthetic COGS rows) */}
                            {!isCogsListRow(expense) && (
                              <button 
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all rounded-lg p-2"
                              title="View Payment History"
                              onClick={() => togglePaymentHistory(expense)}
                            >
                                <FileText size={18} />
                            </button>
                            )}

                            {/* Record Payment Button - only when Pending/Partially */}
                            {isEligibleForPartialPayment(expense) && (
                              <button
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all rounded-lg p-2"
                                title="Record Payment"
                                onClick={() => handlePartialPayment(expense)}
                              >
                                <DollarSign size={18} />
                              </button>
                            )}
                            
                            {pagePermissions.canUpdateExpenses && (
                              <button 
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all rounded-lg p-2"
                                title="View Expense Details"
                                onClick={() => handleViewExpense(expense)}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {pagePermissions.canUpdateExpenses && !isCogsListRow(expense) && (
                              <button 
                                  className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 transition-all rounded-lg p-2"
                                title="Edit Expense"
                                onClick={() => handleEditExpense(expense)}
                              >
                                  <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {pagePermissions.canDeleteExpenses && (
                              <button 
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all rounded-lg p-2"
                                title={isCogsListRow(expense) ? "Remove COGS entry" : "Delete Expense"}
                                onClick={() => handleDeleteExpense(expense.id)}
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <button 
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 transition-all rounded-lg p-2"
                            title="Restore Expense"
                            onClick={() => handleRestoreExpense(expense.id)}
                          >
                              <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && expenses.length > 0 && (
            <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100/50 flex flex-col sm:flex-row items-center justify-between border-t border-gray-100/50 gap-4">
              <div className="text-sm text-gray-700 order-2 sm:order-1 font-medium">
                Showing <span className="text-gray-900">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</span> of <span className="text-gray-900">{pagination.totalCount}</span> expenses
            </div>
              <div className="flex items-center gap-2 order-1 sm:order-2">
              <button 
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm" 
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </button>
                <div className="flex gap-1">
              {[...Array(pagination.totalPages).keys()].map(page => (
                <button 
                  key={page + 1}
                      className={`px-3 py-2 border-2 rounded-lg text-sm font-medium transition-all ${
                        pagination.page === page + 1 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm'
                  }`}
                  onClick={() => handlePageChange(page + 1)}
                >
                  {page + 1}
                </button>
              ))}
                </div>
              <button 
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm" 
                disabled={pagination.page === pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

            {/* Statistics Section */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold flex items-center text-gray-900">
                    <div className="rounded-lg bg-blue-100 p-2 mr-3">
                      <BarChart className="w-6 h-6 text-blue-600" />
                    </div>
              Expense by Category
            </h2>
            {statistics.byCategory.length > categoryPagination.itemsPerPage && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePreviousPage}
                  className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm text-gray-600">
                  {categoryPagination.currentPage} of {getTotalPages()}
                </span>
                <button
                  onClick={handleNextPage}
                  className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {getCurrentPageCategories().map(category => (
                    <div key={category.category} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-gray-900">{category.category}</span>
                        <span className="font-bold text-gray-700">MK {category.amount} <span className="text-gray-500 font-normal">({category.percentage}%)</span></span>
                </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${category.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
            
            {statistics.byCategory.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <BarChart className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No expense data available</p>
              </div>
            )}
          </div>
        </div>
        
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 p-6">
                <h2 className="text-xl font-bold mb-6 text-gray-900 flex items-center">
                  <div className="rounded-lg bg-green-100 p-2 mr-3">
                    <RefreshCw className="w-6 h-6 text-green-600" />
                  </div>
                  Recurring Expenses
                </h2>
          
                {/* Create Recurring Expense Button */}
                {pagePermissions.canCreateExpenses && (
                  <div className="mb-6">
                    <button
                      onClick={handleRecurringExpense}
                      className="inline-flex items-center px-5 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
                    >
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Create Recurring Expense
                    </button>
              </div>
            )}
            
          {/* Recurring Expenses List */}
          <div className="space-y-4">
            {isLoadingRecurringExpenses ? (
              <div className="text-center py-8 text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p>Loading recurring expenses...</p>
              </div>
            ) : recurringExpenses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <RefreshCw className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No recurring expenses found. Create one to get started.</p>
              </div>
            ) : (
              <>
                {/* Show first 3 recurring expenses */}
                {recurringExpenses.slice(0, 3).map((expense) => (
                  <div
                    key={expense.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h3 className="font-semibold text-gray-900 mr-2">{expense.description}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            expense.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : expense.status === 'paused'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {expense.status || 'active'}
                          </span>
                  </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Amount:</span> {expense.amount}
                </div>
                          <div>
                            <span className="font-medium">Category:</span> {expense.category}
              </div>
                          <div>
                            <span className="font-medium">Frequency:</span> {expense.frequency}
                  </div>
                          <div>
                            <span className="font-medium">Next Run:</span> {expense.nextRunDate || 'N/A'}
                </div>
              </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleViewRecurringExpense(expense)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {pagePermissions.canUpdateExpenses && (
                          <button
                            onClick={() => handleEditRecurringExpense(expense)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {pagePermissions.canDeleteExpenses && (
                          <button
                            onClick={() => handleDeleteRecurringExpense(expense)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                  </div>
                </div>
                  </div>
                ))}

                {/* View All Button if more than 3 */}
                {recurringExpenses.length > 3 && (
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setViewAllRecurringExpensesModalOpen(true)}
                      className="w-full py-2 px-4 text-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                    >
                      View All ({recurringExpenses.length} recurring expenses)
                    </button>
              </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {/* Hidden file input */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*,.pdf"
        capture="environment" // Enable camera on mobile
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Upload Receipt Modal */}
     {uploadModalOpen && (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4 ">
    <div 
      className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-fadeInUp"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-5 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold flex items-center">
            <Paperclip className="w-5 h-5 mr-2 text-blue-600" />
            {isScanning ? "Scanning Receipt..." : "Upload Receipts"}
            {selectedExpense && !isScanning && (
              <span className="ml-2 text-sm text-gray-500">for {selectedExpense.id}</span>
            )}
          </h3>
          <button 
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
            onClick={() => setUploadModalOpen(false)}
            disabled={isScanning}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      <div className="p-5">
        {isScanning ? (
          <ReceiptScanningStatus progress={scanningProgress} />
        ) : (
          <>
            {/* Drag & Drop Area */}
            <div 
              className={`border-2 border-dashed rounded-lg p-8 mb-4 text-center cursor-pointer transition-all ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
            >
              <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="text-lg font-medium mb-1">Drag & drop files here</p>
              <p className="text-sm text-gray-500 mb-3">or click to browse files</p>
              <p className="text-xs text-gray-400">Supports: JPG, PNG, PDF (Max 10MB per file)</p>
            </div>
              
              {/* File Previews */}
              {uploadedFiles.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Uploaded Files ({uploadedFiles.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto p-1 rounded-md">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center bg-gray-50 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="flex-shrink-0 mr-3 text-gray-500">
                          {getFileIcon(file.type)}
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{file.size}</p>
                        </div>
                        {file.previewUrl && (
                          <div className="flex-shrink-0 w-12 h-12 rounded border bg-white p-1 mr-2 overflow-hidden">
                            <img 
                              src={file.previewUrl} 
                              alt="Preview" 
                              className="w-full h-full object-cover rounded"
                            />
                          </div>
                        )}
                        <button 
                          className="flex-shrink-0 ml-2 text-red-500 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.id);
                          }}
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* If no expense selected, show create new expense option */}
              {!selectedExpense && (
                <div className="mb-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0 mr-3" />
                    <div>
                      <h4 className="font-medium mb-1">No expense selected</h4>
                      <p className="text-sm text-gray-600 mb-2">You can:</p>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input 
                            type="radio" 
                            name="expenseOption" 
                            className="mr-2 h-4 w-4 text-blue-600" 
                            defaultChecked 
                          />
                          <span>Create new expense from these receipts</span>
                        </label>
                        <label className="flex items-center">
                          <input 
                            type="radio" 
                            name="expenseOption" 
                            className="mr-2 h-4 w-4 text-blue-600" 
                          />
                          <span>Attach to an existing expense</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              </>
        )}
      </div>
      
      <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
        <button 
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
          onClick={() => setUploadModalOpen(false)}
          disabled={isScanning}
        >
          Cancel
        </button>
        {!isScanning && (
          <button 
            className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center ${
              (uploadedFiles.length === 0 || isUploading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={uploadedFiles.length === 0 || isUploading}
            onClick={completeUpload}
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {selectedExpense ? "Attach to Expense" : "Create Expense with Receipts"}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  </div>
)}

      {/* Receipt Viewer Modal */}
      {viewReceiptModalOpen && selectedExpense && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold flex items-center">
                  <Receipt className="w-5 h-5 mr-2 text-blue-600" />
                  Receipts for {selectedExpense.id}
                  <span className="ml-2 text-sm text-gray-500">
                    ({selectedExpense.attachments.length} {selectedExpense.attachments.length === 1 ? 'receipt' : 'receipts'})
                  </span>
                </h3>
                <div className="flex items-center space-x-2">
                  <button 
                    className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md flex items-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    onClick={() => openUploadModal(selectedExpense)}
                  >
                    <PlusCircle className="w-4 h-4 mr-1.5" />
                    Add More
                  </button>
                  <button 
                    className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
                    onClick={() => setViewReceiptModalOpen(false)}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedExpense.attachments.map((attachment) => (
                  <div key={attachment.id} className="border rounded-lg overflow-hidden bg-gray-50 shadow-sm hover:shadow transition-shadow">
                    <div className="p-3 border-b bg-white flex justify-between items-center">
                      <div className="truncate mr-2 flex items-center">
                        {getFileIcon(attachment.type)}
                        <span className="font-medium ml-2 text-sm">{attachment.name}</span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {/* <button 
                          className="text-blue-600 hover:text-blue-800 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full" 
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button> */}
                        <button
                            type="button"
                            onClick={() => downloadExpenseAttachment(attachment)}
                            className="text-blue-600 hover:text-blue-800 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
                            title="Download"
                          >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-800 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full" 
                          title="Delete"
                          onClick={() => handleDeleteAttachment(selectedExpense.id, attachment.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div 
                      className="h-40 p-4 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => openAttachmentPreview(attachment)}
                    >
                      {attachment.type && attachment.type.startsWith('image/') ? (
                        attachment.url ? (
                          <div className="relative group">
                            <img 
                              src={attachment.url} 
                              alt={attachment.name} 
                              className="max-h-full max-w-full object-contain rounded"
                            />
                            <div className="absolute inset-0 flex items-center justify-center group-hover:bg-black group-hover:bg-opacity-30 transition-all opacity-0 group-hover:opacity-100 rounded">
                              <ExternalLink className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="text-center group">
                            <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                            <p className="text-sm text-gray-500">Image preview</p>
                          </div>
                        )
                      ) : attachment.type && attachment.type.includes('pdf') ? (
                        <div className="text-center group">
                          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          <p className="text-sm text-gray-500">PDF document</p>
                        </div>
                      ) : (
                        <div className="text-center group">
                          <File className="w-12 h-12 mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          <p className="text-sm text-gray-500">Document</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="px-3 py-2 bg-white text-xs text-gray-500 flex justify-between">
                      <span>{attachment.size}</span>
                      <span>Uploaded: {attachment.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                onClick={() => setViewReceiptModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Receipt Preview */}
      {selectedPreviewOpen && selectedAttachment && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 cursor-zoom-out " 
          style={{zIndex: 9999}}
          onClick={() => setSelectedPreviewOpen(false)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white rounded-full z-10"
            onClick={() => setSelectedPreviewOpen(false)}
          >
            <X className="w-8 h-8" />
          </button>
          
          <div 
            className="w-full max-w-4xl max-h-[90vh] flex items-center justify-center animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedAttachment.type && selectedAttachment.type.startsWith('image/') && selectedAttachment.url ? (
              <img 
                src={selectedAttachment.url} 
                alt={selectedAttachment.name} 
                className="max-h-full max-w-full object-contain rounded shadow-xl"
              />
            ) : selectedAttachment.type && selectedAttachment.type.includes('pdf') ? (
              <div className="bg-white p-12 rounded-lg shadow-xl text-center">
                <FileText className="w-24 h-24 mx-auto mb-4 text-blue-500" />
                <h3 className="text-xl font-bold mb-2">{selectedAttachment.name}</h3>
                <p className="text-gray-600 mb-6">PDF documents cannot be previewed here</p>
                <button
                  type="button"
                  onClick={() => downloadExpenseAttachment(selectedAttachment)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center mx-auto inline-flex"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download PDF
                </button>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-lg shadow-xl text-center">
                <File className="w-24 h-24 mx-auto mb-4 text-blue-500" />
                <h3 className="text-xl font-bold mb-2">{selectedAttachment.name}</h3>
                <p className="text-gray-600 mb-6">This file type cannot be previewed</p>
                <button
                  type="button"
                  onClick={() => downloadExpenseAttachment(selectedAttachment)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center mx-auto inline-flex"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download File
                </button>
              </div>
            )}
          </div>
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white px-4 py-2 rounded-full text-sm bg-black bg-opacity-50">
            {selectedAttachment.name} ({selectedAttachment.size})
          </div>
        </div>
      )}

      {/* Modals - Outside mainTab sections but inside p-4 div */}
      {/* Expense Modal */}
      <ExpenseModal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        expense={selectedExpenseForModal}
        mode={expenseModalMode}
        title={
          expenseModalMode === "create"
            ? "Create New Expense"
            : expenseModalMode === "edit"
              ? "Edit Expense"
              : selectedExpenseForModal?.displayTitle ||
                selectedExpenseForModal?.description ||
                "Expense Details"
        }
        onSubmit={handleExpenseSubmit}
        onDelete={handleDeleteExpense}
        isLoading={isSubmitting}
        categories={categories}
      />
      <RecurringExpenseModal
        isOpen={recurringExpenseModalOpen}
        onClose={() => {
          setRecurringExpenseModalOpen(false);
          setEditingRecurringExpense(null);
        }}
        onSubmit={handleRecurringExpenseSubmit}
        categories={categories}
        isLoading={isSubmittingRecurring}
        initialData={editingRecurringExpense}
      />

      {/* View All Recurring Expenses Modal */}
      {viewAllRecurringExpensesModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold flex items-center">
                <RefreshCw className="w-5 h-5 mr-2 text-green-600" />
                All Recurring Expenses ({recurringExpenses.length})
              </h3>
              <div className="flex items-center gap-2">
                {pagePermissions.canExportExpenses && (
                  <button
                    onClick={handleExportRecurringExpenses}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </button>
                )}
                <button
                  onClick={() => setViewAllRecurringExpensesModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
              {isLoadingRecurringExpenses ? (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p>Loading recurring expenses...</p>
                </div>
              ) : recurringExpenses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCw className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No recurring expenses found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recurringExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h3 className="font-semibold text-gray-900 mr-2">{expense.description}</h3>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              expense.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : expense.status === 'paused'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {expense.status || 'active'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mb-2">
                            <div>
                              <span className="font-medium">Amount:</span> {expense.amount}
                            </div>
                            <div>
                              <span className="font-medium">Category:</span> {expense.category}
                            </div>
                            <div>
                              <span className="font-medium">Frequency:</span> {expense.frequency}
                            </div>
                            <div>
                              <span className="font-medium">Next Run:</span> {expense.nextRunDate || 'N/A'}
                            </div>
                          </div>
                          {expense.notes && (
                            <p className="text-sm text-gray-500 mt-2">{expense.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              handleViewRecurringExpense(expense);
                              setViewAllRecurringExpensesModalOpen(false);
                            }}
                            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center"
                            title="View"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </button>
                          {pagePermissions.canUpdateExpenses && (
                            <button
                              onClick={() => {
                                handleEditRecurringExpense(expense);
                                setViewAllRecurringExpensesModalOpen(false);
                              }}
                              className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </button>
                          )}
                          {pagePermissions.canDeleteExpenses && (
                            <button
                              onClick={() => handleDeleteRecurringExpense(expense)}
                              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Recurring Expense Details Modal */}
      {viewRecurringExpenseModalOpen && selectedRecurringExpense && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold flex items-center">
                <RefreshCw className="w-5 h-5 mr-2 text-green-600" />
                Recurring Expense Details
              </h3>
              <button
                onClick={() => {
                  setViewRecurringExpenseModalOpen(false);
                  setSelectedRecurringExpense(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
              {isLoadingRecurringExpenseDetails ? (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p>Loading details...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-4">Basic Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Description</label>
                        <p className="text-gray-900 mt-1">{selectedRecurringExpense.description}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Amount</label>
                        <p className="text-gray-900 mt-1 font-semibold">
                          {typeof selectedRecurringExpense.amount === 'string' 
                            ? selectedRecurringExpense.amount 
                            : selectedRecurringExpense.amount?.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }) || '0.00'} MWK
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Category</label>
                        <p className="text-gray-900 mt-1">{selectedRecurringExpense.category}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <p className="mt-1">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            selectedRecurringExpense.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : selectedRecurringExpense.status === 'paused'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {selectedRecurringExpense.status || 'active'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-4">Schedule Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Frequency</label>
                        <p className="text-gray-900 mt-1 capitalize">{selectedRecurringExpense.frequency}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Start Date</label>
                        <p className="text-gray-900 mt-1">
                          {selectedRecurringExpense.startDate 
                            ? new Date(selectedRecurringExpense.startDate).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      </div>
                      {selectedRecurringExpense.endDate && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">End Date</label>
                          <p className="text-gray-900 mt-1">
                            {new Date(selectedRecurringExpense.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {selectedRecurringExpense.occurrences && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Total Occurrences</label>
                          <p className="text-gray-900 mt-1">{selectedRecurringExpense.occurrences}</p>
                        </div>
                      )}
                      {selectedRecurringExpense.remainingOccurrences !== null && selectedRecurringExpense.remainingOccurrences !== undefined && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Remaining Occurrences</label>
                          <p className="text-gray-900 mt-1">{selectedRecurringExpense.remainingOccurrences}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-500">Next Run Date</label>
                        <p className="text-gray-900 mt-1">
                          {selectedRecurringExpense.nextRunDate 
                            ? new Date(selectedRecurringExpense.nextRunDate).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      </div>
                      {selectedRecurringExpense.lastRunDate && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Last Run Date</label>
                          <p className="text-gray-900 mt-1">
                            {new Date(selectedRecurringExpense.lastRunDate).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {selectedRecurringExpense.frequency === 'monthly' && selectedRecurringExpense.dayOfMonth && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Day of Month</label>
                          <p className="text-gray-900 mt-1">{selectedRecurringExpense.dayOfMonth}</p>
                        </div>
                      )}
                      {selectedRecurringExpense.frequency === 'weekly' && selectedRecurringExpense.dayOfWeek !== null && selectedRecurringExpense.dayOfWeek !== undefined && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Day of Week</label>
                          <p className="text-gray-900 mt-1">
                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selectedRecurringExpense.dayOfWeek]}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedRecurringExpense.notes && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                      <p className="text-gray-700">{selectedRecurringExpense.notes}</p>
                    </div>
                  )}

                  {/* History */}
                  {selectedRecurringExpense.history && selectedRecurringExpense.history.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-4">Execution History</h4>
                      <div className="space-y-2">
                        {selectedRecurringExpense.history.map((entry, index) => (
                          <div key={entry.id || index} className="bg-white rounded p-3 border border-gray-200">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  Scheduled: {new Date(entry.scheduledDate).toLocaleDateString()}
                                </p>
                                {entry.processedDate && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Processed: {new Date(entry.processedDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                entry.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : entry.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {entry.status || 'pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Created By */}
                  {selectedRecurringExpense.createdBy && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Created By</h4>
                      <p className="text-gray-700">{selectedRecurringExpense.createdBy.name}</p>
                      {selectedRecurringExpense.createdAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(selectedRecurringExpense.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setViewRecurringExpenseModalOpen(false);
                  setSelectedRecurringExpense(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              {pagePermissions.canUpdateExpenses && (
                <button
                  onClick={() => {
                    setViewRecurringExpenseModalOpen(false);
                    handleEditRecurringExpense(selectedRecurringExpense);
                  }}
                  className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ReceiptVerificationModal
        isOpen={receiptVerifyModalOpen}
        onClose={() => {
          setReceiptVerifyModalOpen(false);
          setScannedReceipt(null);
        }}
        receiptData={scannedReceipt}
        onSubmit={handleReceiptVerify}
        isLoading={isSubmitting}
      />
      {/* Deletion Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className={`bg-white rounded-lg shadow-xl w-full ${deleteModalCogsCtx.hasCogs ? 'max-w-lg' : 'max-w-md'}`}
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {deleteModalCogsCtx.hasCogs && deleteType === 'single'
                    ? 'Remove COGS posting'
                    : deleteModalCogsCtx.hasCogs && deleteType === 'batch'
                      ? deleteModalHasMixedBatch
                        ? 'Remove selected items'
                        : `Remove ${deleteModalCogsCtx.cogsRowIds.length} COGS posting(s)`
                      : deleteType === 'single'
                        ? 'Delete expense'
                        : `Delete ${expenseToDelete?.length} expenses`}
                </h3>
                <div className="text-sm text-gray-500 mb-4 text-left space-y-3">
                  {deleteModalCogsCtx.hasCogs ? (
                    <>
                      <p>
                        COGS lines are removed from this list by reversing postings in the general ledger.
                        Choose how far the reversal should go. This cannot be undone from this screen.
                      </p>
                      {deleteModalHasMixedBatch && (
                        <p className="text-gray-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                          Selection includes {deleteModalBatchPartition.cogsIds.length} COGS line(s),{' '}
                          {deleteModalBatchPartition.expenseIds.length} expense(s), and{' '}
                          {deleteModalBatchPartition.salaryAdvanceIds.length} salary advance(s). Expenses
                          will be soft-deleted; salary advances use delete or cancel-with-deductions flow as
                          before.
                        </p>
                      )}
                      <div className="text-left rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                        <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                          COGS reversal scope
                        </p>
                        {deleteModalCogsCtx.hasAnyLinkedSale ? (
                          <>
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="radio"
                                name="cogsRemovalStrategy"
                                className="mt-1 text-red-600 focus:ring-red-500"
                                checked={cogsRemovalStrategy === 'full_sale'}
                                onChange={() => setCogsRemovalStrategy('full_sale')}
                              />
                              <span>
                                <span className="font-medium text-gray-900">Full sale reversal</span>
                                <span className="block text-gray-600 text-xs mt-0.5">
                                  Reverses the linked sale end-to-end (revenue, tax, payments, and related GL).
                                  Recommended when the sale should be unwound, not just cost.
                                </span>
                              </span>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="radio"
                                name="cogsRemovalStrategy"
                                className="mt-1 text-red-600 focus:ring-red-500"
                                checked={cogsRemovalStrategy === 'journal_only'}
                                onChange={() => setCogsRemovalStrategy('journal_only')}
                              />
                              <span>
                                <span className="font-medium text-gray-900">COGS journals only</span>
                                <span className="block text-gray-600 text-xs mt-0.5">
                                  Reverses only the COGS / cost journal lines. Sale revenue and sales tax stay
                                  as posted.
                                </span>
                              </span>
                            </label>
                          </>
                        ) : (
                          <p className="text-sm text-gray-700">
                            These COGS line(s) are not linked to a POS sale ID. Only the COGS journal can be
                            reversed.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p>
                      {deleteType === 'single'
                        ? 'This action will soft delete the expense. You can restore it later from the deleted expenses view.'
                        : `This action will soft delete ${expenseToDelete?.length} expenses. You can restore them later from the deleted expenses view.`}
                    </p>
                  )}
                </div>

                <div className="mb-4 text-left">
                  <label htmlFor="deleteReason" className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for deletion *
                  </label>
                  <textarea
                    id="deleteReason"
                    rows={3}
                    minLength={MIN_EXPENSE_DELETE_REASON_LENGTH}
                    maxLength={1000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder={`At least ${MIN_EXPENSE_DELETE_REASON_LENGTH} characters (required for audit / GL reversal)...`}
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {deleteReason.trim().length}/{MIN_EXPENSE_DELETE_REASON_LENGTH} minimum characters
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteReason('');
                  setExpenseToDelete(null);
                  setCogsRemovalStrategy('full_sale');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                  deleteReason.trim().length >= MIN_EXPENSE_DELETE_REASON_LENGTH
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                onClick={handleConfirmDelete}
                disabled={deleteReason.trim().length < MIN_EXPENSE_DELETE_REASON_LENGTH}
              >
                {deleteModalHasMixedBatch
                  ? 'Confirm removals'
                  : deleteModalCogsCtx.hasCogs
                    ? cogsRemovalStrategy === 'full_sale' && deleteModalCogsCtx.hasAnyLinkedSale
                      ? 'Reverse linked sale(s)'
                      : 'Reverse COGS journals'
                    : deleteType === 'single'
                      ? 'Delete expense'
                      : `Delete ${expenseToDelete?.length} expenses`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restoration Confirmation Modal */}
      {restoreModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <RefreshCw className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {restoreType === 'single' ? 'Restore Expense' : `Restore ${expenseToRestore?.length} Expenses`}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {restoreType === 'single' 
                    ? 'This action will restore the expense and make it active again.'
                    : `This action will restore ${expenseToRestore?.length} expenses and make them active again.`
                  }
                </p>
                
                <div className="mb-4">
                  <label htmlFor="restoreReason" className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for restoration *
                  </label>
                  <textarea
                    id="restoreReason"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Please provide a reason for restoration..."
                    value={restoreReason}
                    onChange={(e) => setRestoreReason(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                onClick={() => {
                  setRestoreModalOpen(false);
                  setRestoreReason('');
                  setExpenseToRestore(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                  restoreReason.trim() 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                onClick={handleConfirmRestore}
                disabled={!restoreReason.trim()}
              >
                {restoreType === 'single' ? 'Restore Expense' : `Restore ${expenseToRestore?.length} Expenses`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      {/* Historical Expense Modal */}
      <HistoricalExpenseModal
        isOpen={historicalExpenseModalOpen}
        onClose={() => setHistoricalExpenseModalOpen(false)}
        onSubmit={handleHistoricalExpenseSubmit}
        isSubmitting={isSubmittingHistorical}
      />

      {/* COGS Settlement Modal */}
      <COGSSettlementModal
        isOpen={cogsSettlementModalOpen}
        onClose={() => setCogsSettlementModalOpen(false)}
        onSettle={handleCogsSettlement}
        isLoading={isSettlingCogs}
        totalCOGS={cogsSummary?.summary?.totalCOGS || 0}
      />


      {/* Partial Payment Modal */}
      <ExpensePartialPaymentModal
        isOpen={partialPaymentModalOpen}
        onClose={() => setPartialPaymentModalOpen(false)}
        expense={selectedExpenseForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Payment History Modal */}
      {showPaymentHistory && selectedExpenseForPayment && !isCogsListRow(selectedExpenseForPayment) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Payment History - Expense: {selectedExpenseForPayment.description}
              </h2>
              <button
                onClick={() => setShowPaymentHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <ExpensePaymentHistory 
                expenseId={selectedExpenseForPayment.id}
                onPaymentAdded={handlePaymentSuccess}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reversal Modal */}
      {/* COGS Tab Content */}
      {mainTab === "cogs" && (
        <div className="space-y-6">
          {/* COGS Success Notification */}
          {cogsSettlementSuccess && (
            <div className="fixed top-6 right-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg z-50 flex items-center animate-fadeIn max-w-md">
              <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <div className="mr-2 flex-grow">
                <p className="font-medium">COGS Settlement Created!</p>
                <p className="text-sm">The settlement has been recorded as an expense.</p>
              </div>
              <button 
                className="text-green-700 hover:text-green-800 flex-shrink-0"
                onClick={() => setCogsSettlementSuccess(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* COGS Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setCogsActiveTab("settlement")}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  cogsActiveTab === "settlement"
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                COGS Total
              </button>
              <button
                onClick={() => setCogsActiveTab("tracking")}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  cogsActiveTab === "tracking"
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="h-4 w-4 mr-2" />
                Product Tracking
              </button>
            </nav>
          </div>


          {/* COGS Total Tab */}
          {cogsActiveTab === "settlement" && (
            <div className="space-y-6">
              {/* Date Filter Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-100 p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Date Range Filter</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={cogsDateRange.startDate}
                      onChange={(e) => setCogsDateRange({ ...cogsDateRange, startDate: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      End Date
                    </label>
                    <input
                      type="date"
                      value={cogsDateRange.endDate}
                      onChange={(e) => setCogsDateRange({ ...cogsDateRange, endDate: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <button
                      onClick={loadCogsData}
                      disabled={isLoadingCogs}
                      className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium shadow-sm hover:shadow-md"
                    >
                      {isLoadingCogs ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Loading...
                        </>
                      ) : (
                        <>
                          <Filter className="w-4 h-4" />
                          Apply Filter
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        setCogsDateRange({
                          startDate: firstDay.toISOString().split('T')[0],
                          endDate: lastDay.toISOString().split('T')[0]
                        });
                      }}
                      className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium text-sm border border-gray-300"
                      title="Reset to current month"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {cogsSummary?.summary?.period && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Showing data for:</span>{' '}
                      {new Date(cogsSummary.summary.period.startDate).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}{' '}
                      to{' '}
                      {new Date(cogsSummary.summary.period.endDate).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Loading State */}
              {isLoadingCogs && (
                <div className="bg-white rounded-lg shadow p-8 flex justify-center items-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading COGS data...</p>
                  </div>
                </div>
              )}

              {/* COGS Content - Only show when not loading */}
              {!isLoadingCogs && (
                <>
                  {/* COGS Total Card */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-6">
                    <div className="bg-blue-100 p-4 rounded-full mr-4">
                      <TrendingUp className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">Accumulative COGS Total</h3>
                      <p className="text-gray-600">Total Cost of Goods Sold from all products</p>
                      {cogsSummary?.summary?.period && (
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(cogsSummary.summary.period.startDate).toLocaleDateString()} - {new Date(cogsSummary.summary.period.endDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Total COGS Amount */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 mb-6">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      MK {(cogsSummary?.summary?.totalCOGS || 0).toLocaleString()}
                    </div>
                    <div className="text-lg text-gray-600 mb-4">Total COGS</div>
                    <div className="text-sm text-gray-500">
                      {cogsSummary?.summary?.transactionCount || 0} sales with COGS
                    </div>
                    {lastRecordedCogsTotal > 0 && (
                      <div className="text-sm text-gray-500 mt-2">
                        Previously recorded: MK {lastRecordedCogsTotal.toLocaleString()}
                      </div>
                    )}
                  </div>


                  {/* Reset Button (for administrators) */}
                  {recordedCogsAmount > 0 && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                          <span className="text-yellow-800 text-sm">
                            Recorded amount: MK {recordedCogsAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                <button
                            onClick={resetRecordedCogsAmount}
                            className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                          >
                            Reset
                          </button>
                          <button
                            onClick={clearAllCogsData}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                          >
                            Clear All
                </button>
              </div>
                      </div>
                      <p className="text-yellow-700 text-xs mt-1">
                        Reset: Re-record same amount | Clear All: Start fresh
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional COGS Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-green-100 p-2 rounded-lg mr-3">
                      <Package className="w-5 h-5 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Products Tracked</h4>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {cogsSummary?.summary?.productCount || 0}
                  </div>
                  <div className="text-sm text-gray-500">Products with COGS data</div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Total COGS</h4>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    MK {cogsSummary?.summary?.totalCOGS?.toLocaleString() || '0.00'}
                  </div>
                  <div className="text-sm text-gray-500">Accumulated from all products</div>
                </div>
              </div>
              </>
              )}
            </div>
          )}

          {/* Product Tracking Tab */}
          {cogsActiveTab === "tracking" && (
            <COGSManagement />
          )}
        </div>
      )}
        </div>
      </div>
      </div>
    </PermissionGuard>
  );
};
const ReceiptVerificationModal = ({ isOpen, onClose, receiptData, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    date: "",
    expenseAccountId: "",
    notes: ""
  });
  const [availableAccounts, setAvailableAccounts] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    const loadAccounts = async () => {
      try {
        const response = await fetch('/api/categories?type=expense');
        if (response.ok) {
          const data = await response.json();
          const raw = Array.isArray(data.categories) ? data.categories : [];
          const seen = new Set();
          const deduped = raw.filter((c) => {
            const id = c?.id ?? c?.accountId;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          setAvailableAccounts(deduped);
        }
      } catch (error) {
        console.error('Error loading expense accounts:', error);
        setAvailableAccounts([]);
      }
    };
    loadAccounts();
  }, [isOpen]);
  // Initialize form data when receipt data changes
  useEffect(() => {
    if (receiptData) {
      setFormData({
        description: receiptData.description || "",
        amount: receiptData.amount?.toString() || "",
        date: receiptData.date || new Date().toISOString().split('T')[0],
        expenseAccountId: receiptData.expenseAccountId || "",
        notes: `Scanned from receipt image`
      });
    }
  }, [receiptData]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedAccount = availableAccounts.find(acc => acc.id === formData.expenseAccountId);
    onSubmit({
      ...formData,
      category: selectedAccount?.name || ""
    });
  };
  
  if (!isOpen || !receiptData) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4 ">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-fadeInUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              Verify Receipt Details
            </h3>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
              onClick={onClose}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1">
            <div className="flex flex-col h-full">
              <p className="text-sm text-gray-500 mb-2">Receipt Image:</p>
              <div className="border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center mb-2 h-64">
                {receiptData.previewUrl ? (
                  <img 
                    src={receiptData.previewUrl} 
                    alt="Receipt" 
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No preview available</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 italic">
                We've scanned your receipt and extracted the details. Please verify and correct if needed.
              </p>
            </div>
          </div>
          
          <div className="md:col-span-1">
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Merchant/Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="text"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expense Category
                </label>
                <select
                  name="expenseAccountId"
                  value={formData.expenseAccountId}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select an expense category</option>
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code ? `${account.code} - ${account.name}` : account.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Create new categories from the main expense form (Create New Expense) using the + button.
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="2"
                  className="w-full p-2 border border-gray-300 rounded-md"
                ></textarea>
              </div>
            </form>
          </div>
        </div>
        
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button 
            type="button"
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>Create Expense</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
const ReceiptScanningStatus = ({ progress }) => {
  // Use useRef to keep track of the previous progress
  const progressRef = useRef(progress);
  // Local state for the displayed progress
  const [displayProgress, setDisplayProgress] = useState(progress < 5 ? 5 : progress);
  
  // Update progress smoothly with useEffect
  useEffect(() => {
    // Only update if progress has increased
    if (progress > progressRef.current) {
      progressRef.current = progress;
      setDisplayProgress(progress);
      
      // Also update the DOM directly as a fallback
      const progressBar = document.getElementById('scan-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
      
      const progressText = document.getElementById('scan-progress-text');
      if (progressText) {
        progressText.innerText = `Progress: ${progress}%`;
      }
    }
  }, [progress]);
  
  // Get step text based on progress percentage
  const getStepText = (p) => {
    if (p < 20) return "Initializing OCR engine...";
    if (p < 40) return "Analyzing image...";
    if (p < 60) return "Recognizing text...";
    if (p < 80) return "Extracting receipt data...";
    return "Finalizing results...";
  };
  
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative w-24 h-24 mb-4">
        <svg className="animate-spin w-24 h-24 text-blue-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Receipt className="w-10 h-10 text-blue-500" />
        </div>
      </div>
      
      <h3 className="text-lg font-medium text-gray-900 mb-2">Scanning Receipt</h3>
      <p className="text-gray-500 mb-4 text-center">
        We're analyzing your receipt to extract merchant, date, and amount information.
        <br />This may take a few moments...
      </p>
      
      <div className="w-full max-w-md bg-gray-200 rounded-full h-2.5 mb-2">
        <div 
          id="scan-progress-bar"
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
          style={{ width: `${displayProgress}%` }}
        ></div>
      </div>
      
      <p className="text-xs text-gray-500">
        <span id="scan-progress-text">Progress: {displayProgress}%</span> - {getStepText(displayProgress)}
      </p>
    </div>
  );
};
export default ExpensesPage;
