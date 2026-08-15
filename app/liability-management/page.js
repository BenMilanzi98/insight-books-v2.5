"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash,
  X,
  Check,
  AlertCircle,
  CreditCard,
  Calendar,
  DollarSign
} from "lucide-react";
import { formatCurrency } from '@/lib/currencyUtils';
import PermissionGuard from "@/components/PermissionGuard";
import { usePaymentAccounts } from "@/hooks/usePaymentAccounts";

const interestTypeOptions = [
  { value: "reducing_balance", label: "Reducing Balance" },
  { value: "one_time", label: "One-time Interest" }
];

const liabilityTypes = [
  { value: "loan", label: "Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "mortgage", label: "Mortgage" },
  { value: "line_of_credit", label: "Line of Credit" },
  { value: "other", label: "Other" }
];

const paymentFrequencies = [
  { value: "one_time", label: "One Time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" }
];

const paymentFrequencyMeta = {
  monthly: { periodsPerYear: 12, monthsPerPeriod: 1 },
  quarterly: { periodsPerYear: 4, monthsPerPeriod: 3 },
  annually: { periodsPerYear: 1, monthsPerPeriod: 12 },
  one_time: { periodsPerYear: 1, monthsPerPeriod: 12 }
};

const addMonths = (date, months) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
};

const calculateTermMonths = (startDate, maturityDate) => {
  if (!startDate || !maturityDate) return null;
  const start = new Date(startDate);
  const end = new Date(maturityDate);
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const totalMonths = years * 12 + months + (end.getDate() >= start.getDate() ? 0 : -1);
  return totalMonths > 0 ? totalMonths : null;
};

const generatePaymentSchedule = (liability) => {
  if (!liability) return [];
  const principal = Number(liability.principalAmount) || 0;
  if (principal <= 0) return [];

  const frequency = liability.paymentFrequency || "monthly";
  const meta = paymentFrequencyMeta[frequency] || paymentFrequencyMeta.monthly;
  const startDate = liability.startDate ? new Date(liability.startDate) : new Date();
  const derivedTermMonths =
    liability.termMonths ||
    calculateTermMonths(liability.startDate, liability.maturityDate) ||
    meta.monthsPerPeriod;

  const periods =
    frequency === "one_time"
      ? 1
      : Math.max(1, Math.round((derivedTermMonths || meta.monthsPerPeriod) / meta.monthsPerPeriod));

  if (liability.interestType === "one_time") {
    const interest = Number(liability.oneTimeInterestAmount) || 0;
    const dueDate = liability.maturityDate ? new Date(liability.maturityDate) : startDate;
    return [
      {
        period: 1,
        dueDate,
        principal,
        interest,
        payment: principal + interest,
        balance: 0
      }
    ];
  }

  const annualRate = (Number(liability.interestRate) || 0) / 100;
  const periodicRate = meta.periodsPerYear ? annualRate / meta.periodsPerYear : 0;

  let payment;
  if (periodicRate === 0) {
    payment = periods ? principal / periods : principal;
  } else {
    const factor = Math.pow(1 + periodicRate, periods);
    payment = principal * (periodicRate * factor) / (factor - 1);
  }

  const schedule = [];
  let balance = principal;

  for (let i = 1; i <= periods; i++) {
    const dueDate = addMonths(startDate, meta.monthsPerPeriod * i);
    const interestPortion = periodicRate > 0 ? balance * periodicRate : 0;
    let principalPortion = payment - interestPortion;

    if (i === periods) {
      principalPortion = balance;
      payment = principalPortion + interestPortion;
      balance = 0;
    } else {
      balance = Math.max(0, balance - principalPortion);
    }

    schedule.push({
      period: i,
      dueDate,
      principal: principalPortion,
      interest: interestPortion,
      payment,
      balance
    });
  }

  return schedule;
};

const summarizeScheduleTotals = (liability) => {
  const schedule = generatePaymentSchedule(liability);
  if (!schedule.length) return null;
  return schedule.reduce(
    (totals, row) => ({
      principal: totals.principal + (row.principal || 0),
      interest: totals.interest + (row.interest || 0),
      total: totals.total + (row.payment || 0)
    }),
    { principal: 0, interest: 0, total: 0 }
  );
};

const toInputDate = (date) => {
  if (!date) return new Date().toISOString().split('T')[0];
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return d.toISOString().split('T')[0];
};

const formatNumberInput = (value) => {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  if (Number.isNaN(num)) return "";
  return num.toFixed(2);
};

const buildLiabilityPayload = (form) => {
  const payload = { ...form };
  payload.principalAmount = parseFloat(payload.principalAmount) || 0;
  payload.termMonths = payload.termMonths ? parseInt(payload.termMonths, 10) : null;
  if (payload.interestType === 'one_time') {
    if (payload.oneTimeInterestMode === 'percentage') {
      const percent = parseFloat(payload.oneTimeInterestPercent) || 0;
      payload.oneTimeInterestAmount = parseFloat(((payload.principalAmount * percent) / 100).toFixed(2)) || 0;
    } else {
      payload.oneTimeInterestAmount = payload.oneTimeInterestAmount ? parseFloat(payload.oneTimeInterestAmount) : 0;
    }
    payload.interestRate = 0;
  } else {
    payload.oneTimeInterestAmount = null;
    let rate = payload.interestRate ? parseFloat(payload.interestRate) : 0;
    if (payload.interestRateMode === 'monthly') {
      rate = rate * 12;
    }
    payload.interestRate = rate;
  }
  delete payload.oneTimeInterestMode;
  delete payload.oneTimeInterestPercent;
  delete payload.interestRateMode;
  return payload;
};

const LiabilityManagement = () => {
  const { paymentAccounts: liabilityPayAccounts, isLoading: liabilityPayAccountsLoading } =
    usePaymentAccounts();

  // State variables
  const [liabilities, setLiabilities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [viewLiability, setViewLiability] = useState(null);
  const [editId, setEditId] = useState(null);
  const [paymentLiability, setPaymentLiability] = useState(null);
  const [paymentEntryMode, setPaymentEntryMode] = useState("custom");
  const [selectedScheduleIndex, setSelectedScheduleIndex] = useState("");
  const paymentSchedule = useMemo(() => generatePaymentSchedule(viewLiability), [viewLiability]);
  const paymentScheduleOptions = useMemo(() => generatePaymentSchedule(paymentLiability), [paymentLiability]);
  const paymentScheduleTotals = useMemo(() => {
    if (!paymentSchedule || paymentSchedule.length === 0) return null;
    return paymentSchedule.reduce(
      (totals, row) => ({
        principal: totals.principal + (row.principal || 0),
        interest: totals.interest + (row.interest || 0),
        payment: totals.payment + (row.payment || 0)
      }),
      { principal: 0, interest: 0, payment: 0 }
    );
  }, [paymentSchedule]);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(10);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Alert state
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("success");
  
  // Form data
  const [liabilityFormData, setLiabilityFormData] = useState({
    name: "",
    description: "",
    categoryId: "",
    liabilityType: "loan",
    principalAmount: "",
    interestRate: "",
    interestType: "reducing_balance",
    interestRateMode: "annual",
    oneTimeInterestMode: "amount",
    oneTimeInterestAmount: "",
    oneTimeInterestPercent: "",
    startDate: new Date().toISOString().split('T')[0],
    maturityDate: "",
    termMonths: "",
    paymentFrequency: "monthly",
    status: "active",
    lender: "",
    accountNumber: "",
    notes: ""
  });
  
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: ""
  });
  
  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentType: "both",
    principalPaid: "",
    interestPaid: "",
    reference: "",
    notes: "",
    paymentMethod: "",
  });
  
  // Fetch categories when component mounts
  useEffect(() => {
    fetchCategories();
  }, []);
  
  // Fetch liabilities when filters change
  useEffect(() => {
    fetchLiabilities();
  }, [page, limit, categoryFilter, statusFilter, typeFilter, searchTerm]);

  useEffect(() => {
    if (!liabilityFormData.startDate || !liabilityFormData.maturityDate) return;
    const derived = calculateTermMonths(liabilityFormData.startDate, liabilityFormData.maturityDate);
    if (derived && liabilityFormData.termMonths !== derived.toString()) {
      setLiabilityFormData((prev) => ({ ...prev, termMonths: derived.toString() }));
    }
  }, [liabilityFormData.startDate, liabilityFormData.maturityDate, liabilityFormData.termMonths]);

  useEffect(() => {
    if (!liabilityFormData.startDate || !liabilityFormData.termMonths) return;
    const months = parseInt(liabilityFormData.termMonths, 10);
    if (!months || Number.isNaN(months)) return;
    const calculated = addMonths(liabilityFormData.startDate, months);
    const formatted = calculated.toISOString().split('T')[0];
    if (liabilityFormData.maturityDate !== formatted) {
      setLiabilityFormData(prev => ({ ...prev, maturityDate: formatted }));
    }
  }, [liabilityFormData.startDate, liabilityFormData.termMonths]);

  useEffect(() => {
    if (liabilityFormData.interestType !== 'one_time') return;
    if (liabilityFormData.oneTimeInterestMode !== 'percentage') return;
    const principal = parseFloat(liabilityFormData.principalAmount) || 0;
    const percent = parseFloat(liabilityFormData.oneTimeInterestPercent) || 0;
    const computed = principal && percent ? (principal * percent) / 100 : 0;
    const formatted = computed ? computed.toFixed(2) : "";
    if (liabilityFormData.oneTimeInterestAmount !== formatted) {
      setLiabilityFormData(prev => ({ ...prev, oneTimeInterestAmount: formatted }));
    }
  }, [
    liabilityFormData.interestType,
    liabilityFormData.oneTimeInterestMode,
    liabilityFormData.oneTimeInterestPercent,
    liabilityFormData.principalAmount,
    liabilityFormData.oneTimeInterestAmount
  ]);

  useEffect(() => {
    if (liabilityFormData.interestType === 'one_time') return;
    if (
      liabilityFormData.oneTimeInterestMode !== 'amount' ||
      liabilityFormData.oneTimeInterestAmount ||
      liabilityFormData.oneTimeInterestPercent
    ) {
      setLiabilityFormData(prev => ({
        ...prev,
        oneTimeInterestMode: "amount",
        oneTimeInterestAmount: "",
        oneTimeInterestPercent: ""
      }));
    }
  }, [liabilityFormData.interestType]);

  useEffect(() => {
    if (liabilityFormData.interestType !== 'reducing_balance') return;
    if (!liabilityFormData.interestRate) return;
    if (!liabilityFormData.interestRateMode) {
      setLiabilityFormData(prev => ({ ...prev, interestRateMode: "annual" }));
    }
  }, [liabilityFormData.interestRate, liabilityFormData.interestType, liabilityFormData.interestRateMode]);

  useEffect(() => {
    setPaymentEntryMode("custom");
    setSelectedScheduleIndex("");
  }, [paymentLiability]);

  useEffect(() => {
    if (!showPaymentModal || !liabilityPayAccounts.length) return;
    setPaymentFormData((prev) => {
      if (prev.paymentMethod && liabilityPayAccounts.some((a) => a.id === prev.paymentMethod)) {
        return prev;
      }
      const def =
        liabilityPayAccounts.find((a) => String(a.accountType).toLowerCase() === "bank") ||
        liabilityPayAccounts.find((a) => a.isActive !== false) ||
        liabilityPayAccounts[0];
      return { ...prev, paymentMethod: def?.id || "" };
    });
  }, [showPaymentModal, liabilityPayAccounts]);
  
  // Fetch categories from API
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/liability-categories');
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }
      
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      setError("Failed to load categories. Please try again later.");
    }
  };
  
  // Fetch liabilities from API
  const fetchLiabilities = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build query params
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: 'startDate',
        sortOrder: 'desc'
      });
      
      // Add search term if provided
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Add category filter if not "all"
      if (categoryFilter !== "all") {
        params.append('categoryId', categoryFilter);
      }
      
      // Add status filter if not "all"
      if (statusFilter !== "all") {
        params.append('status', statusFilter);
      }
      
      // Add type filter if not "all"
      if (typeFilter !== "all") {
        params.append('liabilityType', typeFilter);
      }
      
      const response = await fetch(`/api/liabilities?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch liabilities: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setLiabilities(data.liabilities);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
    } catch (error) {
      console.error("Error fetching liabilities:", error);
      setError("Failed to load liabilities. Please try again later.");
      setLiabilities([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };
  
  // Handle category filter change
  const handleCategoryFilterChange = (e) => {
    setCategoryFilter(e.target.value);
    setPage(1);
  };
  
  // Handle status filter change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };
  
  // Handle type filter change
  const handleTypeFilterChange = (e) => {
    setTypeFilter(e.target.value);
    setPage(1);
  };
  
  // Handle pagination
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };
  
  // Submit liability form
  const handleLiabilitySubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editId ? `/api/liabilities/${editId}` : '/api/liabilities';
      const method = editId ? 'PUT' : 'POST';
      
      const payload = buildLiabilityPayload(liabilityFormData);
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save liability");
      }
      
      // Show success message
      setAlertMessage(`Liability successfully ${editId ? 'updated' : 'created'}`);
      setAlertType("success");
      setShowAlert(true);
      
      // Close modal and refresh liabilities
      setShowLiabilityModal(false);
      fetchLiabilities();
      
      // Reset form
      resetLiabilityForm();
    } catch (error) {
      console.error("Error saving liability:", error);
      setAlertMessage(error.message || "Failed to save liability");
      setAlertType("error");
      setShowAlert(true);
    }
  };

  const handleScheduledPaymentSelection = (value) => {
    setSelectedScheduleIndex(value);
    if (value === "") {
      setPaymentFormData(prev => ({
        ...prev,
        amount: "",
        principalPaid: "",
        interestPaid: ""
      }));
      return;
    }
    const index = parseInt(value, 10);
    if (Number.isNaN(index) || !paymentScheduleOptions[index]) return;
    const entry = paymentScheduleOptions[index];
    setPaymentFormData(prev => ({
      ...prev,
      amount: formatNumberInput(entry.payment),
      principalPaid: formatNumberInput(entry.principal),
      interestPaid: formatNumberInput(entry.interest),
      paymentDate: entry.dueDate ? toInputDate(entry.dueDate) : prev.paymentDate
    }));
  };
  
  // Submit category form
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/liability-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryFormData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create category");
      }
      
      // Show success message
      setAlertMessage("Category successfully created");
      setAlertType("success");
      setShowAlert(true);
      
      // Close modal and refresh categories
      setShowCategoryModal(false);
      fetchCategories();
      
      // Reset form
      setCategoryFormData({ name: "", description: "" });
    } catch (error) {
      console.error("Error creating category:", error);
      setAlertMessage(error.message || "Failed to create category");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Submit payment form
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/liabilities/${paymentLiability.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentFormData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to record payment");
      }
      
      // Show success message
      setAlertMessage("Payment recorded successfully");
      setAlertType("success");
      setShowAlert(true);
      
      // Close modal and refresh liabilities
      setShowPaymentModal(false);
      setPaymentLiability(null);
      fetchLiabilities();
      
      // Reset form
      setPaymentFormData({
        amount: "",
        paymentDate: new Date().toISOString().split('T')[0],
        paymentType: "both",
        principalPaid: "",
        interestPaid: "",
        reference: "",
        notes: "",
        paymentMethod: "",
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      setAlertMessage(error.message || "Failed to record payment");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Reset liability form to initial state
  const resetLiabilityForm = () => {
    setLiabilityFormData({
      name: "",
      description: "",
      categoryId: "",
      liabilityType: "loan",
      principalAmount: "",
      interestRate: "",
      interestType: "reducing_balance",
      interestRateMode: "annual",
      oneTimeInterestMode: "amount",
      oneTimeInterestAmount: "",
      oneTimeInterestPercent: "",
      startDate: new Date().toISOString().split('T')[0],
      maturityDate: "",
      termMonths: "",
      paymentFrequency: "monthly",
      status: "active",
      lender: "",
      accountNumber: "",
      notes: ""
    });
    setEditId(null);
  };
  
  // View liability details
  const handleViewLiability = async (liability) => {
    try {
      const response = await fetch(`/api/liabilities/${liability.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch liability details');
      }
      const data = await response.json();
      setViewLiability(data.liability);
      setShowViewModal(true);
    } catch (error) {
      console.error("Error fetching liability details:", error);
      setAlertMessage("Failed to load liability details");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Edit liability
  const handleEditLiability = (liability) => {
    setLiabilityFormData({
      name: liability.name,
      description: liability.description || "",
      categoryId: liability.categoryId,
      liabilityType: liability.liabilityType,
      principalAmount: liability.principalAmount.toString(),
      interestRate: liability.interestRate ? liability.interestRate.toString() : "",
      interestType: liability.interestType || "reducing_balance",
      interestRateMode: "annual",
      oneTimeInterestMode: "amount",
      oneTimeInterestAmount: liability.oneTimeInterestAmount ? liability.oneTimeInterestAmount.toString() : "",
      oneTimeInterestPercent:
        liability.interestType === 'one_time' && liability.principalAmount
          ? (((liability.oneTimeInterestAmount || 0) / liability.principalAmount) * 100).toFixed(4)
          : "",
      startDate: new Date(liability.startDate).toISOString().split('T')[0],
      maturityDate: liability.maturityDate ? new Date(liability.maturityDate).toISOString().split('T')[0] : "",
      termMonths: liability.termMonths ? liability.termMonths.toString() : "",
      paymentFrequency: liability.paymentFrequency || "monthly",
      status: liability.status,
      lender: liability.lender || "",
      accountNumber: liability.accountNumber || "",
      notes: liability.notes || ""
    });
    setEditId(liability.id);
    setShowLiabilityModal(true);
  };
  
  // Delete liability
  const handleDeleteLiability = async (liabilityId) => {
    if (!confirm("Are you sure you want to delete this liability? This action cannot be undone.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/liabilities/${liabilityId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete liability");
      }
      
      // Show success message
      setAlertMessage("Liability successfully deleted");
      setAlertType("success");
      setShowAlert(true);
      
      // Refresh liabilities
      fetchLiabilities();
    } catch (error) {
      console.error("Error deleting liability:", error);
      setAlertMessage(error.message || "Failed to delete liability");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Record payment
  const handleRecordPayment = (liability) => {
    setPaymentLiability(liability);
    setPaymentEntryMode("custom");
    setSelectedScheduleIndex("");
    setPaymentFormData({
      amount: "",
      paymentDate: new Date().toISOString().split('T')[0],
      paymentType: "both",
      principalPaid: "",
      interestPaid: "",
      reference: "",
      notes: "",
      paymentMethod: "",
    });
    setShowPaymentModal(true);
  };
  
  const statusOptions = ["all", "active", "paid_off", "defaulted"];
  
  return (
    <PermissionGuard
      permissions={["accounts.view", "journalEntries.view", "expenses.view"]}
    >
      <div>
        <div className="container mx-auto pb-8">
          {/* Alert message */}
          {showAlert && (
            <div className={`fixed top-4 right-4 p-4 rounded-md shadow-md z-50 ${
              alertType === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}>
              <div className="flex items-center">
                {alertType === "success" ? (
                  <Check className="mr-2 h-5 w-5" />
                ) : (
                  <AlertCircle className="mr-2 h-5 w-5" />
                )}
                <span>{alertMessage}</span>
                <button
                  className="ml-4 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowAlert(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{tt('Liability Management')}</h1>
            <div className="flex space-x-2">
              <button 
                className="btn-secondary flex items-center gap-2 px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
                onClick={() => setShowCategoryModal(true)}
              >
                <Plus size={16} />
                {tt('New Category')}
              </button>
              <button 
                className="btn-primary flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  resetLiabilityForm();
                  setShowLiabilityModal(true);
                }}
              >
                <Plus size={16} />
                {tt('New Liability')}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={tt('Search liabilities...')}
                    className="input-search pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative">
                  <select
                    className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                    value={categoryFilter}
                    onChange={handleCategoryFilterChange}
                  >
                    <option value="all">{tt('All Categories')}</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
                <div className="relative">
                  <select
                    className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                    value={typeFilter}
                    onChange={handleTypeFilterChange}
                  >
                    <option value="all">{tt('All Types')}</option>
                    {liabilityTypes.map(type => (
                      <option key={type.value} value={type.value}>{tt(type.label)}</option>
                    ))}
                  </select>
                  <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
                <div className="relative">
                  <select
                    className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                    value={statusFilter}
                    onChange={handleStatusFilterChange}
                  >
                    {statusOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-700 p-4 rounded-md">
                <p className="flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5" />
                  {error}
                </p>
              </div>
            ) : liabilities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">{tt('No liabilities found. Create your first liability!')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="p-3 font-medium">{tt('Liability Name')}</th>
                      <th className="p-3 font-medium">{tt('Type')}</th>
                      <th className="p-3 font-medium">{tt('Category')}</th>
                      <th className="p-3 font-medium">{tt('Lender')}</th>
                      <th className="p-3 font-medium">{tt('Interest Method')}</th>
                      <th className="p-3 font-medium text-right">{tt('Principal Amount')}</th>
                      <th className="p-3 font-medium text-right">Projected Total (Schedule)</th>
                      <th className="p-3 font-medium text-right">{tt('Current Balance')}</th>
                      <th className="p-3 font-medium text-right">{tt('Total Paid')}</th>
                      <th className="p-3 font-medium">{tt('Status')}</th>
                      <th className="p-3 font-medium text-center">{tt('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liabilities.map((liability) => {
                      const projectedTotals = summarizeScheduleTotals(liability);
                      return (
                        <tr key={liability.id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="p-3 text-blue-600">{liability.name}</td>
                          <td className="p-3">
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              {liabilityTypes.find(t => t.value === liability.liabilityType)?.label || liability.liabilityType}
                            </span>
                          </td>
                          <td className="p-3">{liability.category.name}</td>
                          <td className="p-3">{liability.lender || '-'}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                              {interestTypeOptions.find(opt => opt.value === liability.interestType)?.label || 'Reducing Balance'}
                            </span>
                          </td>
                          <td className="p-3 text-right">{formatCurrency(liability.principalAmount)}</td>
                          <td className="p-3 text-right">
                            {projectedTotals
                              ? formatCurrency(projectedTotals.total)
                              : formatCurrency(liability.principalAmount)}
                          </td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(liability.currentBalance)}</td>
                          <td className="p-3 text-right">{formatCurrency(liability.totalPaid)}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              liability.status === "active" 
                                ? "bg-green-100 text-green-800" 
                                : liability.status === "paid_off"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {liability.status === 'paid_off' ? 'Paid Off' : liability.status === 'defaulted' ? 'Defaulted' : liability.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center space-x-2">
                              <button 
                                className="text-blue-600 hover:text-blue-800"
                                onClick={() => handleViewLiability(liability)}
                                title="View details"
                              >
                                <Eye size={16} />
                              </button>
                              <button 
                                className="text-orange-600 hover:text-orange-800"
                                onClick={() => handleEditLiability(liability)}
                                title="Edit liability"
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                className="text-green-600 hover:text-green-800"
                                onClick={() => handleRecordPayment(liability)}
                                title="Record payment"
                                disabled={liability.status === 'paid_off'}
                              >
                                <DollarSign size={16} />
                              </button>
                              <button 
                                className="text-red-600 hover:text-red-800"
                                onClick={() => handleDeleteLiability(liability.id)}
                                title="Delete liability"
                              >
                                <Trash size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoading && !error && liabilities.length > 0 && (
              <div className="mt-6 flex justify-between items-center text-sm text-gray-500">
                <div>Showing {liabilities.length} of {totalCount} liabilities</div>
                <div className="flex items-center space-x-2">
                  <button 
                    className={`px-3 py-1 border border-gray-200 rounded ${page === 1 ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                  >
                    {tt('Previous')}
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
                    const pageNumber = page > 2 ? page - 2 + index : index + 1;
                    if (pageNumber <= totalPages) {
                      return (
                        <button
                          key={pageNumber}
                          className={`px-3 py-1 rounded ${
                            pageNumber === page
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-200 hover:bg-gray-50'
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
                    className={`px-3 py-1 border border-gray-200 rounded ${page === totalPages ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                  >
                    {tt('Next')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* New/Edit Liability Modal */}
          {showLiabilityModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{editId ? 'Edit Liability' : 'New Liability'}</h2>
                    <button 
                      onClick={() => {
                        setShowLiabilityModal(false);
                        resetLiabilityForm();
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <form onSubmit={handleLiabilitySubmit}>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Liability Name *')}</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.name}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, name: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Category *')}</label>
                        <select
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.categoryId}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, categoryId: e.target.value})}
                          required
                        >
                          <option value="">{tt('Select Category')}</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Liability Type *')}</label>
                        <select
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.liabilityType}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, liabilityType: e.target.value})}
                          required
                        >
                          {liabilityTypes.map(type => (
                            <option key={type.value} value={type.value}>{tt(type.label)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Status')}</label>
                        <select
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.status}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, status: e.target.value})}
                        >
                          <option value="active">{tt('Active')}</option>
                          <option value="paid_off">{tt('Paid Off')}</option>
                          <option value="defaulted">{tt('Defaulted')}</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Description')}</label>
                      <textarea
                        className="w-full p-2 border border-gray-200 rounded"
                        rows="2"
                        value={liabilityFormData.description}
                        onChange={(e) => setLiabilityFormData({...liabilityFormData, description: e.target.value})}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Principal Amount *')}</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.principalAmount}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, principalAmount: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Interest Method')}</label>
                        <select
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.interestType}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, interestType: e.target.value})}
                        >
                          {interestTypeOptions.map(option => (
                            <option key={option.value} value={option.value}>{tt(option.label)}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          {tt('Reducing balance recalculates interest each installment. One-time applies a single upfront charge.')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        {liabilityFormData.interestType === 'one_time' ? (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-sm font-medium mb-1">{tt('One-time Interest Input')}</label>
                              <select
                                className="w-full p-2 border border-gray-200 rounded"
                                value={liabilityFormData.oneTimeInterestMode || "amount"}
                                onChange={(e) => {
                                  const mode = e.target.value;
                                  setLiabilityFormData(prev => ({
                                    ...prev,
                                    oneTimeInterestMode: mode,
                                    oneTimeInterestPercent: mode === 'percentage'
                                      ? (prev.oneTimeInterestPercent || "")
                                      : ""
                                  }));
                                }}
                              >
                                <option value="amount">{tt('Enter amount')}</option>
                                <option value="percentage">{tt('Enter percentage')}</option>
                              </select>
                            </div>
                            {liabilityFormData.oneTimeInterestMode === 'percentage' ? (
                              <div>
                                <label className="block text-sm font-medium mb-1">One-time Interest (%)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full p-2 border border-gray-200 rounded"
                                  value={liabilityFormData.oneTimeInterestPercent || ""}
                                  onChange={(e) => setLiabilityFormData({...liabilityFormData, oneTimeInterestPercent: e.target.value})}
                                  placeholder={tt('e.g. 5')}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  {tt('Converted to MWK automatically based on principal.')}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-sm font-medium mb-1">{tt('One-time Interest Amount')}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full p-2 border border-gray-200 rounded"
                                  value={liabilityFormData.oneTimeInterestAmount}
                                  onChange={(e) => setLiabilityFormData({...liabilityFormData, oneTimeInterestAmount: e.target.value})}
                                  placeholder={tt('Enter agreed interest amount')}
                                />
                              </div>
                            )}
                            {liabilityFormData.oneTimeInterestMode === 'percentage' && (
                              <div className="text-xs text-gray-500">
                                Estimated amount: {formatCurrency((parseFloat(liabilityFormData.oneTimeInterestAmount || 0) || 0))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-sm font-medium mb-1">{tt('Interest Rate Input')}</label>
                              <select
                                className="w-full p-2 border border-gray-200 rounded"
                                value={liabilityFormData.interestRateMode || "annual"}
                                onChange={(e) => setLiabilityFormData({...liabilityFormData, interestRateMode: e.target.value})}
                              >
                                <option value="annual">{tt('Annual percentage rate')}</option>
                                <option value="monthly">{tt('Monthly percentage rate')}</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                {liabilityFormData.interestRateMode === 'monthly'
                                  ? 'Monthly Interest Rate (%)'
                                  : 'Annual Interest Rate (%)'}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                className="w-full p-2 border border-gray-200 rounded"
                                value={liabilityFormData.interestRate}
                                onChange={(e) => setLiabilityFormData({...liabilityFormData, interestRate: e.target.value})}
                                placeholder={liabilityFormData.interestRateMode === 'monthly' ? 'Monthly percentage rate' : 'Annual percentage rate'}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {tt('Monthly rates are converted to an annual APR when calculating the schedule.')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Loan Term (months)</label>
                        <input
                          type="number"
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.termMonths}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, termMonths: e.target.value})}
                          placeholder={tt('Optional')}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {tt('Updates automatically when you adjust the start or maturity date.')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Start Date *')}</label>
                        <input
                          type="date"
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.startDate}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, startDate: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Maturity Date')}</label>
                        <input
                          type="date"
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.maturityDate}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, maturityDate: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Payment Frequency')}</label>
                        <select
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.paymentFrequency}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, paymentFrequency: e.target.value})}
                        >
                          {paymentFrequencies.map(freq => (
                            <option key={freq.value} value={freq.value}>{freq.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{tt('Lender/Creditor')}</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.lender}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, lender: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Account Number')}</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={liabilityFormData.accountNumber}
                        onChange={(e) => setLiabilityFormData({...liabilityFormData, accountNumber: e.target.value})}
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Notes')}</label>
                      <textarea
                        className="w-full p-2 border border-gray-200 rounded"
                        rows="3"
                        value={liabilityFormData.notes}
                        onChange={(e) => setLiabilityFormData({...liabilityFormData, notes: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-200 rounded"
                      onClick={() => {
                        setShowLiabilityModal(false);
                        resetLiabilityForm();
                      }}
                    >
                      {tt('Cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {editId ? 'Update' : 'Create'} Liability
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Category Modal */}
          {showCategoryModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{tt('New Category')}</h2>
                    <button 
                      onClick={() => {
                        setShowCategoryModal(false);
                        setCategoryFormData({ name: "", description: "" });
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <form onSubmit={handleCategorySubmit}>
                  <div className="p-6">
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Category Name *')}</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={categoryFormData.name}
                        onChange={(e) => setCategoryFormData({...categoryFormData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Description')}</label>
                      <textarea
                        className="w-full p-2 border border-gray-200 rounded"
                        rows="3"
                        value={categoryFormData.description}
                        onChange={(e) => setCategoryFormData({...categoryFormData, description: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-200 rounded"
                      onClick={() => {
                        setShowCategoryModal(false);
                        setCategoryFormData({ name: "", description: "" });
                      }}
                    >
                      {tt('Cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {tt('Create Category')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* View Liability Modal */}
          {showViewModal && viewLiability && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{tt('Liability Details')}</h2>
                    <button 
                      onClick={() => {
                        setShowViewModal(false);
                        setViewLiability(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-2">{tt('Basic Information')}</h3>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">{tt('Name:')}</span> {viewLiability.name}</div>
                        <div><span className="font-medium">{tt('Type:')}</span> {liabilityTypes.find(t => t.value === viewLiability.liabilityType)?.label || viewLiability.liabilityType}</div>
                        <div><span className="font-medium">{tt('Category:')}</span> {viewLiability.category.name}</div>
                        <div><span className="font-medium">{tt('Status:')}</span> 
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                            viewLiability.status === "active" 
                              ? "bg-green-100 text-green-800" 
                              : viewLiability.status === "paid_off"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {viewLiability.status === 'paid_off' ? 'Paid Off' : viewLiability.status === 'defaulted' ? 'Defaulted' : viewLiability.status}
                          </span>
                        </div>
                        {viewLiability.description && (
                          <div><span className="font-medium">{tt('Description:')}</span> {viewLiability.description}</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">{tt('Financial Information')}</h3>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">{tt('Principal Amount:')}</span> {formatCurrency(viewLiability.principalAmount)}</div>
                        <div><span className="font-medium">{tt('Current Balance:')}</span> {formatCurrency(viewLiability.currentBalance)}</div>
                        <div><span className="font-medium">{tt('Total Paid:')}</span> {formatCurrency(viewLiability.totalPaid)}</div>
                        <div><span className="font-medium">{tt('Interest Method:')}</span> {interestTypeOptions.find(opt => opt.value === viewLiability.interestType)?.label || 'Reducing Balance'}</div>
                        {viewLiability.interestType === 'one_time' ? (
                          <div><span className="font-medium">{tt('One-time Interest:')}</span> {formatCurrency(viewLiability.oneTimeInterestAmount || 0)}</div>
                        ) : (
                          <div><span className="font-medium">{tt('Interest Rate:')}</span> {viewLiability.interestRate ? `${viewLiability.interestRate}%` : 'N/A'}</div>
                        )}
                        <div><span className="font-medium">{tt('Term Length:')}</span> {viewLiability.termMonths ? `${viewLiability.termMonths} months` : 'N/A'}</div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">{tt('Dates')}</h3>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">{tt('Start Date:')}</span> {(() => {
                          const date = new Date(viewLiability.startDate);
                          const day = String(date.getDate()).padStart(2, '0');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const year = date.getFullYear();
                          return `${day}-${month}-${year}`;
                        })()}</div>
                        {viewLiability.maturityDate && (
                          <div><span className="font-medium">{tt('Maturity Date:')}</span> {(() => {
                            const date = new Date(viewLiability.maturityDate);
                            const day = String(date.getDate()).padStart(2, '0');
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const year = date.getFullYear();
                            return `${day}-${month}-${year}`;
                          })()}</div>
                        )}
                        <div><span className="font-medium">{tt('Payment Frequency:')}</span> {paymentFrequencies.find(f => f.value === viewLiability.paymentFrequency)?.label || viewLiability.paymentFrequency || 'N/A'}</div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">{tt('Additional Information')}</h3>
                      <div className="space-y-2 text-sm">
                        {viewLiability.lender && (
                          <div><span className="font-medium">{tt('Lender:')}</span> {viewLiability.lender}</div>
                        )}
                        {viewLiability.accountNumber && (
                          <div><span className="font-medium">{tt('Account Number:')}</span> {viewLiability.accountNumber}</div>
                        )}
                        {viewLiability.notes && (
                          <div><span className="font-medium">{tt('Notes:')}</span> {viewLiability.notes}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {paymentSchedule && paymentSchedule.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{tt('Projected Payment Schedule')}</h3>
                        {paymentScheduleTotals && (
                          <div className="text-xs text-gray-500">
                            Principal {formatCurrency(paymentScheduleTotals.principal)} · Interest {formatCurrency(paymentScheduleTotals.interest)} · Total {formatCurrency(paymentScheduleTotals.payment)}
                          </div>
                        )}
                      </div>
                      <div className="overflow-x-auto rounded border border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="p-2 font-medium">#</th>
                              <th className="p-2 font-medium">{tt('Due Date')}</th>
                              <th className="p-2 font-medium text-right">{tt('Principal')}</th>
                              <th className="p-2 font-medium text-right">{tt('Interest')}</th>
                              <th className="p-2 font-medium text-right">{tt('Payment')}</th>
                              <th className="p-2 font-medium text-right">{tt('Balance')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentSchedule.map((row) => (
                              <tr key={row.period} className="border-t border-gray-100">
                                <td className="p-2">{row.period}</td>
                                <td className="p-2">{row.dueDate ? (() => {
                                  const date = new Date(row.dueDate);
                                  const day = String(date.getDate()).padStart(2, '0');
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const year = date.getFullYear();
                                  return `${day}-${month}-${year}`;
                                })() : '-'}</td>
                                <td className="p-2 text-right">{formatCurrency(row.principal || 0)}</td>
                                <td className="p-2 text-right">{formatCurrency(row.interest || 0)}</td>
                                <td className="p-2 text-right">{formatCurrency(row.payment || 0)}</td>
                                <td className="p-2 text-right">{formatCurrency(row.balance || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {viewLiability.payments && viewLiability.payments.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold mb-3">{tt('Payment History')}</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="p-2 font-medium">{tt('Date')}</th>
                              <th className="p-2 font-medium text-right">{tt('Amount')}</th>
                              <th className="p-2 font-medium text-right">{tt('Principal')}</th>
                              <th className="p-2 font-medium text-right">{tt('Interest')}</th>
                              <th className="p-2 font-medium">{tt('Reference')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewLiability.payments.map((payment) => (
                              <tr key={payment.id} className="border-t border-gray-200">
                                <td className="p-2">{(() => {
                                  const date = new Date(payment.paymentDate);
                                  const day = String(date.getDate()).padStart(2, '0');
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const year = date.getFullYear();
                                  return `${day}-${month}-${year}`;
                                })()}</td>
                                <td className="p-2 text-right">{formatCurrency(payment.amount)}</td>
                                <td className="p-2 text-right">{formatCurrency(payment.principalPaid)}</td>
                                <td className="p-2 text-right">{formatCurrency(payment.interestPaid)}</td>
                                <td className="p-2">{payment.reference || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                  <button
                    className="px-4 py-2 border border-gray-200 rounded"
                    onClick={() => {
                      setShowViewModal(false);
                      setViewLiability(null);
                    }}
                  >
                    {tt('Close')}
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={() => {
                      setShowViewModal(false);
                      handleEditLiability(viewLiability);
                    }}
                  >
                    {tt('Edit')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment Modal */}
          {showPaymentModal && paymentLiability && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-md">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{tt('Record Payment')}</h2>
                    <button 
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentLiability(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <form onSubmit={handlePaymentSubmit}>
                  <div className="p-6">
                    <div className="mb-4 p-3 bg-gray-50 rounded">
                      <div className="text-sm">
                        <div><span className="font-medium">{tt('Liability:')}</span> {paymentLiability.name}</div>
                        <div><span className="font-medium">{tt('Current Balance:')}</span> {formatCurrency(paymentLiability.currentBalance)}</div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Payment Entry')}</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={paymentEntryMode}
                        onChange={(e) => {
                          const mode = e.target.value;
                          setPaymentEntryMode(mode);
                          if (mode === "custom") {
                            setSelectedScheduleIndex("");
                          }
                        }}
                      >
                        <option value="custom">{tt('Custom amount')}</option>
                        <option value="schedule" disabled={paymentScheduleOptions.length === 0}>
                          {tt('Scheduled installment')}
                        </option>
                      </select>
                    </div>
                    {paymentEntryMode === "schedule" && paymentScheduleOptions.length > 0 && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">{tt('Select Scheduled Installment')}</label>
                        <select
                          className="w-full p-2 border border-gray-200 rounded"
                          value={selectedScheduleIndex}
                          onChange={(e) => handleScheduledPaymentSelection(e.target.value)}
                        >
                          <option value="">{tt('Choose installment')}</option>
                          {paymentScheduleOptions.map((entry, idx) => (
                            <option key={idx} value={idx}>
                              {`#${entry.period} – ${entry.dueDate ? (() => {
                                const date = new Date(entry.dueDate);
                                const day = String(date.getDate()).padStart(2, '0');
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const year = date.getFullYear();
                                return `${day}-${month}-${year}`;
                              })() : 'No date'} – ${formatCurrency(entry.payment || 0)}`}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          {tt('Amount, principal, and interest auto-fill from the selected schedule.')}
                        </p>
                      </div>
                    )}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Pay from account *')}</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={paymentFormData.paymentMethod || ""}
                        onChange={(e) =>
                          setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })
                        }
                        required
                        disabled={liabilityPayAccountsLoading || !liabilityPayAccounts.length}
                      >
                        {!liabilityPayAccounts.length && (
                          <option value="">
                            {liabilityPayAccountsLoading ? "Loading accounts…" : "No payment accounts"}
                          </option>
                        )}
                        {liabilityPayAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                            {acc.accountType ? ` (${acc.accountType})` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {tt('Same payment accounts as /payments/management.')}
                      </p>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Payment Amount *')}</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={paymentFormData.amount}
                        onChange={(e) => setPaymentFormData({...paymentFormData, amount: e.target.value})}
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Payment Date *')}</label>
                      <input
                        type="date"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={paymentFormData.paymentDate}
                        onChange={(e) => setPaymentFormData({...paymentFormData, paymentDate: e.target.value})}
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Payment Type')}</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={paymentFormData.paymentType}
                        onChange={(e) => setPaymentFormData({...paymentFormData, paymentType: e.target.value})}
                      >
                        <option value="both">{tt('Principal + Interest')}</option>
                        <option value="principal">{tt('Principal Only')}</option>
                        <option value="interest">{tt('Interest Only')}</option>
                      </select>
                    </div>
                    {paymentFormData.paymentType === 'both' && (
                      <>
                        <div className="mb-4">
                          <label className="block text-sm font-medium mb-1">{tt('Principal Paid')}</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full p-2 border border-gray-200 rounded"
                            value={paymentFormData.principalPaid}
                            onChange={(e) => setPaymentFormData({...paymentFormData, principalPaid: e.target.value})}
                          />
                        </div>
                        <div className="mb-4">
                          <label className="block text-sm font-medium mb-1">{tt('Interest Paid')}</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full p-2 border border-gray-200 rounded"
                            value={paymentFormData.interestPaid}
                            onChange={(e) => setPaymentFormData({...paymentFormData, interestPaid: e.target.value})}
                          />
                        </div>
                      </>
                    )}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Reference')}</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={paymentFormData.reference}
                        onChange={(e) => setPaymentFormData({...paymentFormData, reference: e.target.value})}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">{tt('Notes')}</label>
                      <textarea
                        className="w-full p-2 border border-gray-200 rounded"
                        rows="2"
                        value={paymentFormData.notes}
                        onChange={(e) => setPaymentFormData({...paymentFormData, notes: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-200 rounded"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentLiability(null);
                      }}
                    >
                      {tt('Cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {tt('Record Payment')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
};

export default LiabilityManagement;

