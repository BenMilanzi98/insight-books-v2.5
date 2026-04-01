"use client";
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
  TrendingDown,
  Calendar,
  CreditCard,
  DollarSign,
  ArrowLeftRight,
} from "lucide-react";
import { formatCurrency } from '@/lib/currencyUtils';
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { paymentMethods } from "@/lib/paymentMethods";

const interestTypeOptions = [
  { value: "reducing_balance", label: "Reducing Balance" },
  { value: "one_time", label: "One-time Interest" }
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

const AssetManagement = () => {
  // Active tab state
  const [activeTab, setActiveTab] = useState("assets");
  
  // Asset state variables
  const [assets, setAssets] = useState([]);
  const [assetCategories, setAssetCategories] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState(null);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showAssetCategoryModal, setShowAssetCategoryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDepreciationModal, setShowDepreciationModal] = useState(false);
  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAsset, setTransferAsset] = useState(null);
  const [transferTargetTenantId, setTransferTargetTenantId] = useState("");
  const [transferTargetCategories, setTransferTargetCategories] = useState([]);
  const [transferCategoryId, setTransferCategoryId] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [userTenants, setUserTenants] = useState([]);
  const [currentTenantId, setCurrentTenantId] = useState(null);
  const [viewAsset, setViewAsset] = useState(null);
  const [assetEditId, setAssetEditId] = useState(null);
  const [disposalAsset, setDisposalAsset] = useState(null);
  
  // Liability state variables
  const [liabilities, setLiabilities] = useState([]);
  const [liabilityCategories, setLiabilityCategories] = useState([]);
  const [liabilitiesLoading, setLiabilitiesLoading] = useState(true);
  const [liabilitiesError, setLiabilitiesError] = useState(null);
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [showLiabilityCategoryModal, setShowLiabilityCategoryModal] = useState(false);
  const [showLiabilityViewModal, setShowLiabilityViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [viewLiability, setViewLiability] = useState(null);
  const [liabilityEditId, setLiabilityEditId] = useState(null);
  const [paymentLiability, setPaymentLiability] = useState(null);
  const [paymentEntryMode, setPaymentEntryMode] = useState("custom");
  const [selectedScheduleIndex, setSelectedScheduleIndex] = useState("");
  const [paymentAccounts, setPaymentAccounts] = useState([]);
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
  
  useEffect(() => {
    const loadPaymentAccounts = async () => {
      try {
        const res = await fetch('/api/payments/account-balances');
        if (!res.ok) {
          throw new Error('Failed to load payment accounts');
        }
        const data = await res.json();
        const balances = data.balances || [];
        const mapped = paymentMethods.map((method) => {
          const balanceEntry = balances.find((b) => b.account === method.key);
          return {
            key: method.key,
            name: method.name,
            balance: balanceEntry ? balanceEntry.balance : 0
          };
        });
        setPaymentAccounts(mapped);
      } catch (error) {
        console.error('Error loading payment accounts:', error);
        setPaymentAccounts(paymentMethods.map((method) => ({
          key: method.key,
          name: method.name,
          balance: 0
        })));
      }
    };
    loadPaymentAccounts();
  }, []);

  const limit = 10;
  
  // Asset Filters
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("all");
  const [assetStatusFilter, setAssetStatusFilter] = useState("all");
  const [assetSourceFilter, setAssetSourceFilter] = useState("all");
  const [assetSearchTerm, setAssetSearchTerm] = useState("");
  
  // Liability Filters
  const [liabilityCategoryFilter, setLiabilityCategoryFilter] = useState("all");
  const [liabilityStatusFilter, setLiabilityStatusFilter] = useState("all");
  const [liabilityTypeFilter, setLiabilityTypeFilter] = useState("all");
  const [liabilitySearchTerm, setLiabilitySearchTerm] = useState("");
  
  // Shared alert
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("success");
  
  // Form data
  const [assetFormData, setAssetFormData] = useState({
    name: "",
    description: "",
    categoryId: "",
    purchaseDate: new Date().toISOString().split('T')[0],
    originalCost: "",
    usefulLifeYears: "",
    depreciationMethod: "straight_line",
    status: "active",
    location: "",
    serialNumber: "",
    supplier: "",
    warrantyExpiry: "",
    notes: "",
    isExistingAsset: false,
    accumulatedDepreciation: "0",
    paymentMethod: ""
  });
  
  const [assetCategoryFormData, setAssetCategoryFormData] = useState({
    name: "",
    description: ""
  });
  
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
  
  const [liabilityCategoryFormData, setLiabilityCategoryFormData] = useState({
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
    paymentMethod: ""
  });
  
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
  
  const [depreciationFormData, setDepreciationFormData] = useState({
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
    assetIds: []
  });
  
  // Asset pagination
  const [assetPage, setAssetPage] = useState(1);
  const [assetTotalPages, setAssetTotalPages] = useState(1);
  const [assetTotalCount, setAssetTotalCount] = useState(0);
  
  // Liability pagination
  const [liabilityPage, setLiabilityPage] = useState(1);
  const [liabilityTotalPages, setLiabilityTotalPages] = useState(1);
  const [liabilityTotalCount, setLiabilityTotalCount] = useState(0);
  
  // Fetch categories when component mounts
  useEffect(() => {
    if (activeTab === "assets") {
      fetchAssetCategories();
    } else {
      fetchLiabilityCategories();
    }
  }, [activeTab]);
  
  // Fetch assets when filters change
  useEffect(() => {
    if (activeTab === "assets") {
      fetchAssets();
    }
  }, [assetPage, assetCategoryFilter, assetStatusFilter, assetSourceFilter, assetSearchTerm, activeTab]);
  
  // Fetch liabilities when filters change
  useEffect(() => {
    if (activeTab === "liabilities") {
      fetchLiabilities();
    }
  }, [liabilityPage, liabilityCategoryFilter, liabilityStatusFilter, liabilityTypeFilter, liabilitySearchTerm, activeTab]);

  useEffect(() => {
    if (!liabilityFormData.startDate || !liabilityFormData.maturityDate) return;
    const derived = calculateTermMonths(liabilityFormData.startDate, liabilityFormData.maturityDate);
    if (derived && liabilityFormData.termMonths !== derived.toString()) {
      setLiabilityFormData(prev => ({ ...prev, termMonths: derived.toString() }));
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
    if (!showPaymentModal || !paymentLiability) return;
    if (!paymentAccounts.length) return;
    setPaymentFormData(prev => ({
      ...prev,
      paymentMethod: prev.paymentMethod || paymentAccounts[0]?.key || ""
    }));
  }, [showPaymentModal, paymentLiability, paymentAccounts]);

  useEffect(() => {
    const loadTenants = async () => {
      try {
        const res = await fetch("/api/tenant/list", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setUserTenants(data.tenants || []);
        setCurrentTenantId(data.currentTenantId ?? null);
      } catch (e) {
        console.error("Error loading tenant list:", e);
      }
    };
    loadTenants();
  }, []);

  useEffect(() => {
    if (!showTransferModal) {
      setTransferTargetCategories([]);
      return;
    }
    if (!transferTargetTenantId) {
      setTransferTargetCategories([]);
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(
          `/api/asset-categories?forTenantId=${encodeURIComponent(transferTargetTenantId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          setTransferTargetCategories([]);
          return;
        }
        const data = await res.json();
        setTransferTargetCategories(data.categories || []);
      } catch {
        setTransferTargetCategories([]);
      }
    };
    load();
  }, [showTransferModal, transferTargetTenantId]);
  
  // Fetch asset categories from API
  const fetchAssetCategories = async () => {
    try {
      const response = await fetch('/api/asset-categories');
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAssetCategories(data.categories || []);
    } catch (error) {
      console.error("Error fetching asset categories:", error);
      setAssetsError("Failed to load categories. Please try again later.");
    }
  };
  
  // Fetch liability categories from API
  const fetchLiabilityCategories = async () => {
    try {
      const response = await fetch('/api/liability-categories');
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }
      
      const data = await response.json();
      setLiabilityCategories(data.categories || []);
    } catch (error) {
      console.error("Error fetching liability categories:", error);
      setLiabilitiesError("Failed to load categories. Please try again later.");
    }
  };
  
  // Fetch assets from API
  const fetchAssets = async () => {
    setAssetsLoading(true);
    setAssetsError(null);
    
    try {
      // Build query params
      const params = new URLSearchParams({
        page: assetPage.toString(),
        limit: limit.toString(),
        sortBy: 'purchaseDate',
        sortOrder: 'desc'
      });
      
      // Add search term if provided
      if (assetSearchTerm) {
        params.append('search', assetSearchTerm);
      }
      
      // Add category filter if not "all"
      if (assetCategoryFilter !== "all") {
        params.append('categoryId', assetCategoryFilter);
      }
      
      // Add status filter if not "all"
      if (assetStatusFilter !== "all") {
        params.append('status', assetStatusFilter);
      }

      // Add source filter for assets created from PO receipt flow
      if (assetSourceFilter !== "all") {
        params.append('source', assetSourceFilter);
      }
      
      const response = await fetch(`/api/assets?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch assets: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setAssets(data.assets);
      setAssetTotalPages(data.pagination.totalPages);
      setAssetTotalCount(data.pagination.totalCount);
    } catch (error) {
      console.error("Error fetching assets:", error);
      setAssetsError("Failed to load assets. Please try again later.");
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  };
  
  // Fetch liabilities from API
  const fetchLiabilities = async () => {
    setLiabilitiesLoading(true);
    setLiabilitiesError(null);
    
    try {
      // Build query params
      const params = new URLSearchParams({
        page: liabilityPage.toString(),
        limit: limit.toString(),
        sortBy: 'startDate',
        sortOrder: 'desc'
      });
      
      // Add search term if provided
      if (liabilitySearchTerm) {
        params.append('search', liabilitySearchTerm);
      }
      
      // Add category filter if not "all"
      if (liabilityCategoryFilter !== "all") {
        params.append('categoryId', liabilityCategoryFilter);
      }
      
      // Add status filter if not "all"
      if (liabilityStatusFilter !== "all") {
        params.append('status', liabilityStatusFilter);
      }
      
      // Add type filter if not "all"
      if (liabilityTypeFilter !== "all") {
        params.append('liabilityType', liabilityTypeFilter);
      }
      
      const response = await fetch(`/api/liabilities?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch liabilities: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setLiabilities(data.liabilities);
      setLiabilityTotalPages(data.pagination.totalPages);
      setLiabilityTotalCount(data.pagination.totalCount);
    } catch (error) {
      console.error("Error fetching liabilities:", error);
      setLiabilitiesError("Failed to load liabilities. Please try again later.");
      setLiabilities([]);
    } finally {
      setLiabilitiesLoading(false);
    }
  };
  
  // Asset handlers
  const handleAssetSearchChange = (e) => {
    setAssetSearchTerm(e.target.value);
    setAssetPage(1);
  };
  
  const handleAssetCategoryFilterChange = (e) => {
    setAssetCategoryFilter(e.target.value);
    setAssetPage(1);
  };
  
  const handleAssetStatusFilterChange = (e) => {
    setAssetStatusFilter(e.target.value);
    setAssetPage(1);
  };

  const handleAssetSourceFilterChange = (e) => {
    setAssetSourceFilter(e.target.value);
    setAssetPage(1);
  };
  
  const handleAssetPageChange = (newPage) => {
    if (newPage > 0 && newPage <= assetTotalPages) {
      setAssetPage(newPage);
    }
  };
  
  // Liability handlers
  const handleLiabilitySearchChange = (e) => {
    setLiabilitySearchTerm(e.target.value);
    setLiabilityPage(1);
  };
  
  const handleLiabilityCategoryFilterChange = (e) => {
    setLiabilityCategoryFilter(e.target.value);
    setLiabilityPage(1);
  };
  
  const handleLiabilityStatusFilterChange = (e) => {
    setLiabilityStatusFilter(e.target.value);
    setLiabilityPage(1);
  };
  
  const handleLiabilityTypeFilterChange = (e) => {
    setLiabilityTypeFilter(e.target.value);
    setLiabilityPage(1);
  };
  
  const handleLiabilityPageChange = (newPage) => {
    if (newPage > 0 && newPage <= liabilityTotalPages) {
      setLiabilityPage(newPage);
    }
  };
  
  // Submit asset form
  const handleAssetSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = assetEditId ? `/api/assets/${assetEditId}` : '/api/assets';
      const method = assetEditId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assetFormData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save asset");
      }
      
      // Show success message
      setAlertMessage(`Asset successfully ${assetEditId ? 'updated' : 'created'}`);
      setAlertType("success");
      setShowAlert(true);
      
      // Close modal and refresh assets
      setShowAssetModal(false);
      fetchAssets();
      
      // Reset form
      resetAssetForm();
    } catch (error) {
      console.error("Error saving asset:", error);
      setAlertMessage(error.message || "Failed to save asset");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Submit asset category form
  const handleAssetCategorySubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/asset-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assetCategoryFormData)
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
      setShowAssetCategoryModal(false);
      fetchAssetCategories();
      
      // Reset form
      setAssetCategoryFormData({ name: "", description: "" });
    } catch (error) {
      console.error("Error creating category:", error);
      setAlertMessage(error.message || "Failed to create category");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Submit depreciation calculation
  const handleDepreciationSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/assets/depreciation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(depreciationFormData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to calculate depreciation");
      }
      
      const data = await response.json();
      
      // Show success message
      setAlertMessage(`Depreciation calculated for ${data.summary.assetsProcessed} assets. Total: ${formatCurrency(data.summary.totalDepreciation)}`);
      setAlertType("success");
      setShowAlert(true);
      
      // Close modal and refresh assets
      setShowDepreciationModal(false);
      fetchAssets();
    } catch (error) {
      console.error("Error calculating depreciation:", error);
      setAlertMessage(error.message || "Failed to calculate depreciation");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Reset asset form to initial state
  const resetAssetForm = () => {
    setAssetFormData({
      name: "",
      description: "",
      categoryId: "",
      purchaseDate: new Date().toISOString().split('T')[0],
      originalCost: "",
      usefulLifeYears: "",
      depreciationMethod: "straight_line",
      status: "active",
      location: "",
      serialNumber: "",
      supplier: "",
      warrantyExpiry: "",
      notes: "",
      isExistingAsset: false,
      accumulatedDepreciation: "0",
      paymentMethod: ""
    });
    setAssetEditId(null);
  };
  
  // View asset details
  const handleViewAsset = async (asset) => {
    try {
      const response = await fetch(`/api/assets/${asset.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch asset details');
      }
      const data = await response.json();
      setViewAsset(data.asset);
      setShowViewModal(true);
    } catch (error) {
      console.error("Error fetching asset details:", error);
      setAlertMessage("Failed to load asset details");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Edit asset
  const handleEditAsset = (asset) => {
    setAssetFormData({
      name: asset.name,
      description: asset.description || "",
      categoryId: asset.categoryId,
      purchaseDate: new Date(asset.purchaseDate).toISOString().split('T')[0],
      originalCost: asset.originalCost.toString(),
      usefulLifeYears: asset.usefulLifeYears.toString(),
      depreciationMethod: asset.depreciationMethod,
      status: asset.status,
      location: asset.location || "",
      serialNumber: asset.serialNumber || "",
      supplier: asset.supplier || "",
      warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : "",
      notes: asset.notes || "",
      isExistingAsset: asset.isExistingAsset,
      accumulatedDepreciation: asset.accumulatedDepreciation.toString(),
      paymentMethod: asset.paymentMethod || ""
    });
      setAssetEditId(asset.id);
      setShowAssetModal(true);
    };
  
    // Delete asset
    const handleDeleteAsset = async (assetId) => {
    if (!confirm("Are you sure you want to delete this asset? This action cannot be undone.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // If asset has depreciation history, show disposal option
        if (errorData.error && errorData.error.includes("depreciation history")) {
          const asset = assets.find(a => a.id === assetId);
          setDisposalAsset(asset);
          setShowDisposalModal(true);
          return;
        }
        
        throw new Error(errorData.error || "Failed to delete asset");
      }
      
      // Show success message
      setAlertMessage("Asset successfully deleted");
      setAlertType("success");
      setShowAlert(true);
      
      // Refresh assets
      fetchAssets();
    } catch (error) {
      console.error("Error deleting asset:", error);
      setAlertMessage(error.message || "Failed to delete asset");
      setAlertType("error");
      setShowAlert(true);
    }
  };

  // Dispose asset
  const handleDisposeAsset = async (disposalData) => {
    try {
      const response = await fetch(`/api/assets/${disposalAsset.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(disposalData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to dispose asset");
      }
      
      // Show success message 
      setAlertMessage("Asset disposed successfully");
      setAlertType("success");
      setShowAlert(true);
      
      // Close modal and refresh assets list
      setShowDisposalModal(false);
      setDisposalAsset(null);
      await fetchAssets();
      
    } catch (error) {
      console.error('Error disposing asset:', error);
      setAlertMessage(error.message || "Failed to dispose asset. Please try again.");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Export assets
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ format: 'csv' });
      
      if (assetCategoryFilter !== "all") {
        params.append('categoryId', assetCategoryFilter);
      }
      
      if (assetStatusFilter !== "all") {
        params.append('status', assetStatusFilter);
      }
      
      const response = await fetch(`/api/assets/report?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to export assets');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `asset-register-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setAlertMessage("Assets exported successfully");
      setAlertType("success");
      setShowAlert(true);
    } catch (error) {
      console.error("Error exporting assets:", error);
      setAlertMessage("Failed to export assets");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  // Liability handler functions
  const handleLiabilitySubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = liabilityEditId ? `/api/liabilities/${liabilityEditId}` : '/api/liabilities';
      const method = liabilityEditId ? 'PUT' : 'POST';
      
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
      
      setAlertMessage(`Liability successfully ${liabilityEditId ? 'updated' : 'created'}`);
      setAlertType("success");
      setShowAlert(true);
      
      setShowLiabilityModal(false);
      fetchLiabilities();
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

  const handleLiabilityCategorySubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/liability-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(liabilityCategoryFormData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create category");
      }
      
      setAlertMessage("Category successfully created");
      setAlertType("success");
      setShowAlert(true);
      
      setShowLiabilityCategoryModal(false);
      fetchLiabilityCategories();
      setLiabilityCategoryFormData({ name: "", description: "" });
    } catch (error) {
      console.error("Error creating category:", error);
      setAlertMessage(error.message || "Failed to create category");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (!paymentFormData.paymentMethod) {
        setAlertMessage("Select a payment account before recording the payment.");
        setAlertType("error");
        setShowAlert(true);
        return;
      }

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
      
      setAlertMessage("Payment recorded successfully");
      setAlertType("success");
      setShowAlert(true);
      
      setShowPaymentModal(false);
      setPaymentLiability(null);
      fetchLiabilities();
      setPaymentFormData({
        amount: "",
        paymentDate: new Date().toISOString().split('T')[0],
        paymentType: "both",
        principalPaid: "",
        interestPaid: "",
        reference: "",
        notes: "",
        paymentMethod: paymentAccounts[0]?.key || ""
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      setAlertMessage(error.message || "Failed to record payment");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
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
    setLiabilityEditId(null);
  };
  
  const handleViewLiability = async (liability) => {
    try {
      const response = await fetch(`/api/liabilities/${liability.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch liability details');
      }
      const data = await response.json();
      setViewLiability(data.liability);
      setShowLiabilityViewModal(true);
    } catch (error) {
      console.error("Error fetching liability details:", error);
      setAlertMessage("Failed to load liability details");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
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
    setLiabilityEditId(liability.id);
    setShowLiabilityModal(true);
  };
  
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
      
      setAlertMessage("Liability successfully deleted");
      setAlertType("success");
      setShowAlert(true);
      fetchLiabilities();
    } catch (error) {
      console.error("Error deleting liability:", error);
      setAlertMessage(error.message || "Failed to delete liability");
      setAlertType("error");
      setShowAlert(true);
    }
  };
  
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
      paymentMethod: paymentAccounts[0]?.key || ""
    });
    setShowPaymentModal(true);
  };
  
  const assetStatusOptions = ["all", "active", "disposed", "sold"];
  const liabilityStatusOptions = ["all", "active", "paid_off", "defaulted"];

  const hasMultipleBusinesses = userTenants.length > 1;

  const openTransferModal = (asset) => {
    setTransferAsset(asset);
    setTransferTargetTenantId("");
    setTransferCategoryId("");
    setTransferNotes("");
    setTransferTargetCategories([]);
    setShowTransferModal(true);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferAsset?.id || !transferTargetTenantId) return;
    setTransferSubmitting(true);
    try {
      const res = await fetch(`/api/assets/${transferAsset.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTenantId: transferTargetTenantId,
          ...(transferCategoryId ? { targetCategoryId: transferCategoryId } : {}),
          ...(transferNotes.trim() ? { notes: transferNotes.trim() } : {}),
        }),
      });
      let data;
      const rawText = await res.text().catch(() => "");
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        console.error("Transfer API response:", res.status, data, rawText?.slice(0, 500));
        const parts = [
          data.error || `Transfer failed (HTTP ${res.status})`,
          data.code ? `[${data.code}]` : null,
          data.field ? `field: ${data.field}` : null,
          data.hint ? data.hint : null,
          !data.error && !data.code ? rawText?.slice(0, 200) : null,
        ].filter(Boolean);
        throw new Error(parts.join(" — "));
      }
      setAlertMessage(data.message || "Asset transferred to the other business.");
      setAlertType("success");
      setShowAlert(true);
      setShowTransferModal(false);
      setTransferAsset(null);
      fetchAssets();
    } catch (err) {
      setAlertMessage(err.message || "Transfer failed");
      setAlertType("error");
      setShowAlert(true);
    } finally {
      setTransferSubmitting(false);
    }
  };
  
  return (
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
          <h1 className="text-2xl font-bold">Assets & Liabilities Management</h1>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="liabilities">Liabilities</TabsTrigger>
          </TabsList>
          
          <TabsContent value="assets">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Asset Management</h2>
              <div className="flex space-x-2">
                <button 
                  className="btn-secondary flex items-center gap-2 px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
                  onClick={() => setShowAssetCategoryModal(true)}
                >
                  <Plus size={16} />
                  New Category
                </button>
                <button 
                  className="btn-secondary flex items-center gap-2 px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
                  onClick={() => setShowDepreciationModal(true)}
                >
                  <TrendingDown size={16} />
                  Calculate Depreciation
                </button>
                <button 
                  className="btn-secondary flex items-center gap-2 px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
                  onClick={handleExport}
                >
                  <Download size={16} />
                  Export
                </button>
                <button 
                  className="btn-primary flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    resetAssetForm();
                    setShowAssetModal(true);
                  }}
                >
                  <Plus size={16} />
                  New Asset
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search assets..."
                      className="input-search pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md"
                      value={assetSearchTerm}
                      onChange={handleAssetSearchChange}
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative">
                    <select
                      className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                      value={assetCategoryFilter}
                      onChange={handleAssetCategoryFilterChange}
                    >
                      <option value="all">All Categories</option>
                      {assetCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                  <div className="relative">
                    <select
                      className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                      value={assetStatusFilter}
                      onChange={handleAssetStatusFilterChange}
                    >
                      {assetStatusOptions.map(option => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                    <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                  <div className="relative">
                    <select
                      className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                      value={assetSourceFilter}
                      onChange={handleAssetSourceFilterChange}
                    >
                      <option value="all">All Sources</option>
                      <option value="po">From PO</option>
                    </select>
                    <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
              </div>

              {assetsLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
              ) : assetsError ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-md">
                  <p className="flex items-center">
                    <AlertCircle className="mr-2 h-5 w-5" />
                    {assetsError}
                  </p>
                </div>
              ) : assets.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No assets found. Create your first asset!</p>
                </div>
              ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="p-3 font-medium">Asset Name</th>
                    <th className="p-3 font-medium">Category</th>
                    <th className="p-3 font-medium">Purchase Date</th>
                    <th className="p-3 font-medium text-right">Original Cost</th>
                    <th className="p-3 font-medium text-right">Accumulated Depreciation</th>
                    <th className="p-3 font-medium text-right">Net Book Value</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="p-3 text-blue-600">
                        <div className="flex items-center gap-2">
                          <span>{asset.name}</span>
                          {(String(asset.notes || "").toUpperCase().includes("AUTO_ASSET_FROM_GR:") ||
                            String(asset.notes || "").toUpperCase().includes("[PO_ASSET:")) && (
                            <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                              From PO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">{asset.category.name}</td>
                      <td className="p-3">{new Date(asset.purchaseDate).toLocaleDateString()}</td>
                      <td className="p-3 text-right">{formatCurrency(asset.originalCost)}</td>
                      <td className="p-3 text-right">{formatCurrency(asset.currentAccumulatedDepreciation)}</td>
                      <td className="p-3 text-right">{formatCurrency(asset.currentNetBookValue)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          asset.status === "active" 
                            ? "bg-green-100 text-green-800" 
                            : asset.status === "disposed"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {asset.status === 'disposed' ? 'Disposed' : asset.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center space-x-2">
                          <button 
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => handleViewAsset(asset)}
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                          {hasMultipleBusinesses && asset.status === "active" && (
                            <button
                              type="button"
                              className="text-violet-600 hover:text-violet-800"
                              title="Transfer to another business"
                              onClick={() => openTransferModal(asset)}
                            >
                              <ArrowLeftRight size={16} />
                            </button>
                          )}
                          <button 
                            className={`${asset.status === 'disposed' ? 'text-gray-400 cursor-not-allowed' : 'text-orange-600 hover:text-orange-800'}`}
                            onClick={() => asset.status !== 'disposed' && handleEditAsset(asset)}
                            disabled={asset.status === 'disposed'}
                            title={asset.status === 'disposed' ? 'Cannot edit disposed asset' : 'Edit asset'}
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className={`${asset.status === 'disposed' ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-800'}`}
                            onClick={() => asset.status !== 'disposed' && handleDeleteAsset(asset.id)}
                            disabled={asset.status === 'disposed'}
                            title={asset.status === 'disposed' ? 'Cannot delete disposed asset' : 'Delete asset'}
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

              {!assetsLoading && !assetsError && assets.length > 0 && (
                <div className="mt-6 flex justify-between items-center text-sm text-gray-500">
                  <div>Showing {assets.length} of {assetTotalCount} assets</div>
                  <div className="flex items-center space-x-2">
                    <button 
                      className={`px-3 py-1 border border-gray-200 rounded ${assetPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      onClick={() => handleAssetPageChange(assetPage - 1)}
                      disabled={assetPage === 1}
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, assetTotalPages) }).map((_, index) => {
                      const pageNumber = assetPage > 2 ? assetPage - 2 + index : index + 1;
                      if (pageNumber <= assetTotalPages) {
                        return (
                          <button
                            key={pageNumber}
                            className={`px-3 py-1 rounded ${
                              pageNumber === assetPage
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => handleAssetPageChange(pageNumber)}
                          >
                            {pageNumber}
                          </button>
                        );
                      }
                      return null;
                    })}
                    <button 
                      className={`px-3 py-1 border border-gray-200 rounded ${assetPage === assetTotalPages ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      onClick={() => handleAssetPageChange(assetPage + 1)}
                      disabled={assetPage === assetTotalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="liabilities">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Liability Management</h2>
              <div className="flex space-x-2">
                <button 
                  className="btn-secondary flex items-center gap-2 px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
                  onClick={() => setShowLiabilityCategoryModal(true)}
                >
                  <Plus size={16} />
                  New Category
                </button>
                <button 
                  className="btn-primary flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    resetLiabilityForm();
                    setShowLiabilityModal(true);
                  }}
                >
                  <Plus size={16} />
                  New Liability
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search liabilities..."
                      className="input-search pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md"
                      value={liabilitySearchTerm}
                      onChange={handleLiabilitySearchChange}
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative">
                    <select
                      className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                      value={liabilityCategoryFilter}
                      onChange={handleLiabilityCategoryFilterChange}
                    >
                      <option value="all">All Categories</option>
                      {liabilityCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                  <div className="relative">
                    <select
                      className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                      value={liabilityTypeFilter}
                      onChange={handleLiabilityTypeFilterChange}
                    >
                      <option value="all">All Types</option>
                      {liabilityTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                  <div className="relative">
                    <select
                      className="select-filter pl-10 pr-8 py-2 border border-gray-300 rounded-md appearance-none bg-white"
                      value={liabilityStatusFilter}
                      onChange={handleLiabilityStatusFilterChange}
                    >
                      {liabilityStatusOptions.map(option => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1).replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
              </div>

              {liabilitiesLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : liabilitiesError ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-md">
                  <p className="flex items-center">
                    <AlertCircle className="mr-2 h-5 w-5" />
                    {liabilitiesError}
                  </p>
                </div>
              ) : liabilities.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No liabilities found. Create your first liability!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="p-3 font-medium">Liability Name</th>
                        <th className="p-3 font-medium">Type</th>
                        <th className="p-3 font-medium">Category</th>
                        <th className="p-3 font-medium">Lender</th>
                        <th className="p-3 font-medium">Interest Method</th>
                        <th className="p-3 font-medium text-right">Principal Amount</th>
                        <th className="p-3 font-medium text-right">Projected Total (Schedule)</th>
                        <th className="p-3 font-medium text-right">Current Balance</th>
                        <th className="p-3 font-medium text-right">Total Paid</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium text-center">Actions</th>
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

              {!liabilitiesLoading && !liabilitiesError && liabilities.length > 0 && (
                <div className="mt-6 flex justify-between items-center text-sm text-gray-500">
                  <div>Showing {liabilities.length} of {liabilityTotalCount} liabilities</div>
                  <div className="flex items-center space-x-2">
                    <button 
                      className={`px-3 py-1 border border-gray-200 rounded ${liabilityPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      onClick={() => handleLiabilityPageChange(liabilityPage - 1)}
                      disabled={liabilityPage === 1}
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, liabilityTotalPages) }).map((_, index) => {
                      const pageNumber = liabilityPage > 2 ? liabilityPage - 2 + index : index + 1;
                      if (pageNumber <= liabilityTotalPages) {
                        return (
                          <button
                            key={pageNumber}
                            className={`px-3 py-1 rounded ${
                              pageNumber === liabilityPage
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => handleLiabilityPageChange(pageNumber)}
                          >
                            {pageNumber}
                          </button>
                        );
                      }
                      return null;
                    })}
                    <button 
                      className={`px-3 py-1 border border-gray-200 rounded ${liabilityPage === liabilityTotalPages ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      onClick={() => handleLiabilityPageChange(liabilityPage + 1)}
                      disabled={liabilityPage === liabilityTotalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Asset Category Modal */}
        {showAssetCategoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">New Category</h2>
                  <button 
                    onClick={() => {
                      setShowAssetCategoryModal(false);
                      setAssetCategoryFormData({ name: "", description: "" });
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <form onSubmit={handleAssetCategorySubmit}>
                <div className="p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Category Name *</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-200 rounded"
                      value={assetCategoryFormData.name}
                      onChange={(e) => setAssetCategoryFormData({...assetCategoryFormData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      className="w-full p-2 border border-gray-200 rounded"
                      rows="3"
                      value={assetCategoryFormData.description}
                      onChange={(e) => setAssetCategoryFormData({...assetCategoryFormData, description: e.target.value})}
                    />
                  </div>
                </div>
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-200 rounded"
                    onClick={() => {
                      setShowAssetCategoryModal(false);
                      setAssetCategoryFormData({ name: "", description: "" });
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Liability Category Modal */}
        {showLiabilityCategoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">New Category</h2>
                  <button 
                    onClick={() => {
                      setShowLiabilityCategoryModal(false);
                      setLiabilityCategoryFormData({ name: "", description: "" });
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <form onSubmit={handleLiabilityCategorySubmit}>
                <div className="p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Category Name *</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-200 rounded"
                      value={liabilityCategoryFormData.name}
                      onChange={(e) => setLiabilityCategoryFormData({...liabilityCategoryFormData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      className="w-full p-2 border border-gray-200 rounded"
                      rows="3"
                      value={liabilityCategoryFormData.description}
                      onChange={(e) => setLiabilityCategoryFormData({...liabilityCategoryFormData, description: e.target.value})}
                    />
                  </div>
                </div>
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-200 rounded"
                    onClick={() => {
                      setShowLiabilityCategoryModal(false);
                      setLiabilityCategoryFormData({ name: "", description: "" });
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* New/Edit Asset Modal */}
        {showAssetModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">{assetEditId ? 'Edit Asset' : 'New Asset'}</h2>
                  <button 
                    onClick={() => {
                      setShowAssetModal(false);
                      resetAssetForm();
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <form onSubmit={handleAssetSubmit}>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Asset Name *</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.name}
                        onChange={(e) => setAssetFormData({...assetFormData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Category *</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.categoryId}
                        onChange={(e) => setAssetFormData({...assetFormData, categoryId: e.target.value})}
                        required
                      >
                        <option value="">Select Category</option>
                        {assetCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      className="w-full p-2 border border-gray-200 rounded"
                      rows="2"
                      value={assetFormData.description}
                      onChange={(e) => setAssetFormData({...assetFormData, description: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Purchase Date *</label>
                      <input
                        type="date"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.purchaseDate}
                        onChange={(e) => setAssetFormData({...assetFormData, purchaseDate: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Original Cost *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.originalCost}
                        onChange={(e) => setAssetFormData({...assetFormData, originalCost: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Useful Life (Years) *</label>
                      <input
                        type="number"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.usefulLifeYears}
                        onChange={(e) => setAssetFormData({...assetFormData, usefulLifeYears: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Depreciation Method</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.depreciationMethod}
                        onChange={(e) => setAssetFormData({...assetFormData, depreciationMethod: e.target.value})}
                      >
                        <option value="straight_line">Straight Line</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={assetFormData.isExistingAsset}
                        onChange={(e) => setAssetFormData({...assetFormData, isExistingAsset: e.target.checked})}
                      />
                      <span className="text-sm font-medium">This is an existing asset (already owned)</span>
                    </label>
                  </div>
                  
                  {assetFormData.isExistingAsset && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">Accumulated Depreciation</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.accumulatedDepreciation}
                        onChange={(e) => setAssetFormData({...assetFormData, accumulatedDepreciation: e.target.value})}
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the depreciation already accumulated on this asset</p>
                    </div>
                  )}
                  
                  {!assetFormData.isExistingAsset && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">Payment Account *</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.paymentMethod}
                        onChange={(e) => setAssetFormData({...assetFormData, paymentMethod: e.target.value})}
                        required
                        disabled={!paymentAccounts.length}
                      >
                        <option value="">Select a payment account</option>
                        {!paymentAccounts.length && <option value="">No payment accounts found</option>}
                        {paymentAccounts.map((account) => (
                          <option key={account.key} value={account.key}>
                            {account.name} · Balance {formatCurrency(account.balance || 0)}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Select the payment account from which the asset purchase will be deducted. Uses the same payment accounts configured under Payment Processing.</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Location</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.location}
                        onChange={(e) => setAssetFormData({...assetFormData, location: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Serial Number</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.serialNumber}
                        onChange={(e) => setAssetFormData({...assetFormData, serialNumber: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Supplier</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.supplier}
                        onChange={(e) => setAssetFormData({...assetFormData, supplier: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Warranty Expiry</label>
                      <input
                        type="date"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={assetFormData.warrantyExpiry}
                        onChange={(e) => setAssetFormData({...assetFormData, warrantyExpiry: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea
                      className="w-full p-2 border border-gray-200 rounded"
                      rows="3"
                      value={assetFormData.notes}
                      onChange={(e) => setAssetFormData({...assetFormData, notes: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-200 rounded"
                    onClick={() => {
                      setShowAssetModal(false);
                      resetAssetForm();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {assetEditId ? 'Update Asset' : 'Create Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* Depreciation Modal */}
        {showDepreciationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Calculate Depreciation</h2>
                  <button 
                    onClick={() => setShowDepreciationModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <form onSubmit={handleDepreciationSubmit}>
                <div className="p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Period Start *</label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-200 rounded"
                      value={depreciationFormData.periodStart}
                      onChange={(e) => setDepreciationFormData({...depreciationFormData, periodStart: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Period End *</label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-200 rounded"
                      value={depreciationFormData.periodEnd}
                      onChange={(e) => setDepreciationFormData({...depreciationFormData, periodEnd: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                    <p>This will calculate depreciation for all active assets for the specified period and post journal entries automatically.</p>
                  </div>
                </div>
                
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-200 rounded"
                    onClick={() => setShowDepreciationModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Calculate & Post
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Asset Modal */}
        {showViewModal && viewAsset && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Asset Details</h2>
                  <button 
                    onClick={() => setShowViewModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Asset Name</p>
                    <p className="font-medium">{viewAsset.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Category</p>
                    <p className="font-medium">{viewAsset.category.name}</p>
                  </div>
                  {viewAsset.description && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-500 mb-1">Description</p>
                      <p className="font-medium">{viewAsset.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Purchase Date</p>
                    <p className="font-medium">{new Date(viewAsset.purchaseDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Original Cost</p>
                    <p className="font-medium">{formatCurrency(viewAsset.originalCost)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Useful Life</p>
                    <p className="font-medium">{viewAsset.usefulLifeYears} years</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Depreciation Method</p>
                    <p className="font-medium">{viewAsset.depreciationMethod.replace('_', ' ').toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Accumulated Depreciation</p>
                    <p className="font-medium text-red-600">{formatCurrency(viewAsset.currentAccumulatedDepreciation)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Net Book Value</p>
                    <p className="font-medium text-green-600">{formatCurrency(viewAsset.currentNetBookValue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      viewAsset.status === "active" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {viewAsset.status}
                    </span>
                  </div>
                  {viewAsset.location && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Location</p>
                      <p className="font-medium">{viewAsset.location}</p>
                    </div>
                  )}
                  {viewAsset.serialNumber && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Serial Number</p>
                      <p className="font-medium">{viewAsset.serialNumber}</p>
                    </div>
                  )}
                  {viewAsset.supplier && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Supplier</p>
                      <p className="font-medium">{viewAsset.supplier}</p>
                    </div>
                  )}
                  {viewAsset.warrantyExpiry && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Warranty Expiry</p>
                      <p className="font-medium">{new Date(viewAsset.warrantyExpiry).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                
                {viewAsset.interBusinessTransfers && viewAsset.interBusinessTransfers.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold mb-3">Transfer history (between businesses)</h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="p-3 font-medium">Date</th>
                            <th className="p-3 font-medium">From</th>
                            <th className="p-3 font-medium">To</th>
                            <th className="p-3 font-medium">Category change</th>
                            <th className="p-3 font-medium">By</th>
                            <th className="p-3 font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewAsset.interBusinessTransfers.map((row) => (
                            <tr key={row.id} className="border-t border-gray-200">
                              <td className="p-3 whitespace-nowrap">
                                {new Date(row.transferredAt).toLocaleString()}
                              </td>
                              <td className="p-3">{row.fromTenantName}</td>
                              <td className="p-3">{row.toTenantName}</td>
                              <td className="p-3 text-xs text-gray-600">
                                {row.fromCategoryName} → {row.toCategoryName}
                              </td>
                              <td className="p-3">
                                {row.transferredBy?.name || row.transferredBy?.email || "—"}
                              </td>
                              <td className="p-3 text-xs text-gray-600 max-w-[200px]">
                                {row.notes || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Each transfer is also recorded in audit logs for both businesses. Financial snapshot at transfer is stored on the server.
                    </p>
                  </div>
                )}

                {viewAsset.depreciationSchedules && viewAsset.depreciationSchedules.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold mb-3">Depreciation History</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="p-3 font-medium">Period</th>
                            <th className="p-3 font-medium text-right">Depreciation</th>
                            <th className="p-3 font-medium text-right">Accumulated</th>
                            <th className="p-3 font-medium text-right">Net Book Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewAsset.depreciationSchedules.map((schedule, index) => (
                            <tr key={index} className="border-t border-gray-200">
                              <td className="p-3">
                                {new Date(schedule.periodStart).toLocaleDateString()} - {new Date(schedule.periodEnd).toLocaleDateString()}
                              </td>
                              <td className="p-3 text-right">{formatCurrency(schedule.depreciationAmount)}</td>
                              <td className="p-3 text-right">{formatCurrency(schedule.accumulatedDepreciation)}</td>
                              <td className="p-3 text-right">{formatCurrency(schedule.netBookValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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

        {showTransferModal && transferAsset && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold">Transfer asset to another business</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferAsset(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleTransferSubmit}>
                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-600">
                    Asset:{" "}
                    <span className="font-medium text-gray-900">{transferAsset.name}</span>
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                    This moves the asset register entry (and linked depreciation schedules) to the
                    selected business. Inter-company accounting entries are not posted automatically;
                    consult your accountant if required.
                  </div>
                  <div>
                    <label htmlFor="transfer-target-tenant" className="block text-sm font-medium mb-1">
                      Destination business <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="transfer-target-tenant"
                      className="w-full p-2 border border-gray-200 rounded"
                      required
                      value={transferTargetTenantId}
                      onChange={(e) => {
                        setTransferTargetTenantId(e.target.value);
                        setTransferCategoryId("");
                      }}
                    >
                      <option value="">Select business…</option>
                      {userTenants
                        .filter((t) => t.id !== (currentTenantId ?? ""))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="transfer-target-category" className="block text-sm font-medium mb-1">
                      Category in destination (optional)
                    </label>
                    <select
                      id="transfer-target-category"
                      className="w-full p-2 border border-gray-200 rounded"
                      value={transferCategoryId}
                      onChange={(e) => setTransferCategoryId(e.target.value)}
                      disabled={!transferTargetTenantId}
                    >
                      <option value="">Match by name or create automatically</option>
                      {transferTargetCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="transfer-notes" className="block text-sm font-medium mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      id="transfer-notes"
                      rows={2}
                      className="w-full p-2 border border-gray-200 rounded text-sm"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="Reason or reference"
                    />
                  </div>
                </div>
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-200 rounded"
                    onClick={() => {
                      setShowTransferModal(false);
                      setTransferAsset(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={transferSubmitting || !transferTargetTenantId}
                    className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                  >
                    {transferSubmitting ? "Transferring…" : "Confirm transfer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Disposal Modal */}
        {showDisposalModal && disposalAsset && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Dispose Asset</h2>
                  <button 
                    onClick={() => setShowDisposalModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleDisposeAsset({
                  disposalDate: formData.get('disposalDate'),
                  disposalAmount: formData.get('disposalAmount'),
                  disposalMethod: formData.get('disposalMethod'),
                  disposalNotes: formData.get('disposalNotes')
                });
              }}>
                <div className="p-6">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Asset: <span className="font-medium">{disposalAsset.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      This asset has depreciation history and cannot be deleted. 
                      Disposing it will mark it as no longer in use while preserving all financial records.
                    </p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Disposal Date *</label>
                    <input
                      type="date"
                      name="disposalDate"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Disposal Amount</label>
                    <input
                      type="number"
                      name="disposalAmount"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Amount received from disposal (if any)</p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Disposal Method *</label>
                    <select
                      name="disposalMethod"
                      className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select method</option>
                      <option value="sold">Sold</option>
                      <option value="scrapped">Scrapped</option>
                      <option value="donated">Donated</option>
                      <option value="lost">Lost/Stolen</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea
                      name="disposalNotes"
                      rows={3}
                      placeholder="Additional disposal details..."
                      className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-200 rounded"
                    onClick={() => setShowDisposalModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    Dispose Asset
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* New/Edit Liability Modal */}
        {showLiabilityModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">{liabilityEditId ? 'Edit Liability' : 'New Liability'}</h2>
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
                      <label className="block text-sm font-medium mb-1">Liability Name *</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={liabilityFormData.name}
                        onChange={(e) => setLiabilityFormData({...liabilityFormData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Category *</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={liabilityFormData.categoryId}
                        onChange={(e) => setLiabilityFormData({...liabilityFormData, categoryId: e.target.value})}
                        required
                      >
                        <option value="">Select Category</option>
                        {liabilityCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Liability Type *</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={liabilityFormData.liabilityType}
                        onChange={(e) => setLiabilityFormData({...liabilityFormData, liabilityType: e.target.value})}
                        required
                      >
                        {liabilityTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Status</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={liabilityFormData.status}
                        onChange={(e) => setLiabilityFormData({...liabilityFormData, status: e.target.value})}
                      >
                        <option value="active">Active</option>
                        <option value="paid_off">Paid Off</option>
                        <option value="defaulted">Defaulted</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      className="w-full p-2 border border-gray-200 rounded"
                      rows="2"
                      value={liabilityFormData.description}
                      onChange={(e) => setLiabilityFormData({...liabilityFormData, description: e.target.value})}
                    />
                  </div>
                  
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Principal Amount *</label>
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
                        <label className="block text-sm font-medium mb-1">Interest Method</label>
                        <select
                          className="w-full p-2 border border-gray-200 rounded"
                          value={liabilityFormData.interestType}
                          onChange={(e) => setLiabilityFormData({...liabilityFormData, interestType: e.target.value})}
                        >
                          {interestTypeOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Reducing balance recalculates interest each installment. One-time charges a single upfront amount.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        {liabilityFormData.interestType === 'one_time' ? (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-sm font-medium mb-1">One-time Interest Input</label>
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
                                <option value="amount">Enter amount</option>
                                <option value="percentage">Enter percentage</option>
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
                                  placeholder="e.g. 5"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Converted to MWK automatically based on principal.
                                </p>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-sm font-medium mb-1">One-time Interest Amount</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full p-2 border border-gray-200 rounded"
                                  value={liabilityFormData.oneTimeInterestAmount}
                                  onChange={(e) => setLiabilityFormData({...liabilityFormData, oneTimeInterestAmount: e.target.value})}
                                  placeholder="Enter agreed interest amount"
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
                              <label className="block text-sm font-medium mb-1">Interest Rate Input</label>
                              <select
                                className="w-full p-2 border border-gray-200 rounded"
                                value={liabilityFormData.interestRateMode || "annual"}
                                onChange={(e) => setLiabilityFormData({...liabilityFormData, interestRateMode: e.target.value})}
                              >
                                <option value="annual">Annual percentage rate</option>
                                <option value="monthly">Monthly percentage rate</option>
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
                                Monthly rates are converted to an annual APR when calculating the schedule.
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
                          placeholder="Optional"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Updates automatically when you adjust the start or maturity date.
                        </p>
                      </div>
                    </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Start Date *</label>
                      <input
                        type="date"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={liabilityFormData.startDate}
                        onChange={(e) => setLiabilityFormData({...liabilityFormData, startDate: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Maturity Date</label>
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
                      <label className="block text-sm font-medium mb-1">Payment Frequency</label>
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
                      <label className="block text-sm font-medium mb-1">Lender/Creditor</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-200 rounded"
                        value={liabilityFormData.lender}
                        onChange={(e) => setLiabilityFormData({...liabilityFormData, lender: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Account Number</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-200 rounded"
                      value={liabilityFormData.accountNumber}
                      onChange={(e) => setLiabilityFormData({...liabilityFormData, accountNumber: e.target.value})}
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Notes</label>
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {liabilityEditId ? 'Update' : 'Create'} Liability
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Liability Modal */}
        {showLiabilityViewModal && viewLiability && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Liability Details</h2>
                  <button 
                    onClick={() => {
                      setShowLiabilityViewModal(false);
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
                    <h3 className="font-semibold mb-2">Basic Information</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Name:</span> {viewLiability.name}</div>
                      <div><span className="font-medium">Type:</span> {liabilityTypes.find(t => t.value === viewLiability.liabilityType)?.label || viewLiability.liabilityType}</div>
                      <div><span className="font-medium">Category:</span> {viewLiability.category.name}</div>
                      <div><span className="font-medium">Status:</span> 
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
                        <div><span className="font-medium">Description:</span> {viewLiability.description}</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Financial Information</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Principal Amount:</span> {formatCurrency(viewLiability.principalAmount)}</div>
                      <div><span className="font-medium">Current Balance:</span> {formatCurrency(viewLiability.currentBalance)}</div>
                      <div><span className="font-medium">Total Paid:</span> {formatCurrency(viewLiability.totalPaid)}</div>
                      <div><span className="font-medium">Interest Method:</span> {interestTypeOptions.find(opt => opt.value === viewLiability.interestType)?.label || 'Reducing Balance'}</div>
                      {viewLiability.interestType === 'one_time' ? (
                        <div><span className="font-medium">One-time Interest:</span> {formatCurrency(viewLiability.oneTimeInterestAmount || 0)}</div>
                      ) : (
                        <div><span className="font-medium">Interest Rate:</span> {viewLiability.interestRate ? `${viewLiability.interestRate}%` : 'N/A'}</div>
                      )}
                      <div><span className="font-medium">Term Length:</span> {viewLiability.termMonths ? `${viewLiability.termMonths} months` : 'N/A'}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Dates</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Start Date:</span> {new Date(viewLiability.startDate).toLocaleDateString()}</div>
                      {viewLiability.maturityDate && (
                        <div><span className="font-medium">Maturity Date:</span> {new Date(viewLiability.maturityDate).toLocaleDateString()}</div>
                      )}
                      <div><span className="font-medium">Payment Frequency:</span> {paymentFrequencies.find(f => f.value === viewLiability.paymentFrequency)?.label || viewLiability.paymentFrequency || 'N/A'}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Additional Information</h3>
                    <div className="space-y-2 text-sm">
                      {viewLiability.lender && (
                        <div><span className="font-medium">Lender:</span> {viewLiability.lender}</div>
                      )}
                      {viewLiability.accountNumber && (
                        <div><span className="font-medium">Account Number:</span> {viewLiability.accountNumber}</div>
                      )}
                      {viewLiability.notes && (
                        <div><span className="font-medium">Notes:</span> {viewLiability.notes}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                {paymentSchedule && paymentSchedule.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Projected Payment Schedule</h3>
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
                            <th className="p-2 font-medium">Due Date</th>
                            <th className="p-2 font-medium text-right">Principal</th>
                            <th className="p-2 font-medium text-right">Interest</th>
                            <th className="p-2 font-medium text-right">Payment</th>
                            <th className="p-2 font-medium text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentSchedule.map(row => (
                            <tr key={row.period} className="border-t border-gray-100">
                              <td className="p-2">{row.period}</td>
                              <td className="p-2">{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '-'}</td>
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
                    <h3 className="font-semibold mb-3">Payment History</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="p-2 font-medium">Date</th>
                            <th className="p-2 font-medium text-right">Amount</th>
                            <th className="p-2 font-medium text-right">Principal</th>
                            <th className="p-2 font-medium text-right">Interest</th>
                            <th className="p-2 font-medium">Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewLiability.payments.map((payment) => (
                            <tr key={payment.id} className="border-t border-gray-200">
                              <td className="p-2">{new Date(payment.paymentDate).toLocaleDateString()}</td>
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
                    setShowLiabilityViewModal(false);
                    setViewLiability(null);
                  }}
                >
                  Close
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => {
                    setShowLiabilityViewModal(false);
                    handleEditLiability(viewLiability);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && paymentLiability && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">

              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Record Payment</h2>
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
                      <div><span className="font-medium">Liability:</span> {paymentLiability.name}</div>
                      <div><span className="font-medium">Current Balance:</span> {formatCurrency(paymentLiability.currentBalance)}</div>
                    </div>
                  </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">Deduct From Account</label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded"
                        value={paymentFormData.paymentMethod || ''}
                        onChange={(e) => setPaymentFormData({...paymentFormData, paymentMethod: e.target.value})}
                        disabled={!paymentAccounts.length}
                        required
                      >
                        {!paymentAccounts.length && <option value="">No payment accounts found</option>}
                        {paymentAccounts.map((account) => (
                          <option key={account.key} value={account.key}>
                            {account.name} · Balance {formatCurrency(account.balance || 0)}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Uses the same payment accounts configured under Payment Processing.
                      </p>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">Payment Entry</label>
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
                        <option value="custom">Custom amount</option>
                        <option value="schedule" disabled={paymentScheduleOptions.length === 0}>
                          Scheduled installment
                        </option>
                      </select>
                    </div>
                    {paymentEntryMode === "schedule" && paymentScheduleOptions.length > 0 && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Select Scheduled Installment</label>
                        <select
                          className="w-full p-2 border border-gray-200 rounded"
                          value={selectedScheduleIndex}
                          onChange={(e) => handleScheduledPaymentSelection(e.target.value)}
                        >
                          <option value="">Choose installment</option>
                          {paymentScheduleOptions.map((entry, idx) => (
                            <option key={idx} value={idx}>
                              {`#${entry.period} – ${entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : 'No date'} – ${formatCurrency(entry.payment || 0)}`}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Amount, principal, and interest auto-fill from the selected schedule.
                        </p>
                      </div>
                    )}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Payment Amount *</label>
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
                    <label className="block text-sm font-medium mb-1">Payment Date *</label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-200 rounded"
                      value={paymentFormData.paymentDate}
                      onChange={(e) => setPaymentFormData({...paymentFormData, paymentDate: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Payment Type</label>
                    <select
                      className="w-full p-2 border border-gray-200 rounded"
                      value={paymentFormData.paymentType}
                      onChange={(e) => setPaymentFormData({...paymentFormData, paymentType: e.target.value})}
                    >
                      <option value="both">Principal + Interest</option>
                      <option value="principal">Principal Only</option>
                      <option value="interest">Interest Only</option>
                    </select>
                  </div>
                  {paymentFormData.paymentType === 'both' && (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Principal Paid</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full p-2 border border-gray-200 rounded"
                          value={paymentFormData.principalPaid}
                          onChange={(e) => setPaymentFormData({...paymentFormData, principalPaid: e.target.value})}
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Interest Paid</label>
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
                    <label className="block text-sm font-medium mb-1">Reference</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-200 rounded"
                      value={paymentFormData.reference}
                      onChange={(e) => setPaymentFormData({...paymentFormData, reference: e.target.value})}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Notes</label>
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetManagement;

