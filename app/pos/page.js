"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  Search, 
  User, 
  Users, 
  ChevronDown, 
  Loader, 
  Check, 
  Trash2, 
  Edit3,
  Calculator,
  Receipt,
  DollarSign,
  Package,
  AlertCircle,
  Save,
  RefreshCw,
  Calendar,
  Info,
  CheckCircle,
  Ban,
  RotateCcw,
  Percent,
  ArrowRight,
  Download,
  Upload,
  FileText,
  UserPlus,
  Printer,
  CreditCard,
  Smartphone,
  BarChart,
  Wifi,
  WifiOff,
  Shield,
  Globe,
  Lock,
  Building2,
  LayoutGrid,
  List

} from 'lucide-react';
import { 
  fetchSales, 
  createSale, 
  getSalesStatistics,
  fetchProductsForSale,
  fetchProductsForSaleAll,
  fetchClients,
  printReceipt,
  voidSale,
  refundSale
} from "@/app/services/salesService";
import { calculateSaleItemTaxes } from "@/lib/productTaxCalculations";
import ClientModal from "@/components/ClientModal";
import ClientSearchCombobox from "@/components/ClientSearchCombobox";
import PermissionGuard from "@/components/PermissionGuard";
import UnitBasedQuantityInput from "@/components/UnitBasedQuantityInput";
import { getPermission } from "@/lib/permissions";
import { getPaymentMethodName, paymentMethods } from '@/lib/paymentMethods';
import {
  queueOfflineSale, syncOfflineSales, checkOfflineThresholds,
  getOfflineSalesCount, getPendingOfflineSales
} from '@/lib/offlineSalesQueue';

const POSPage = () => {
  const router = useRouter();
  
  // Tab and customer selection
  const [activeTab, setActiveTab] = useState("walkIn");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  
  // Historical transaction state
  const [historicalDate, setHistoricalDate] = useState('');
  const [originalReference, setOriginalReference] = useState('');
  const [migrationBatch, setMigrationBatch] = useState('');
  
  // Batch upload state
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);
  
  // Sales data
  const [recentSales, setRecentSales] = useState([]);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [salesError, setSalesError] = useState(null);
  const [statistics, setStatistics] = useState({
    total: { count: 0, amount: '0' },
    voided: { count: 0, amount: '0' },
    refunded: { count: 0, amount: '0' },
    taxCollected: { amount: '0' },
    byPaymentMethod: []
  });

  // Daily POS report (one calendar day) for quick overview
  const [dailyReportDate, setDailyReportDate] = useState(() => {
    const t = new Date();
    return t.toISOString().slice(0, 10);
  });
  const [dailyReport, setDailyReport] = useState(null);
  const [isLoadingDailyReport, setIsLoadingDailyReport] = useState(false);
  /** POS cash register (opening/closing/deposits) + daily report payload from /api/pos/cash-day */
  const [posCashDayState, setPosCashDayState] = useState(null);
  const [posCashActionLoading, setPosCashActionLoading] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositLines, setDepositLines] = useState([{ toAccountId: '', amount: '', notes: '' }]);
  const [posCashMessage, setPosCashMessage] = useState(null);
  
  // Products
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  /** When true, show a scrollable grid of products (filtered by search) for click-to-add */
  const [productPickerGrid, setProductPickerGrid] = useState(true);
  
  // Clients
  const [clients, setClients] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [filteredClients, setFilteredClients] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Income accounts for Chart of Accounts
  const [incomeAccounts, setIncomeAccounts] = useState([]);
  const [defaultIncomeAccountId, setDefaultIncomeAccountId] = useState(null);
  /** Latest resolved default income CoA id (updated when loadIncomeAccounts succeeds; avoids stale React state at checkout). */
  const defaultIncomeAccountIdRef = useRef(null);
  /** Deduplicate overlapping income-account fetches (mount + cart effect + checkout). */
  const incomeAccountsInFlightRef = useRef(null);
  
  // Current sale state
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(""); // Start empty, will be set when accounts load
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [isLoadingPaymentAccounts, setIsLoadingPaymentAccounts] = useState(true);
  const [paymentAllocations, setPaymentAllocations] = useState([]); // [{ paymentAccountId, amount }]
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [currentTenantId, setCurrentTenantId] = useState(null);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [isSwitchingBusiness, setIsSwitchingBusiness] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);
  const [saleError, setSaleError] = useState(null);
  const [saleNotes, setSaleNotes] = useState("");
  /** Cash tendered at POS (optional); used with sale total to compute change on receipt */
  const [posPaidAmount, setPosPaidAmount] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  
  // Custom product entry
  const [showCustomProduct, setShowCustomProduct] = useState(false);
  const [customProduct, setCustomProduct] = useState({
    name: "",
    price: "",
    description: ""
  });
  
  // Tax types for manual tax application; default for inflow (sales) auto-populated from settings
  const [posTaxTypes, setPosTaxTypes] = useState([]);
  const [defaultTaxTypeForInflow, setDefaultTaxTypeForInflow] = useState(null);
  const [defaultTaxInflowAccountId, setDefaultTaxInflowAccountId] = useState(null);
  const [taxAccounts, setTaxAccounts] = useState([]);
  const [openTaxDropdownId, setOpenTaxDropdownId] = useState(null);
  const [posTaxSearch, setPosTaxSearch] = useState('');
  const [isAddingPosTax, setIsAddingPosTax] = useState(false);
  const [newPosTax, setNewPosTax] = useState({ taxName: '', taxRate: '', accountId: '' });
  const [addingPosTaxLoading, setAddingPosTaxLoading] = useState(false);
  const taxDropdownRef = useRef(null);

  // Void/Refund modals
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedSaleForAction, setSelectedSaleForAction] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isProcessingVoid, setIsProcessingVoid] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  // Receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  
  // References
  const productSearchRef = useRef(null);
  const receiptModalRef = useRef(null);
  
  // Add state for showing the client modal
  const [showClientModal, setShowClientModal] = useState(false);
  const [pagePermissions, setPagePermissions] = useState({ 
    canVoidSales: false,
    canCreateSales: false,
    canDeleteSales:false, 
    canExportSales:false, 
    canRefundSales:false, 
    canUpdateSales:false,
  });

  // ── EIS / MRA compliance state ───────────────────────────────
  const [transactionType, setTransactionType] = useState('B2C'); // B2B or B2C
  const [buyerTPIN, setBuyerTPIN] = useState('');
  const [buyerAuthCode, setBuyerAuthCode] = useState('');
  const [isReliefSupply, setIsReliefSupply] = useState(false);
  const [vat5CertificateNumber, setVat5CertificateNumber] = useState('');
  const [vat5Validated, setVat5Validated] = useState(false);
  const [vat5Validating, setVat5Validating] = useState(false);
  const [vat5Error, setVat5Error] = useState('');
  const [serverTime, setServerTime] = useState(null);
  const [serverTimeSource, setServerTimeSource] = useState('local');
  const [terminalBlocked, setTerminalBlocked] = useState(false);
  const [terminalBlockMessage, setTerminalBlockMessage] = useState('');
  const [eisEnabled, setEisEnabled] = useState(false);

  // ── Offline state (TC-OFF-007/008/009) ───────────────────────
  const [isOnline, setIsOnline] = useState(true);
  const [offlineSalesCount, setOfflineSalesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineBlocked, setOfflineBlocked] = useState(null);

  useEffect(() => {
    const fetchPermissions = async () => { 
      const canVoidSales = await getPermission("sales.void");
      const canCreateSales = await getPermission("sales.create");
      const canDeleteSales = await getPermission("sales.delete");
      const canExportSales = await getPermission("sales.export"); 
      const canRefundSales = await getPermission("sales.refund");
      const canUpdateSales = await getPermission("sales.update"); 
  
      setPagePermissions({ 
        canVoidSales,
        canCreateSales,
        canDeleteSales, 
        canExportSales, 
        canRefundSales, 
        canUpdateSales,   
        });
    };
  
    fetchPermissions();
  }, []);

  // Fetch active tax types and default tax for inflow (sales) for auto-population
  const fetchPosTaxTypes = async () => {
    try {
      const [taxRes, defaultsRes] = await Promise.all([
        fetch('/api/tax-types?status=Active'),
        fetch('/api/settings/tax-defaults').catch(() => null)
      ]);
      if (taxRes.ok) {
        const data = await taxRes.json();
        setPosTaxTypes(Array.isArray(data.taxTypes) ? data.taxTypes : []);
      }
      if (defaultsRes?.ok) {
        const defaults = await defaultsRes.json();
        setDefaultTaxTypeForInflow(defaults.defaultTaxTypeForInflow || null);
        setDefaultTaxInflowAccountId(defaults.taxInflowAccountId || null);
      }
    } catch (err) {
      console.error('Error loading tax types:', err);
    }
  };

  const fetchPosTaxAccounts = async () => {
    try {
      const res = await fetch('/api/tax-types/accounts');
      if (res.ok) {
        const data = await res.json();
        setTaxAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      }
    } catch (err) {
      console.error('Error loading tax accounts:', err);
    }
  };

  useEffect(() => {
    fetchPosTaxTypes();
  }, []);

  // When opening "add new tax" form, pre-fill account with default inflow account
  useEffect(() => {
    if (isAddingPosTax && defaultTaxInflowAccountId && !newPosTax.accountId) {
      setNewPosTax(prev => ({ ...prev, accountId: defaultTaxInflowAccountId }));
    }
  }, [isAddingPosTax, defaultTaxInflowAccountId]);

  // Close tax dropdown on outside click
  useEffect(() => {
    const handleTaxClickOutside = (e) => {
      if (taxDropdownRef.current && !taxDropdownRef.current.contains(e.target)) {
        setOpenTaxDropdownId(null);
        setIsAddingPosTax(false);
        setPosTaxSearch('');
      }
    };
    document.addEventListener('mousedown', handleTaxClickOutside);
    return () => document.removeEventListener('mousedown', handleTaxClickOutside);
  }, []);

  // Apply a tax type to a cart item
  const applyTaxToProduct = (productId, taxType) => {
    setSelectedProducts(prev => prev.map(product => {
      if (product.id !== productId) return product;
      const taxes = [{
        id: taxType.id, taxId: taxType.taxId, taxName: taxType.taxName,
        taxCode: taxType.taxCode, taxRate: Number(taxType.taxRate),
        calculationType: taxType.calculationType || 'Percentage'
      }];
      const taxCalc = calculateSaleItemTaxes({
        quantity: product.quantity || 1,
        unitPrice: product.price,
        discountAmount: product.discountAmount || 0,
        taxes
      });
      return {
        ...product,
        taxes,
        taxAmount: taxCalc.totalTaxAmount,
        taxBreakdown: taxCalc.taxBreakdown,
        taxDescription: taxType.taxName
      };
    }));
    setOpenTaxDropdownId(null);
    setPosTaxSearch('');
  };

  // Remove tax from a cart item
  const removeTaxFromProduct = (productId) => {
    setSelectedProducts(prev => prev.map(product => {
      if (product.id !== productId) return product;
      return {
        ...product,
        taxes: [],
        taxAmount: 0,
        taxBreakdown: [],
        taxDescription: ''
      };
    }));
  };

  // Create a new tax type from POS
  const handleCreatePosTaxType = async () => {
    if (!newPosTax.taxName.trim() || newPosTax.taxRate === '' || !newPosTax.accountId) return;
    setAddingPosTaxLoading(true);
    try {
      const taxId = newPosTax.taxName.trim().toUpperCase().replace(/\s+/g, '-');
      const res = await fetch('/api/tax-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxId,
          taxName: newPosTax.taxName.trim(),
          taxRate: parseFloat(newPosTax.taxRate),
          calculationType: 'Percentage',
          accountId: newPosTax.accountId,
          status: 'Active',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create tax type');
        return;
      }
      const created = await res.json();
      await fetchPosTaxTypes();
      // Apply the newly created tax to the product that has the dropdown open
      if (openTaxDropdownId) {
        applyTaxToProduct(openTaxDropdownId, created);
      }
      setIsAddingPosTax(false);
      setNewPosTax({ taxName: '', taxRate: '', accountId: '' });
    } catch (err) {
      console.error('Error creating tax type:', err);
      alert('Failed to create tax type');
    } finally {
      setAddingPosTaxLoading(false);
    }
  };

  // NOTE: Branch switching option was removed from POS by request.
  // Branch context (if any) is taken from the server session/user defaults.

  const loadTenants = async () => {
    try {
      setIsLoadingTenants(true);
      const res = await fetch('/api/tenant/list', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
        setCurrentTenantId(data.currentTenantId || null);
      }
    } catch (e) {
      console.error('Failed to load businesses:', e);
    } finally {
      setIsLoadingTenants(false);
    }
  };

  /** Reload POS-scoped data for the active business (tenant). */
  const refreshPosData = async () => {
    await Promise.all([
      loadRecentSales(),
      loadProducts(),
      loadClients(),
      loadStatistics(),
      loadPaymentAccounts(),
      loadIncomeAccounts(),
      fetchPosTaxTypes(),
      loadDailyReport(dailyReportDate),
      loadEISStatus(),
    ]);
  };

  const handleTenantChange = async (e) => {
    const tenantId = e.target.value;
    if (!tenantId || tenantId === currentTenantId) return;
    setIsSwitchingBusiness(true);
    try {
      const res = await fetch('/api/tenant/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
    } catch (err) {
      console.error('Business switch failed:', err);
    } finally {
      setIsSwitchingBusiness(false);
    }
  };

  // Load payment accounts
  const loadPaymentAccounts = async () => {
    try {
      setIsLoadingPaymentAccounts(true);
      const response = await fetch('/api/payment-accounts?activeOnly=true', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.paymentAccounts) {
          setPaymentAccounts(data.paymentAccounts);
          // Set default to first active account (prefer Cash if exists)
          const cashAccount = data.paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive);
          const defaultAccount = cashAccount || data.paymentAccounts.find(acc => acc.isActive) || data.paymentAccounts[0];
          if (defaultAccount) {
            setPaymentMethod(defaultAccount.id); // Use account ID
            setPaymentAllocations([{ paymentAccountId: defaultAccount.id, amount: 0 }]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load payment accounts:', error);
    } finally {
      setIsLoadingPaymentAccounts(false);
    }
  };

  // Load income accounts from Chart of Accounts.
  // Returns resolved data so callers can use IDs immediately (setState is async — avoids race when checkout runs before this fetch completes).
  const loadIncomeAccounts = useCallback(async () => {
    if (incomeAccountsInFlightRef.current) {
      return incomeAccountsInFlightRef.current;
    }
    const promise = (async () => {
      try {
        const response = await fetch('/api/chart-of-accounts/income-accounts', { cache: 'no-store' });

        if (response.ok) {
          const data = await response.json();
          const accounts = data.accounts || [];
          setIncomeAccounts(accounts);

          const normCode = (c) => String(c ?? '').trim();
          const defaultAccount =
            accounts.find((acc) => normCode(acc.accountCode) === '4000') ||
            accounts.find((acc) => normCode(acc.accountCode) === '4100') ||
            accounts.find((acc) => acc.isActive !== false) ||
            accounts[0];

          let resolvedDefaultId = null;
          if (defaultAccount) {
            resolvedDefaultId = defaultAccount.id;
            defaultIncomeAccountIdRef.current = resolvedDefaultId;
            setDefaultIncomeAccountId(resolvedDefaultId);
            console.log('✅ Income account loaded:', defaultAccount.accountName, defaultAccount.accountCode);
          } else {
            defaultIncomeAccountIdRef.current = null;
            console.warn('No income accounts found. Sales will fail without accountId.');
          }
          return { accounts, defaultIncomeAccountId: resolvedDefaultId };
        }

        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to load income accounts:', response.status, errorData);
        defaultIncomeAccountIdRef.current = null;
        return { accounts: [], defaultIncomeAccountId: null };
      } catch (error) {
        console.error('Failed to load income accounts:', error);
        return { accounts: [], defaultIncomeAccountId: null };
      } finally {
        incomeAccountsInFlightRef.current = null;
      }
    })();
    incomeAccountsInFlightRef.current = promise;
    return promise;
  }, []);

  // Reload income accounts whenever a line is added or removed (length changes). Keeps default CoA ready before checkout without spamming on every keystroke.
  useEffect(() => {
    if (selectedProducts.length === 0) return;
    loadIncomeAccounts();
  }, [selectedProducts.length, loadIncomeAccounts]);

  // Load recent sales, products, and clients on initial render
  useEffect(() => {
    loadTenants();
    loadRecentSales();
    loadProducts();
    loadClients();
    loadStatistics();
    loadPaymentAccounts();
    loadIncomeAccounts();
    // Daily POS report defaults to today (calendar day)
    loadDailyReport(dailyReportDate);
    
    // EIS: Check terminal status and sync server time
    loadEISStatus();

    // Offline support: track connectivity and auto-sync
    const goOnline = async () => {
      setIsOnline(true);
      // Auto-sync queued sales when back online
      const count = await getOfflineSalesCount();
      if (count > 0) {
        setIsSyncing(true);
        try {
          const results = await syncOfflineSales();
          if (results.synced > 0) {
            setSaleSuccess(true);
            setTimeout(() => setSaleSuccess(false), 5000);
            loadRecentSales();
            loadStatistics();
          }
          setOfflineSalesCount(results.total - results.synced);
        } catch (err) {
          console.error('Auto-sync failed:', err);
        } finally {
          setIsSyncing(false);
        }
      }
    };
    const goOffline = async () => {
      setIsOnline(false);
      const threshold = await checkOfflineThresholds();
      setOfflineBlocked(threshold.blocked ? threshold.message : null);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setIsOnline(navigator.onLine);

    // Check pending offline sales and thresholds
    getOfflineSalesCount().then(setOfflineSalesCount);
    if (!navigator.onLine) {
      checkOfflineThresholds().then(t => setOfflineBlocked(t.blocked ? t.message : null));
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── EIS helpers ──────────────────────────────────────────────
  const loadEISStatus = async () => {
    try {
      // Check if tenant has EIS subscription
      const configRes = await fetch('/api/eis/health').catch(() => null);
      if (!configRes?.ok) return;
      const health = await configRes.json();
      if (!health.configured) return; // Tenant doesn't have EIS plan

      setEisEnabled(health.mraConnected || false);

      // Sync server time (TC-INV-003)
      const timeRes = await fetch('/api/eis/server-time').catch(() => null);
      if (timeRes?.ok) {
        const timeData = await timeRes.json();
        setServerTime(timeData.serverTime);
        setServerTimeSource(timeData.source || 'local');
      }

      // Check terminal block status (TC-INV-014)
      const blockRes = await fetch('/api/eis/terminal-status').catch(() => null);
      if (blockRes?.ok) {
        const blockData = await blockRes.json();
        if (blockData.blocked) {
          setTerminalBlocked(true);
          setTerminalBlockMessage(blockData.reason || 'Terminal has been blocked by MRA. Contact the tax authority.');
        }
      }
    } catch (err) {
      console.warn('EIS status check failed:', err.message);
    }
  };

  const validateVat5 = async () => {
    if (!vat5CertificateNumber.trim()) {
      setVat5Error('VAT 5 Certificate Number is required');
      return false;
    }
    setVat5Validating(true);
    setVat5Error('');
    try {
      const res = await fetch('/api/eis/vat5-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificateNumber: vat5CertificateNumber.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setVat5Validated(true);
        return true;
      } else {
        setVat5Error(data.error || 'Invalid VAT 5 certificate');
        setVat5Validated(false);
        return false;
      }
    } catch (err) {
      setVat5Error('Failed to validate certificate: ' + err.message);
      setVat5Validated(false);
      return false;
    } finally {
      setVat5Validating(false);
    }
  };
  
  // Filter products based on search query (name, SKU, or barcode; barcode matches prefix so product appears before finishing)
  useEffect(() => {
    if (productSearchQuery.trim() === "") {
      setFilteredProducts(products);
    } else {
      const query = productSearchQuery.toLowerCase().trim();
      const filtered = products.filter(
        product => {
          if (product.name.toLowerCase().includes(query)) return true;
          if (product.sku && product.sku.toLowerCase().includes(query)) return true;
          const matchBarcode = (b) => {
            if (!b) return false;
            const b2 = String(b).toLowerCase().trim();
            return b2 === query || b2.startsWith(query);
          };
          if (product.barcode && matchBarcode(product.barcode)) return true;
          if (product.barcodes && product.barcodes.some(matchBarcode)) return true;
          return false;
        }
      );
      setFilteredProducts(filtered);
    }
  }, [productSearchQuery, products]);
  
  // Filter clients based on search query
  useEffect(() => {
    if (clientSearchQuery.trim() === "") {
      setFilteredClients(clients);
    } else {
      const query = clientSearchQuery.toLowerCase();
      const filtered = clients.filter(
        client => 
          client.name.toLowerCase().includes(query) || 
          (client.email && client.email.toLowerCase().includes(query))
      );
      setFilteredClients(filtered);
    }
  }, [clientSearchQuery, clients]);

  // Update search query when a customer is selected
  useEffect(() => {
    if (selectedCustomer && selectedCustomer !== "") {
      const selectedClient = clients.find(client => client.id === selectedCustomer);
      if (selectedClient) {
        setClientSearchQuery(selectedClient.name);
      }
    }
  }, [selectedCustomer, clients]);

  // Handle client search input changes
  const handleClientSearchChange = (e) => {
    const value = e.target.value;
    setClientSearchQuery(value);
    
    // If the search is cleared, clear the selection
    if (value.trim() === "") {
      setSelectedCustomer("");
    }
  };
  
  // Close modals when escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showProductSearch) setShowProductSearch(false);
        if (showReceiptModal) setShowReceiptModal(false);
        if (showCustomProduct) setShowCustomProduct(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProductSearch, showReceiptModal, showCustomProduct]);
  
  // Handle clicks outside of modals
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target)) {
        setShowProductSearch(false);
      }
      if (receiptModalRef.current && !receiptModalRef.current.contains(e.target) && showReceiptModal) {
        setShowReceiptModal(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReceiptModal]);
  
  // Reset success and error messages after 5 seconds
  useEffect(() => {
    if (saleSuccess || saleError) {
      const timer = setTimeout(() => {
        setSaleSuccess(false);
        setSaleError(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [saleSuccess, saleError]);
  
  // Load recent sales
  const loadRecentSales = async () => {
    try {
      setIsLoadingSales(true);
      setSalesError(null);
      
      const response = await fetchSales({
        limit: 5,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setRecentSales(response.sales || []);
    } catch (error) {
      console.error("Error loading sales:", error);
      setSalesError(error?.message || "Failed to load recent sales");
    } finally {
      setIsLoadingSales(false);
    }
  };
  
  // Load sales statistics
  const loadStatistics = async () => {
    try {
      const stats = await getSalesStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
      // Don't set error state for statistics, just log it
    }
  };

  // Load daily POS report for the selected date
  const loadDailyReport = useCallback(async (date) => {
    try {
      setIsLoadingDailyReport(true);
      setPosCashMessage(null);
      const res = await fetch(`/api/pos/cash-day?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.report) {
        setDailyReport(data.report);
        setPosCashDayState(data);
        return;
      }
      const res2 = await fetch(
        `/api/reports/pos-daily?date=${encodeURIComponent(date)}&allBranches=true`,
        { cache: 'no-store' }
      );
      const data2 = await res2.json().catch(() => ({}));
      if (!res2.ok) {
        throw new Error(data2?.error || data?.error || 'Failed to load daily POS report');
      }
      setDailyReport(data2);
      setPosCashDayState(null);
    } catch (err) {
      console.error('Error loading daily POS report:', err);
      setDailyReport(null);
      setPosCashDayState(null);
    } finally {
      setIsLoadingDailyReport(false);
    }
  }, []);

  const openPosRegisterDay = async () => {
    try {
      setPosCashActionLoading(true);
      const res = await fetch('/api/pos/cash-day/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessDate: dailyReportDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not open day');
      setPosCashMessage('Day opened. Opening balance matches the system Cash account balance from Payment Management.');
      await loadDailyReport(dailyReportDate);
    } catch (e) {
      alert(e?.message || 'Open day failed');
    } finally {
      setPosCashActionLoading(false);
    }
  };

  const closePosRegisterDay = async () => {
    if (!window.confirm('Close this POS day? Closing balance will be recorded as opening + total sales.')) return;
    try {
      setPosCashActionLoading(true);
      const res = await fetch('/api/pos/cash-day/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessDate: dailyReportDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not close day');
      setPosCashMessage('Day closed.');
      await loadDailyReport(dailyReportDate);
    } catch (e) {
      alert(e?.message || 'Close day failed');
    } finally {
      setPosCashActionLoading(false);
    }
  };

  const submitPosDeposits = async () => {
    const lines = depositLines
      .map((row) => ({
        toAccountId: (row.toAccountId || '').trim(),
        amount: parseFloat(String(row.amount).replace(/,/g, '')) || 0,
        notes: (row.notes || '').trim() || null,
      }))
      .filter((r) => r.toAccountId && r.amount > 0);
    if (!lines.length) {
      alert('Add at least one destination account and a positive amount.');
      return;
    }
    try {
      setPosCashActionLoading(true);
      const res = await fetch('/api/pos/cash-day/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessDate: dailyReportDate, lines }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Deposit failed');
      setShowDepositModal(false);
      setDepositLines([{ toAccountId: '', amount: '', notes: '' }]);
      setPosCashMessage('Deposit recorded.');
      await loadDailyReport(dailyReportDate);
    } catch (e) {
      alert(e?.message || 'Deposit failed');
    } finally {
      setPosCashActionLoading(false);
    }
  };

  // Load products
  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true);
      setProductsError(null);
      
      const productsData = await fetchProductsForSaleAll({
        pageSize: 100,
        allBranches: true,
      });
      setProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error) {
      console.error("Error loading products:", error);
      setProductsError("Failed to load products");
      
      const sampleProducts = [
      ];
      setProducts(sampleProducts);
      setFilteredProducts(sampleProducts);
    } finally {
      setIsLoadingProducts(false);
    }
  };
  
  // Load clients
  const loadClients = async () => {
    try {
      setIsLoadingClients(true);
      setClientsError(null);
      
      // Fetch clients from the API
      const clientsData = await fetchClients({ limit: 100 });
      setClients(clientsData);
      setFilteredClients(clientsData);
    } catch (error) {
      console.error("Error loading clients:", error);
      setClientsError("Failed to load clients");
      
      // Use sample data if API fails
      const sampleClients = [
        { id: "1", name: "Acme Corp", email: "info@acmecorp.com" },
        { id: "2", name: "John Doe", email: "john@example.com" },
        { id: "3", name: "Tech Solutions Ltd", email: "contact@techsolutions.com" },
      ];
      setClients(sampleClients);
      setFilteredClients(sampleClients);
    } finally {
      setIsLoadingClients(false);
    }
  };
  
  // Helper function to check if product has unit management enabled
  const hasUnitManagement = (product) => {
    const hasUnits = !!(product?.units && product.units.length > 0);
    console.log("=== UNIT MANAGEMENT CHECK ===");
    console.log("Product:", product?.name);
    console.log("Has units property:", !!product?.units);
    console.log("Units length:", product?.units?.length || 0);
    console.log("Has unit management:", hasUnits);
    console.log("=============================");
    return hasUnits;
  };
  
  // Add product to the current sale
  const addProduct = async (product, qty = quantity) => {
    if (!product) return;
    
    // Always fetch full product details to know if units are configured
    let detailedProduct = product;
    console.log("=== ADD PRODUCT DEBUG ===");
    console.log("Product ID:", product.id);
    console.log("Product name:", product.name);
    
    try {
      console.log("Fetching product details from API...");
      const res = await fetch(`/api/stock/${product.id}`);
      console.log("API response status:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log("API response data:", data);
        
        // The API returns the product data directly, not wrapped in a 'product' property
        if (data && (data.product || data.id)) {
          const productData = data.product || data;
          console.log("=== POS PRODUCT DETAILS DEBUG ===");
          console.log("Product ID:", product.id);
          console.log("Raw API response:", JSON.stringify(productData, null, 2));
          
          // The API now returns units in the correct format
          const units = Array.isArray(productData.units) ? productData.units : [];
          const taxes = Array.isArray(productData.taxes) ? productData.taxes : [];
          console.log("Units found:", units.length);
          console.log("Units data:", units);
          console.log("=== TAXES DEBUG ===");
          console.log("Taxes found:", taxes.length);
          console.log("Taxes data:", JSON.stringify(taxes, null, 2));
          console.log("================================");

          detailedProduct = {
            ...product,
            ...productData,
            units: units,
            taxes: taxes // Ensure taxes are included
          };
          
          console.log("Detailed product with units and taxes:", {
            name: detailedProduct.name,
            taxes: detailedProduct.taxes,
            taxesCount: detailedProduct.taxes?.length || 0
          });
        } else {
          console.log("No product data in API response");
        }
      } else {
        console.log("API request failed with status:", res.status);
      }
    } catch (e) {
      console.error("Error fetching product details:", e);
      // If detail fetch fails, proceed with basic product
    }
    
    console.log("Final detailed product:", detailedProduct);
    console.log("=========================");

    const isUnitManaged = hasUnitManagement(detailedProduct);

    // Determine initial quantity
    let parsedQty;
    if (isUnitManaged) {
      parsedQty = 1; // default to 1 base unit for unit-managed products
    } else {
      parsedQty = parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setSaleError("Quantity must be a positive number");
      return;
      }
    }

    // Stock check only for regular products (unit-managed will validate per-unit in UI)
    if (!isUnitManaged && detailedProduct.stockLevel !== null && detailedProduct.stockLevel < parsedQty) {
      setSaleError(`Only ${detailedProduct.stockLevel} units of ${detailedProduct.name} available in stock`);
      return;
    }
    
    const existingProduct = selectedProducts.find(p => p.id === detailedProduct.id);
    
    if (existingProduct) {
      // Recalculate taxes when updating existing product
      const productTaxes = detailedProduct.taxes || existingProduct.taxes || [];
      const newQuantity = isUnitManaged ? parsedQty : (existingProduct.quantity + parsedQty);
      const newSubtotal = existingProduct.price * newQuantity;
      const newDiscountAmount = (parseFloat(existingProduct.discount) || 0) * newQuantity;
      
      const taxCalculation = calculateSaleItemTaxes({
        quantity: newQuantity,
        unitPrice: existingProduct.price,
        discountAmount: newDiscountAmount,
        taxes: productTaxes
      });
      
      if (isUnitManaged) {
        setSelectedProducts(selectedProducts.map(p =>
          p.id === detailedProduct.id
            ? { 
                ...p, 
                ...detailedProduct, 
                quantity: parsedQty, 
                subtotal: p.price * parsedQty,
                taxes: productTaxes,
                taxAmount: taxCalculation.totalTaxAmount,
                taxBreakdown: taxCalculation.taxBreakdown,
                taxDescription: productTaxes.map(t => t.taxName).join(', ') || ''
              }
            : p
        ));
      } else {
        if (detailedProduct.stockLevel !== null && existingProduct.quantity + parsedQty > detailedProduct.stockLevel) {
          setSaleError(`Cannot add ${parsedQty} more units of ${detailedProduct.name}. Only ${detailedProduct.stockLevel - existingProduct.quantity} units available.`);
          return;
        }
        setSelectedProducts(selectedProducts.map(p => 
          p.id === detailedProduct.id
            ? { 
                ...p, 
                quantity: p.quantity + parsedQty, 
                subtotal: p.price * (p.quantity + parsedQty),
                taxes: productTaxes,
                taxAmount: taxCalculation.totalTaxAmount,
                taxBreakdown: taxCalculation.taxBreakdown,
                taxDescription: productTaxes.map(t => t.taxName).join(', ') || ''
              }
            : p
        ));
      }
    } else {
      // Determine initial price (base unit price for unit-managed)
      let initialPrice = detailedProduct.price;
      if (isUnitManaged) {
        const baseUnit = (detailedProduct.units || []).find(u => u.isBaseUnit);
        if (baseUnit && baseUnit.unitPrice != null) {
          initialPrice = parseFloat(baseUnit.unitPrice);
        }
      }

      // Use product's taxes from catalog, or auto-apply default tax (inflow) to avoid manual selection errors
      const productTaxes = (detailedProduct.taxes && detailedProduct.taxes.length > 0)
        ? detailedProduct.taxes
        : (defaultTaxTypeForInflow
            ? [{
                id: defaultTaxTypeForInflow.id,
                taxId: defaultTaxTypeForInflow.taxId,
                taxName: defaultTaxTypeForInflow.taxName,
                taxCode: defaultTaxTypeForInflow.taxCode || '',
                taxRate: Number(defaultTaxTypeForInflow.taxRate),
                calculationType: defaultTaxTypeForInflow.calculationType || 'Percentage'
              }]
            : []);
      console.log("=== TAX CALCULATION DEBUG ===");
      console.log("Product:", detailedProduct.name);
      console.log("Product taxes:", productTaxes);
      console.log("Taxes count:", productTaxes.length);
      console.log("Quantity:", parsedQty);
      console.log("Unit price:", initialPrice);
      
      const taxCalculation = calculateSaleItemTaxes({
        quantity: parsedQty,
        unitPrice: initialPrice,
        discountAmount: 0,
        taxes: productTaxes
      });
      
      console.log("Tax calculation result:", taxCalculation);
      console.log("Total tax amount:", taxCalculation.totalTaxAmount);
      console.log("Tax breakdown:", taxCalculation.taxBreakdown);
      console.log("==============================");

      // For unit-based products, initialize with empty unitQuantities
      // The UnitBasedQuantityInput will set the actual quantities and trigger tax recalculation
      const newProduct = {
        ...detailedProduct,
        quantity: parsedQty,
        subtotal: initialPrice * parsedQty,
        price: initialPrice,
        taxes: productTaxes, // Store taxes array
        taxRate: 0, // Legacy field for backward compatibility
        taxAmount: taxCalculation.totalTaxAmount,
        taxBreakdown: taxCalculation.taxBreakdown, // Store individual tax breakdown
        taxDescription: productTaxes.map(t => t.taxName).join(', ') || '',
        discount: 0,
        discountAmount: 0,
        isCustom: false
      };
      
      // Initialize unitQuantities for unit-based products
      if (isUnitManaged && detailedProduct.units) {
        const initialUnitQuantities = {};
        detailedProduct.units.forEach(unit => {
          // Initialize with 0, user will enter actual quantities
          initialUnitQuantities[unit.id] = 0;
        });
        newProduct.unitQuantities = initialUnitQuantities;
      }
      
      setSelectedProducts([...selectedProducts, newProduct]);
    }
    
    // Clear product selection
    setSelectedProduct("");
    setQuantity(1);
    setProductSearchQuery("");
    setShowProductSearch(false);
  };
  
  // Add custom product to the current sale
  const addCustomProduct = () => {
    const { name, price, description } = customProduct;
    
    if (!name.trim() || !price || parseFloat(price) <= 0) {
      setSaleError("Please enter a valid product name and price");
      return;
    }

    const defaultTaxes = defaultTaxTypeForInflow
      ? [{
          id: defaultTaxTypeForInflow.id,
          taxId: defaultTaxTypeForInflow.taxId,
          taxName: defaultTaxTypeForInflow.taxName,
          taxCode: defaultTaxTypeForInflow.taxCode || '',
          taxRate: Number(defaultTaxTypeForInflow.taxRate),
          calculationType: defaultTaxTypeForInflow.calculationType || 'Percentage'
        }]
      : [];
    const customTaxCalc = defaultTaxes.length > 0
      ? calculateSaleItemTaxes({ quantity, unitPrice: parseFloat(price), discountAmount: 0, taxes: defaultTaxes })
      : { totalTaxAmount: 0, taxBreakdown: [] };
    const customProd = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      stockLevel: null,
      isCustom: true,
      quantity: quantity,
      subtotal: parseFloat(price) * quantity,
      taxes: defaultTaxes,
      taxRate: defaultTaxes[0]?.taxRate ?? 0,
      taxAmount: customTaxCalc.totalTaxAmount,
      taxBreakdown: customTaxCalc.taxBreakdown,
      taxDescription: defaultTaxes.map(t => t.taxName).join(', ') || '',
      discount: 0,
      discountAmount: 0
    };

    setSelectedProducts([...selectedProducts, customProd]);
    
    // Reset form
    setCustomProduct({ name: "", price: "", description: "" });
    setQuantity(1);
    setShowCustomProduct(false);
  };
  
  // Update product tax rate and amount
  const updateProductTax = (productId, taxRate, taxDescription) => {
    setSelectedProducts(selectedProducts.map(product => {
      if (product.id === productId) {
        const newTaxAmount = product.subtotal * (parseFloat(taxRate) / 100);
        return {
          ...product,
          taxRate: parseFloat(taxRate) || 0,
          taxAmount: newTaxAmount,
          taxDescription: taxDescription || ""
        };
      }
      return product;
    }));
  };
  
  // Update product discount
  const updateProductDiscount = (productId, discount) => {
    console.log('🔍 Discount Debug:', {
      productId,
      discountInput: discount,
      discountParsed: parseFloat(discount) || 0
    });
    
    setSelectedProducts(selectedProducts.map(product => {
      if (product.id === productId) {
        // Treat entered discount as per-unit discount; total discount scales with quantity
        const perUnitDiscount = parseFloat(discount) || 0;
        const newDiscountAmount = perUnitDiscount * (product.quantity || 1);
        
        // Recalculate taxes after discount change
        const productTaxes = product.taxes || [];
        const taxCalculation = calculateSaleItemTaxes({
          quantity: product.quantity || 1,
          unitPrice: product.price,
          discountAmount: newDiscountAmount,
          taxes: productTaxes
        });
        
        console.log('💰 Product Discount Update:', {
          productName: product.name,
          productSubtotal: product.subtotal,
          perUnitDiscount,
          discountAmount: newDiscountAmount,
          taxAmount: taxCalculation.totalTaxAmount,
          newTotal: product.subtotal + taxCalculation.totalTaxAmount - newDiscountAmount
        });
        
        return {
          ...product,
          // Store per-unit discount entered by user
          discount: perUnitDiscount,
          discountAmount: newDiscountAmount,
          taxAmount: taxCalculation.totalTaxAmount,
          taxBreakdown: taxCalculation.taxBreakdown
        };
      }
      return product;
    }));
  };
  
  // Handle void sale
  const handleVoidSale = async () => {
    if (!selectedSaleForAction || !voidReason.trim()) {
      setSaleError("Please provide a reason for voiding the sale");
      return;
    }

    setIsProcessingVoid(true);
    try {
      await voidSale(selectedSaleForAction.id, voidReason);
      setSaleSuccess(true);
      setShowVoidModal(false);
      setVoidReason("");
      setSelectedSaleForAction(null);
      loadRecentSales();
      loadStatistics();
    } catch (error) {
      console.error("Error voiding sale:", error);
      setSaleError("Failed to void sale. Please try again.");
    } finally {
      setIsProcessingVoid(false);
    }
  };

  // Handle refund sale
  const handleRefundSale = async () => {
    if (!selectedSaleForAction || !refundReason.trim()) {
      setSaleError("Please provide a reason for the refund");
      return;
    }

    setIsProcessingRefund(true);
    try {
      await refundSale(selectedSaleForAction.id, refundReason);
      setSaleSuccess(true);
      setShowRefundModal(false);
      setRefundReason("");
      setSelectedSaleForAction(null);
      loadRecentSales();
      loadStatistics();
    } catch (error) {
      console.error("Error processing refund:", error);
      setSaleError("Failed to process refund. Please try again.");
    } finally {
      setIsProcessingRefund(false);
    }
  };
  
  // Handle quick add of a product
  const handleQuickAdd = (product) => {
    if (!product || (product.stockLevel !== null && product.stockLevel <= 0)) {
      return; // Don't add out-of-stock products
    }
    
    addProduct(product, 1);
  };
  
  // Update product quantity in the current sale
  const updateProductQuantity = (productId, newQuantity) => {
    const parsedQty = parseInt(newQuantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setSaleError("Quantity must be a positive number");
      return;
    }
    
    const product = products.find(p => p.id === productId);
    
    // Check if the new quantity exceeds stock level
    if (product && product.stockLevel !== null && parsedQty > product.stockLevel) {
      setSaleError(`Cannot set quantity to ${parsedQty}. Only ${product.stockLevel} units of ${product.name} available.`);
      return;
    }
    
    setSelectedProducts(selectedProducts.map(p => {
      if (p.id === productId) {
        const newSubtotal = p.price * parsedQty;
        const newDiscountAmount = (parseFloat(p.discount) || 0) * parsedQty;
        
        // Recalculate taxes after quantity change
        const productTaxes = p.taxes || [];
        const taxCalculation = calculateSaleItemTaxes({
          quantity: parsedQty,
          unitPrice: p.price,
          discountAmount: newDiscountAmount,
          taxes: productTaxes
        });
        
        return {
          ...p,
          quantity: parsedQty,
          subtotal: newSubtotal,
          discountAmount: newDiscountAmount,
          taxAmount: taxCalculation.totalTaxAmount,
          taxBreakdown: taxCalculation.taxBreakdown
        };
      }
      return p;
    }));
  };

  // Update product quantity for unit-managed products
  const updateUnitBasedQuantity = useCallback((productId, newQuantity) => {
    setSelectedProducts(prev => prev.map(product => {
      if (product.id === productId) {
        // When quantity changes, recalculate average price if subtotal exists
        const avgUnitPrice = newQuantity > 0 && product.subtotal ? product.subtotal / newQuantity : product.price;
        return {
          ...product,
          quantity: newQuantity,
          price: avgUnitPrice
        };
      }
      return product;
    }));
  }, []);

  // Update unit quantities for unit-managed products
  const updateUnitQuantities = useCallback((productId, unitQuantities) => {
    console.log("=== POS UNIT QUANTITIES UPDATE ===");
    console.log("Product ID:", productId);
    console.log("Unit Quantities:", unitQuantities);
    console.log("==================================");
    
    setSelectedProducts(prev => prev.map(product => {
      if (product.id === productId) {
        // Calculate total base quantity and total price from unitQuantities
        let totalBaseQuantity = 0;
        let totalPrice = 0;
        
        if (product.units && unitQuantities) {
          Object.entries(unitQuantities).forEach(([unitId, qty]) => {
            const unit = product.units.find(u => u.id === unitId);
            if (unit && qty > 0) {
              const conversionRate = parseFloat(unit.conversionToBase || 1);
              const convertedToBase = unit.isBaseUnit ? qty : qty / conversionRate;
              totalBaseQuantity += convertedToBase;
              
              const unitPrice = parseFloat(unit.unitPrice || 0);
              totalPrice += qty * unitPrice;
            }
          });
        }
        
        // Recalculate taxes based on the new total price
        const productTaxes = product.taxes || [];
        let taxAmount = product.taxAmount || 0;
        let taxBreakdown = product.taxBreakdown || [];
        
        if (productTaxes.length > 0 && totalPrice > 0) {
          const baseAmount = totalPrice - (product.discountAmount || 0);
          const quantityForTax = totalBaseQuantity > 0 ? totalBaseQuantity : (product.quantity || 1);
          
          // Calculate taxes directly on baseAmount
          taxBreakdown = productTaxes.map(tax => {
            let calculatedTaxAmount = 0;
            if (tax.calculationType === 'Fixed') {
              calculatedTaxAmount = (tax.taxRate || 0) * quantityForTax;
            } else {
              calculatedTaxAmount = baseAmount * ((tax.taxRate || 0) / 100);
            }
            
            return {
              taxTypeId: tax.id,
              taxId: tax.taxId,
              taxName: tax.taxName,
              taxCode: tax.taxCode,
              taxRate: tax.taxRate,
              calculationType: tax.calculationType,
              taxAmount: Number(calculatedTaxAmount.toFixed(2))
            };
          });
          
          taxAmount = Number(taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0).toFixed(2));
          
          console.log(`🔍 Recalculating tax after unit quantities change for ${product.name}:`, {
            unitQuantities,
            totalBaseQuantity,
            totalPrice,
            baseAmount,
            quantityForTax,
            taxBreakdown,
            totalTaxAmount: taxAmount
          });
        }
        
        return {
          ...product,
          unitQuantities: unitQuantities,
          quantity: totalBaseQuantity > 0 ? totalBaseQuantity : product.quantity,
          subtotal: totalPrice > 0 ? totalPrice : product.subtotal,
          taxAmount: taxAmount,
          taxBreakdown: taxBreakdown
        };
      }
      return product;
    }));
  }, []);

  // Update product price for unit-managed products
  // NOTE: This is called by UnitBasedQuantityInput when totalPrice changes
  // The newPrice is already the total price including all unit quantities
  const updateUnitBasedPrice = useCallback((productId, newPrice) => {
    setSelectedProducts(prev => prev.map(product => {
      if (product.id === productId) {
        // newPrice is the total price already calculated by UnitBasedQuantityInput from all unit quantities
        // We should use it directly as subtotal
        const currentQuantity = product.quantity || 1;
        const avgUnitPrice = currentQuantity > 0 ? newPrice / currentQuantity : newPrice;
        
        // Recalculate taxes based on the new subtotal (which already includes all quantities)
        const productTaxes = product.taxes || [];
        let taxAmount = product.taxAmount || 0;
        let taxBreakdown = product.taxBreakdown || [];
        
        if (productTaxes.length > 0 && newPrice > 0) {
          // Calculate total base quantity from unitQuantities for Fixed tax calculations
          let totalBaseQuantity = 0;
          if (product.units && product.unitQuantities) {
            Object.entries(product.unitQuantities).forEach(([unitId, qty]) => {
              const unit = product.units.find(u => u.id === unitId);
              if (unit && qty > 0) {
                const conversionRate = parseFloat(unit.conversionToBase || 1);
                const convertedToBase = unit.isBaseUnit ? qty : qty / conversionRate;
                totalBaseQuantity += convertedToBase;
              }
            });
          }
          
          // Use newPrice directly as the base amount (it already includes all quantities)
          const baseAmount = newPrice - (product.discountAmount || 0);
          const quantityForTax = totalBaseQuantity > 0 ? totalBaseQuantity : currentQuantity;
          
          // Calculate taxes directly on baseAmount (which is the total price for all quantities)
          taxBreakdown = productTaxes.map(tax => {
            let calculatedTaxAmount = 0;
            if (tax.calculationType === 'Fixed') {
              // Fixed tax: multiply rate by total base quantity
              calculatedTaxAmount = (tax.taxRate || 0) * quantityForTax;
            } else {
              // Percentage tax: apply to baseAmount (which is already total price for all quantities)
              calculatedTaxAmount = baseAmount * ((tax.taxRate || 0) / 100);
            }
            
            return {
              taxTypeId: tax.id,
              taxId: tax.taxId,
              taxName: tax.taxName,
              taxCode: tax.taxCode,
              taxRate: tax.taxRate,
              calculationType: tax.calculationType,
              taxAmount: Number(calculatedTaxAmount.toFixed(2))
            };
          });
          
          taxAmount = Number(taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0).toFixed(2));
          
          console.log(`🔍 Recalculating tax for unit-based product ${product.name} (price update):`, {
            newPrice,
            baseAmount,
            totalBaseQuantity: quantityForTax,
            unitQuantities: product.unitQuantities,
            taxBreakdown,
            totalTaxAmount: taxAmount
          });
        }
        
        return {
          ...product,
          price: avgUnitPrice,
          subtotal: newPrice, // Use total price directly as subtotal
          taxAmount: taxAmount,
          taxBreakdown: taxBreakdown
        };
      }
      return product;
    }));
  }, []);
  
  // Remove product from current sale
  const removeProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };
  // // Calculate subtotal
  // const calculateSubtotal = () => {
  //   return selectedProducts.reduce((sum, product) => sum + product.subtotal, 0) - discount;
  // };
  const updateDiscount = (selectedDiscount) => {
    // Clamp discount: not less than 0, not more than subtotal
    const subtotal = selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
    let validDiscount = Math.max(0, Math.min(selectedDiscount, subtotal));
    // setDiscount(validDiscount); // This line is removed
  };

  const calculateSubtotal = () => {
    const subtotal = selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
    return subtotal;
  };
  
  // Calculate tax amount
  const calculateTaxAmount = () => {
    return selectedProducts.reduce((sum, product) => sum + (product.taxAmount || 0), 0);
  };
  
  // Calculate total discount amount
  const calculateDiscountAmount = () => {
    return selectedProducts.reduce((sum, product) => sum + (product.discountAmount || 0), 0);
  };
  
  // Calculate total
  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount() - calculateDiscountAmount() - globalDiscount;
  };
  
  // Start editing tax rate
  const startEditingTax = () => {
    // setTempTaxRate(taxRate); // This line is removed
    // setIsEditingTax(true); // This line is removed
  };
  
  // Save tax rate
  const saveTaxRate = () => {
    // Validate the tax rate
    // const parsedTaxRate = parseFloat(tempTaxRate); // This line is removed
    // if (!isNaN(parsedTaxRate) && parsedTaxRate >= 0) { // This line is removed
    //   setTaxRate(parsedTaxRate); // This line is removed
    // } else { // This line is removed
    //   // Reset to current tax rate if invalid // This line is removed
    //   setTempTaxRate(taxRate); // This line is removed
    // } // This line is removed
    // setIsEditingTax(false); // This line is removed
  };
  
  // Cancel editing tax rate
  const cancelEditingTax = () => {
    // setTempTaxRate(taxRate); // This line is removed
    // setIsEditingTax(false); // This line is removed
  };
  
  // Handle tax rate input change
  const handleTaxRateChange = (e) => {
    // setTempTaxRate(e.target.value); // This line is removed
  };
  
  // Handle tax rate key down - save on Enter, cancel on Escape
  const handleTaxRateKeyDown = (e) => {
    // if (e.key === 'Enter') { // This line is removed
    //   saveTaxRate(); // This line is removed
  };
  
  // Clear the current sale
  const clearSale = () => {
    setSelectedProducts([]);
    setActiveTab("walkIn");
    setSelectedCustomer("");
    setSaleNotes("");
    setPosPaidAmount("");
        // Reset payment to first available account (prefer Cash if exists)
        const cashAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive);
        const defaultAccount = cashAccount || paymentAccounts.find(acc => acc.isActive) || paymentAccounts[0];
        if (defaultAccount) {
          setPaymentMethod(defaultAccount.id);
          setPaymentAllocations([]); // Will be set when sale is completed
        } else {
          setPaymentMethod("");
          setPaymentAllocations([]);
        }
    setQuantity(1);
    setProductSearchQuery("");
    setGlobalDiscount(0); // Clear global discount
    // Clear historical transaction fields
    setHistoricalDate('');
    setOriginalReference('');
    setMigrationBatch('');
    
    // Reset batch upload state
    setShowBatchUpload(false);
    setSelectedFile(null);
    setBatchName('');
    setUploadResults(null);
    
    // Note: keep receipt data separate; avoid resetting non-existent totals
  };

  // Download CSV template
  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/historical-transactions/template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'historical_transactions_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      setSaleError('Failed to download template. Please try again.');
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadResults(null);
      // Auto-generate batch name if empty
      if (!batchName) {
        setBatchName(`BATCH-${new Date().toISOString().split('T')[0]}-${Date.now()}`);
      }
    }
  };

  // Handle batch upload
  const handleBatchUpload = async () => {
    if (!selectedFile) {
      setSaleError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setSaleError(null);
    setUploadResults(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('migrationBatch', batchName || `BATCH-${new Date().toISOString().split('T')[0]}-${Date.now()}`);

      const response = await fetch('/api/historical-transactions/batch-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.details && Array.isArray(result.details)) {
          // Validation errors
          setSaleError(`Validation failed: ${result.details.slice(0, 5).join(', ')}${result.details.length > 5 ? '...' : ''}`);
        } else {
          setSaleError(result.error || 'Upload failed');
        }
        return;
      }

      setUploadResults(result);
      
      // Clear file selection on successful upload
      setSelectedFile(null);
      setBatchName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh sales data
      loadRecentSales();
      loadStatistics();

    } catch (error) {
      console.error('Error uploading batch:', error);
      setSaleError('Failed to upload batch. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Save sale as draft
  const saveDraft = async () => {
    if (selectedProducts.length === 0) {
      setSaleError("Please add at least one product to the sale");
      return;
    }
    
    setIsSubmitting(true);
    setSaleError(null);
    
    try {
      // Prepare sale data
      const saleData = {
        clientId: activeTab === "registered" && selectedCustomer ? selectedCustomer : null,
        items: selectedProducts.map(product => ({
          productId: product.isCustom ? null : product.id,
          description: product.name,
          quantity: product.quantity,
          unitPrice: product.price,
          taxRate: product.taxRate || 0,
          taxAmount: product.taxAmount || 0,
          taxDescription: product.taxDescription || "",
          taxBreakdown: product.taxBreakdown || [], // Include tax breakdown for multiple taxes
          discount: product.discount || 0,
          discountAmount: product.discountAmount || 0,
          isCustom: product.isCustom || false
        })),
        paymentMethod: paymentMethod,
        notes: saleNotes,
        status: 'draft',
        subtotal: calculateSubtotal(),
        totalTaxAmount: calculateTaxAmount(),
        totalDiscountAmount: calculateDiscountAmount(),
        globalDiscount: globalDiscount,
        total: calculateTotal()
      };
      
      // Create the sale
      const result = await createSale(saleData);
      
      // Show success message
      setSaleSuccess(true);
      
      // Reset form
      clearSale();
      
      // Refresh recent sales and statistics
      loadRecentSales();
      loadStatistics();
      
      // Notify user
      alert(`Draft saved successfully with ID: ${result.sale.saleNumber}`);
    } catch (error) {
      console.error("Error saving draft:", error);
      setSaleError("Failed to save draft. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Complete the sale
  const completeSale = async () => {
    if (selectedProducts.length === 0) {
      setSaleError("Please add at least one product to the sale");
      return;
    }
    
    // Always resolve from a fresh fetch at checkout (avoids stale React state; in-flight dedupe shares work with mount/cart effects).
    const loaded = await loadIncomeAccounts();
    let resolvedIncomeAccountId = loaded.defaultIncomeAccountId;
    if (!resolvedIncomeAccountId && loaded.accounts.length > 0) {
      const firstAccount = loaded.accounts.find((acc) => acc.isActive) || loaded.accounts[0];
      resolvedIncomeAccountId = firstAccount?.id || null;
      if (resolvedIncomeAccountId) {
        setDefaultIncomeAccountId(resolvedIncomeAccountId);
        defaultIncomeAccountIdRef.current = resolvedIncomeAccountId;
      }
    }
    if (!resolvedIncomeAccountId) {
      setSaleError("Income account is required. Please go to Chart of Accounts and create an Income account (e.g., account code 4000 - Revenue or 4100 - Sales Revenue) before creating sales.");
      return;
    }

    // Validate historical transaction data
    if (activeTab === "historical") {
      if (!historicalDate) {
        setSaleError("Please select a transaction date for historical entries");
        return;
      }

      const selectedDate = new Date(historicalDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today

      if (selectedDate > today) {
        setSaleError("Historical transaction date cannot be in the future");
        return;
      }
    }

    // ── EIS pre-flight checks ──────────────────────────────────
    // TC-INV-014: Block sale if terminal is blocked
    if (eisEnabled && terminalBlocked) {
      setSaleError(`Terminal blocked by MRA: ${terminalBlockMessage}`);
      return;
    }

    // TC-INV-003: B2B requires buyer TPIN and must be online
    if (transactionType === 'B2B') {
      if (!buyerTPIN || !/^\d{8}$/.test(buyerTPIN.trim())) {
        setSaleError('B2B transactions require a valid 8-digit Buyer TPIN');
        return;
      }
      if (!navigator.onLine) {
        setSaleError('B2B transactions must be processed online. Please check your internet connection.');
        return;
      }
    }

    // TC-RS-015/016: Relief supply requires validated VAT5 certificate
    if (isReliefSupply) {
      if (!vat5CertificateNumber.trim()) {
        setSaleError('VAT 5 Certificate Number is required for relief supply transactions');
        return;
      }
      if (!vat5Validated) {
        const valid = await validateVat5();
        if (!valid) {
          setSaleError(vat5Error || 'VAT 5 certificate validation failed');
          return;
        }
      }
    }

    setIsSubmitting(true);
    setSaleError(null);

    try {
      // Ensure payment allocation is set if using single payment account
      let finalPaymentAllocations = [...paymentAllocations];
      const total = calculateTotal();
      
      // Always prioritize the selected payment method
      // If paymentMethod is set, use it regardless of allocations
      console.log('🔍 POS: completeSale - paymentMethod:', paymentMethod);
      console.log('🔍 POS: completeSale - paymentAllocations:', paymentAllocations);
      console.log('🔍 POS: completeSale - paymentAccounts:', paymentAccounts.map(acc => ({ id: acc.id, name: acc.name })));
      
      if (paymentMethod && paymentAccounts.length > 0) {
        // Try to find account by ID first (current format)
        let selectedAccount = paymentAccounts.find(acc => acc.id === paymentMethod);
        if (!selectedAccount) {
          // Fallback: try to find by name (legacy format)
          selectedAccount = paymentAccounts.find(acc => acc.name === paymentMethod);
        }
        
        if (selectedAccount) {
          // Check if we have split payments that should be preserved
          const allocatedTotal = finalPaymentAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);
          const hasValidSplit = finalPaymentAllocations.length > 1 && Math.abs(allocatedTotal - total) < 0.01;
          
          if (hasValidSplit) {
            // Keep split payments but ensure selected account is included
            const hasSelectedAccount = finalPaymentAllocations.some(alloc => alloc.paymentAccountId === selectedAccount.id);
            if (!hasSelectedAccount) {
              // Selected account not in split, replace first allocation with selected account
              finalPaymentAllocations[0] = { paymentAccountId: selectedAccount.id, amount: finalPaymentAllocations[0].amount };
            }
            // Recalculate to match total exactly
            const currentTotal = finalPaymentAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);
            if (Math.abs(currentTotal - total) > 0.01) {
              const ratio = total / currentTotal;
              finalPaymentAllocations = finalPaymentAllocations.map(alloc => ({
                ...alloc,
                amount: alloc.amount * ratio
              }));
            }
          } else {
            // Single payment - use selected account with full total
            console.log('🔍 POS: Setting finalPaymentAllocations with account:', selectedAccount.id, selectedAccount.name);
            finalPaymentAllocations = [{ paymentAccountId: selectedAccount.id, amount: total }];
          }
        } else {
          console.warn('Selected payment method not found:', paymentMethod);
          // Fallback: use first available account (prefer Cash)
          const cashAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive);
          const defaultAccount = cashAccount || paymentAccounts.find(acc => acc.isActive) || paymentAccounts[0];
          if (defaultAccount) {
            finalPaymentAllocations = [{ paymentAccountId: defaultAccount.id, amount: total }];
          }
        }
      } else {
        // No payment method selected, check allocations
        const allocatedTotal = finalPaymentAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);
        if (finalPaymentAllocations.length === 0 || Math.abs(allocatedTotal - total) > 0.01) {
          // No valid allocations, use first available account (prefer Cash)
          const cashAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive);
          const defaultAccount = cashAccount || paymentAccounts.find(acc => acc.isActive) || paymentAccounts[0];
          if (defaultAccount) {
            finalPaymentAllocations = [{ paymentAccountId: defaultAccount.id, amount: total }];
          }
        } else {
          // Allocations exist and match total, ensure they use correct account IDs
          finalPaymentAllocations = finalPaymentAllocations.map(alloc => {
            if (alloc.paymentAccountId) {
              const account = paymentAccounts.find(acc => acc.id === alloc.paymentAccountId);
              if (!account) {
                // Might be a name, try to find by name
                const accountByName = paymentAccounts.find(acc => acc.name === alloc.paymentAccountId);
                if (accountByName) {
                  return { ...alloc, paymentAccountId: accountByName.id };
                }
              }
            }
            return alloc;
          });
        }
      }

      const isSplitPay = finalPaymentAllocations.length > 1;
      const paidInput = posPaidAmount.trim();
      let posTenderPayload = null;
      let posChangePayload = null;
      if (!isSplitPay && paidInput !== '') {
        const paidNum = parseFloat(paidInput);
        if (Number.isNaN(paidNum) || paidNum < 0) {
          setSaleError('Enter a valid amount paid (cash tendered).');
          setIsSubmitting(false);
          return;
        }
        if (paidNum + 0.005 < total) {
          setSaleError(`Amount paid must be at least the sale total (${formatCurrency(total)}).`);
          setIsSubmitting(false);
          return;
        }
        posTenderPayload = Number(paidNum.toFixed(2));
        posChangePayload = Number((paidNum - total).toFixed(2));
      }
      
      // Prepare sale data
      const saleData = {
        clientId: (activeTab === "registered" || activeTab === "historical") && selectedCustomer ? selectedCustomer : null,
        branchId: null,
        items: selectedProducts.map(product => {
          // Recalculate taxes to ensure they're correct for the current quantity
          // This is important because taxBreakdown might be stale if quantity was changed
          const productTaxes = product.taxes || [];
          let taxBreakdown = product.taxBreakdown || [];
          let taxAmount = product.taxAmount || 0;
          
          // Only recalculate if we have taxes and the taxBreakdown might be stale
          if (productTaxes.length > 0) {
            // For unit-based products, use subtotal (which is already calculated correctly from unitQuantities)
            // For regular products, calculate from quantity × unitPrice
            const isUnitManaged = hasUnitManagement(product);
            let lineTotal;
            let quantityForTax;
            
            if (isUnitManaged && product.unitQuantities) {
              // Calculate total base quantity from unitQuantities for Fixed tax calculations
              let totalBaseQuantity = 0;
              if (product.units && product.unitQuantities) {
                Object.entries(product.unitQuantities).forEach(([unitId, qty]) => {
                  const unit = product.units.find(u => u.id === unitId);
                  if (unit && qty > 0) {
                    const conversionRate = parseFloat(unit.conversionToBase || 1);
                    const convertedToBase = unit.isBaseUnit ? qty : qty / conversionRate;
                    totalBaseQuantity += convertedToBase;
                  }
                });
              }
              
              // Use subtotal (already calculated correctly by UnitBasedQuantityInput from all unit quantities)
              lineTotal = product.subtotal || 0;
              quantityForTax = totalBaseQuantity > 0 ? totalBaseQuantity : (product.quantity || 1);
              
              console.log(`🔍 Unit-based product tax calculation for ${product.name}:`, {
                unitQuantities: product.unitQuantities,
                totalBaseQuantity,
                subtotal: product.subtotal,
                lineTotal,
                quantityForTax
              });
            } else {
              // Regular product: quantity × unitPrice
              lineTotal = (product.quantity || 1) * (product.price || 0);
              quantityForTax = product.quantity || 1;
            }
            
            const baseAmount = lineTotal - (product.discountAmount || 0);
            
            // Calculate taxes directly on baseAmount (which already includes quantity for unit-based products)
            const recalculatedTaxBreakdown = productTaxes.map(tax => {
              let calculatedTaxAmount = 0;
              if (tax.calculationType === 'Fixed') {
                // Fixed tax: multiply rate by quantity
                calculatedTaxAmount = (tax.taxRate || 0) * quantityForTax;
              } else {
                // Percentage tax: apply to baseAmount (which is already lineTotal - discount)
                calculatedTaxAmount = baseAmount * ((tax.taxRate || 0) / 100);
              }
              
              return {
                taxTypeId: tax.id,
                taxId: tax.taxId,
                taxName: tax.taxName,
                taxCode: tax.taxCode,
                taxRate: tax.taxRate,
                calculationType: tax.calculationType,
                taxAmount: Number(calculatedTaxAmount.toFixed(2))
              };
            });
            
            const recalculatedTotalTax = recalculatedTaxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0);
            
            taxBreakdown = recalculatedTaxBreakdown;
            taxAmount = Number(recalculatedTotalTax.toFixed(2));
            
            console.log(`🔍 Recalculating tax for ${product.name}:`, {
              isUnitManaged,
              quantity: product.quantity,
              quantityForTax,
              unitPrice: product.price,
              subtotal: product.subtotal,
              lineTotal,
              baseAmount,
              discountAmount: product.discountAmount || 0,
              taxBreakdown: taxBreakdown,
              totalTaxAmount: taxAmount
            });
          }
          
          const itemData = {
          productId: product.isCustom ? null : product.id,
          description: product.name,
          quantity: product.quantity,
          unitPrice: product.price,
          taxRate: product.taxRate || 0,
          taxAmount: taxAmount, // Use recalculated tax amount
          taxDescription: product.taxDescription || "",
          taxBreakdown: taxBreakdown, // Use recalculated tax breakdown
          discount: product.discount || 0,
          discountAmount: product.discountAmount || 0,
          isCustom: product.isCustom || false,
          accountId: resolvedIncomeAccountId // Always use default revenue account for POS transactions
          };
          
          // Validate accountId is present
          if (!itemData.accountId) {
            throw new Error(`Income account is required for item: ${product.name}. Please set up your Chart of Accounts with an Income account.`);
          }
          
          // Add unit quantities for unit-managed products
          if (hasUnitManagement(product) && product.units) {
            const unitQuantities = {};
            product.units.forEach(unit => {
              // Get the quantity from the unit-based input
              // This would need to be stored in the product object when quantities change
              unitQuantities[unit.id] = product.unitQuantities?.[unit.id] || 0;
            });
            itemData.unitQuantities = unitQuantities;
            
            console.log("=== SALE CREATION DEBUG ===");
            console.log("Product:", product.name);
            console.log("Has unit management:", hasUnitManagement(product));
            console.log("Product units:", product.units);
            console.log("Product unitQuantities:", product.unitQuantities);
            console.log("Calculated unitQuantities for sale:", unitQuantities);
            console.log("Item data being sent:", itemData);
            console.log("=============================");
          }
          
          return itemData;
        }),
        // Always send paymentAllocations if we have them, otherwise send paymentMethod
        // Note: paymentAllocations should always be set by the logic above
        ...(finalPaymentAllocations.length > 0
          ? (() => {
              console.log('🔍 POS: Sending paymentAllocations:', finalPaymentAllocations);
              return {
                paymentAllocations: finalPaymentAllocations.map(alloc => ({
                  paymentAccountId: alloc.paymentAccountId,
                  amount: alloc.amount
                }))
              };
            })()
          : paymentMethod 
            ? (() => {
                console.log('🔍 POS: No allocations, sending paymentMethod:', paymentMethod);
                return { paymentMethod: paymentMethod }; // Fallback: send account ID if no allocations
              })()
            : {}),
        notes: saleNotes,
        status: 'completed',
        subtotal: calculateSubtotal(),
        totalTaxAmount: calculateTaxAmount(),
        totalDiscountAmount: calculateDiscountAmount(),
        globalDiscount: globalDiscount,
        total: calculateTotal(),
        // Historical transaction fields
        isHistorical: activeTab === "historical",
        historicalDate: activeTab === "historical" ? historicalDate : null,
        originalReference: activeTab === "historical" ? originalReference : null,
        migrationBatch: activeTab === "historical" ? migrationBatch : null,
        // EIS / MRA compliance fields
        transactionType,
        customerTPIN: transactionType === 'B2B' ? buyerTPIN.trim() : '',
        buyerAuthorizationCode: buyerAuthCode || null,
        isReliefSupply,
        vat5CertificateNumber: isReliefSupply ? vat5CertificateNumber.trim() : null,
        // Use MRA server time if available (TC-INV-003)
        ...(serverTime ? { saleDate: serverTime } : {}),
        ...(posTenderPayload != null && posChangePayload != null
          ? { posAmountTendered: posTenderPayload, posChangeGiven: posChangePayload }
          : {}),
      };
      
      // ── Offline branch (TC-OFF-007/008/009) ──────────────────
      if (!navigator.onLine) {
        // Check offline thresholds before queuing
        const thresholdCheck = await checkOfflineThresholds();
        if (thresholdCheck.blocked) {
          setSaleError(thresholdCheck.message);
          setIsSubmitting(false);
          return;
        }

        const offlineResult = await queueOfflineSale(saleData);
        const offlineCount = await getOfflineSalesCount();
        setOfflineSalesCount(offlineCount);

        setSaleSuccess(true);
        setReceiptNumber(`OFFLINE-${offlineResult.offlineSequence}`);
        setCurrentReceipt({ ...saleData, saleNumber: `OFFLINE-${offlineResult.offlineSequence}`, offlineSignature: offlineResult.signature });
        setShowReceiptModal(true);
        clearSale();
        return;
      }

      // Create the sale (online)
      const result = await createSale(saleData);

      // Show success message
      setSaleSuccess(true);

      // Set receipt number for the modal
      setReceiptNumber(result.sale.saleNumber);

      // Set current receipt for possible printing
      setCurrentReceipt(result.sale);

      // Show receipt modal
      setShowReceiptModal(true);

      // Reset form
      clearSale();

      // Refresh recent sales and statistics
      loadRecentSales();
      loadStatistics();

      // Refresh products to get updated stock levels
      loadProducts();
      
    } catch (error) {
      console.error("Error completing sale:", error);
      const errorMessage = error.message || "Failed to complete sale. Please try again.";
      
      // Only map true Chart of Accounts / income-line errors (do not treat "payment account" etc. as missing income CoA)
      const looksLikeIncomeCoaError =
        /income account is required/i.test(errorMessage) ||
        /active income account/i.test(errorMessage) ||
        /missing.*accountId/i.test(errorMessage) ||
        /Sale items must reference/i.test(errorMessage) ||
        /Each sale item must reference/i.test(errorMessage) ||
        /valid income account/i.test(errorMessage);
      if (looksLikeIncomeCoaError) {
        setSaleError("Income account is required. Please go to Chart of Accounts and create an Income account (e.g., account code 4000 - Revenue or 4100 - Sales Revenue) before creating sales.");
      } else {
        setSaleError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get payment method icon
  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash':
        return <DollarSign className="w-4 h-4" />;
      case 'card':
        return <CreditCard className="w-4 h-4" />;
      case 'mobile_money':
        return <Smartphone className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };
  
  // Format payment method for display
  const formatPaymentMethod = (method) => {
    const methodMap = {
      'cash': 'Cash',
      'card': 'Card',
      'mobile_money': 'Mobile Money',
      'bank_transfer': 'Bank Transfer',
      'check': 'Check'
    };
    
    return methodMap[method] || method;
  };
  
  // Print the current receipt
  const handlePrintReceipt = async () => {
    if (!currentReceipt) return;
    
    try {
      await printReceipt(currentReceipt.id);
    } catch (error) {
      console.error("Error printing receipt:", error);
      alert("Failed to print receipt. Please try again.");
    }
  };
  
  // View sale details
  const viewSaleDetails = (saleId) => {
    router.push(`/pos/list/${saleId}`);
  };
  
  // Format currency (handles API numbers, Prisma-serialized strings, and legacy "MK …" strings)
  const formatCurrency = (amount) => {
    let n = 0;
    if (amount == null || amount === "") {
      n = 0;
    } else if (typeof amount === "number" && Number.isFinite(amount)) {
      n = amount;
    } else if (
      typeof amount === "object" &&
      amount !== null &&
      typeof amount.toNumber === "function"
    ) {
      const t = amount.toNumber();
      n = Number.isFinite(t) ? t : 0;
    } else if (typeof amount === "string") {
      const stripped = amount.replace(/^MK\s*/i, "").replace(/,/g, "").trim();
      const p = parseFloat(stripped);
      n = Number.isFinite(p) ? p : 0;
    } else {
      const p = parseFloat(amount);
      n = Number.isFinite(p) ? p : 0;
    }
    return `MK ${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Find a client by ID
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : "Unknown Client";
  };

  // Add handler for when a client is created
  const handleClientCreated = (newClient) => {
    setClients((prev) => [...prev, newClient]);
    setFilteredClients((prev) => [...prev, newClient]);
    setSelectedCustomer(newClient.id);
    setShowClientModal(false);
  };

  return (
    <PermissionGuard permission="sales.view">   
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">Point of Sale</h1>
          <p className="text-sm text-gray-600">Process sales and manage transactions</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button 
            className="px-4 py-2.5 border border-gray-300 bg-white/80 backdrop-blur-sm rounded-lg flex items-center hover:bg-white hover:shadow-md transition-all"
            onClick={() => router.push('/pos/list')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Sales History</span>
          </button>
          {/* {pagePermissions.canCreateSales &&( <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
            onClick={clearSale}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            <span>New Sale</span>
          </button>)} */}
        </div>
      </div>

      {/* Success message */}
      {saleSuccess && (
        <div className="mb-6 bg-white/80 backdrop-blur-sm border border-green-200 text-green-800 p-4 rounded-xl shadow-lg border-l-4 border-l-green-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold">Sale completed successfully!</p>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {saleError && (
        <div className="mb-6 bg-white/80 backdrop-blur-sm border border-red-200 text-red-800 p-4 rounded-xl shadow-lg border-l-4 border-l-red-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold">{saleError}</p>
            </div>
          </div>
        </div>
      )}

      {/* EIS: Terminal blocked banner (TC-INV-014) */}
      {eisEnabled && terminalBlocked && (
        <div className="mb-6 bg-red-50 border border-red-300 text-red-900 p-4 rounded-xl shadow-lg border-l-4 border-l-red-600">
          <div className="flex items-center">
            <Lock className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold">Terminal Blocked by MRA</p>
              <p className="text-sm">{terminalBlockMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Offline indicator banner (TC-OFF-007) */}
      {!isOnline && (
        <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">You are offline</p>
              <p className="text-xs">Sales will be queued and synced when you reconnect.{offlineSalesCount > 0 && ` (${offlineSalesCount} pending)`}</p>
            </div>
          </div>
          {offlineBlocked && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">Threshold exceeded</span>
          )}
        </div>
      )}

      {/* Online with pending offline sales - sync banner */}
      {isOnline && offlineSalesCount > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span className="text-sm">{offlineSalesCount} offline sale(s) pending sync</span>
          </div>
          <button
            disabled={isSyncing}
            onClick={async () => {
              setIsSyncing(true);
              try {
                const results = await syncOfflineSales();
                const count = await getOfflineSalesCount();
                setOfflineSalesCount(count);
                if (results.synced > 0) { loadRecentSales(); loadStatistics(); }
              } catch (e) { console.error('Sync failed:', e); }
              finally { setIsSyncing(false); }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSyncing ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* EIS: Server time & connection indicator */}
      {eisEnabled && (
        <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            {serverTimeSource === 'mra' ? (
              <><Wifi className="w-3.5 h-3.5 text-green-500" /> MRA Connected</>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-yellow-500" /> Local Time</>
            )}
          </span>
          {serverTime && (
            <span>Server: {new Date(serverTime).toLocaleTimeString()}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column - New Sale Form */}
        {pagePermissions.canCreateSales && (
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-4">New Sale</h2>
            <div className="flex flex-wrap gap-2 mb-6 bg-gray-50 p-1 rounded-xl">
              <button 
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "walkIn" 
                    ? "bg-white text-blue-600 shadow-md" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => {
                  setActiveTab("walkIn");
                  setSelectedCustomer("");
                }}
              >
                Walk-in Customer
              </button>
              <button 
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center ${
                  activeTab === "registered" 
                    ? "bg-white text-blue-600 shadow-md" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab("registered")}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Registered Customer
              </button>
              <button 
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center ${
                  activeTab === "historical" 
                    ? "bg-white text-blue-600 shadow-md" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab("historical")}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Historical Transaction
              </button>
            </div>

            {/* ── EIS: B2B/B2C + Relief Supply Controls ───────── */}
            {eisEnabled && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                    <Globe className="w-4 h-4" /> MRA Transaction Settings
                  </span>
                </div>

                {/* B2B / B2C toggle */}
                <div className="flex gap-2">
                  <button
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${transactionType === 'B2C' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border border-blue-300'}`}
                    onClick={() => setTransactionType('B2C')}
                  >
                    B2C (Walk-in)
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${transactionType === 'B2B' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border border-blue-300'}`}
                    onClick={() => setTransactionType('B2B')}
                  >
                    B2B (Business)
                  </button>
                </div>

                {/* B2B: Buyer TPIN + Auth Code */}
                {transactionType === 'B2B' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Buyer TPIN *</label>
                      <input
                        type="text"
                        maxLength={8}
                        placeholder="12345678"
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                        value={buyerTPIN}
                        onChange={(e) => setBuyerTPIN(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Auth Code</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                        value={buyerAuthCode}
                        onChange={(e) => setBuyerAuthCode(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Relief Supply toggle */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isReliefSupply}
                      onChange={(e) => {
                        setIsReliefSupply(e.target.checked);
                        if (!e.target.checked) {
                          setVat5CertificateNumber('');
                          setVat5Validated(false);
                          setVat5Error('');
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-xs font-medium text-gray-700">Relief Supply</span>
                  </label>
                  {isReliefSupply && (
                    <span className="text-xs text-amber-600 font-medium">VAT removed from standard-rated items</span>
                  )}
                </div>

                {/* VAT 5 Certificate */}
                {isReliefSupply && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">VAT 5 Certificate Number *</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Enter VAT 5 certificate number"
                        className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-1 outline-none ${
                          vat5Validated ? 'border-green-400 bg-green-50' : vat5Error ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                        }`}
                        value={vat5CertificateNumber}
                        onChange={(e) => { setVat5CertificateNumber(e.target.value); setVat5Validated(false); setVat5Error(''); }}
                      />
                      <button
                        onClick={validateVat5}
                        disabled={vat5Validating || !vat5CertificateNumber.trim()}
                        className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {vat5Validating ? <Loader className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                        Validate
                      </button>
                    </div>
                    {vat5Validated && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Certificate validated</p>}
                    {vat5Error && <p className="text-xs text-red-600 mt-1">{vat5Error}</p>}
                  </div>
                )}
              </div>
            )}

            {activeTab === "registered" && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Customer</label>
                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search and select customer..."
                      className="w-full p-3 border-2 border-gray-200 rounded-xl pr-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                      value={clientSearchQuery}
                      onChange={handleClientSearchChange}
                      onFocus={() => setShowClientDropdown(true)}
                      onBlur={() => {
                        // Delay hiding to allow clicking on options
                        setTimeout(() => setShowClientDropdown(false), 200);
                      }}
                      disabled={isLoadingClients}
                    />
                    <div className="absolute right-3 top-3.5 pointer-events-none">
                      {isLoadingClients ? (
                        <Loader className="h-4 w-4 animate-spin text-gray-500" />
                      ) : (
                        <Search className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Dropdown with search results */}
                  {showClientDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                      {filteredClients.length > 0 ? (
                        <>
                          {filteredClients.map((client) => (
                            <div
                              key={client.id}
                              className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                              onClick={() => {
                                setSelectedCustomer(client.id);
                                setClientSearchQuery(client.name);
                                setShowClientDropdown(false);
                              }}
                            >
                              <div className="font-semibold text-gray-900">{client.name}</div>
                              {client.email && (
                                <div className="text-sm text-gray-500 mt-0.5">{client.email}</div>
                              )}
                            </div>
                          ))}
                          <div
                            className="px-4 py-3 hover:bg-blue-100 cursor-pointer border-t-2 border-gray-200 bg-blue-50 transition-colors"
                            onClick={() => {
                              setShowClientModal(true);
                              setShowClientDropdown(false);
                            }}
                          >
                            <div className="font-semibold text-blue-600 flex items-center">
                              <UserPlus className="w-4 h-4 mr-2" />
                              Add New Client
                            </div>
                          </div>
                        </>
                      ) : clientSearchQuery.trim() !== "" ? (
                        <div className="px-4 py-4 text-gray-500 text-center">
                          No clients found
                        </div>
                      ) : (
                        <div className="px-4 py-4 text-gray-500 text-center">
                          Start typing to search clients...
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {clientsError && (
                  <p className="mt-1 text-sm text-red-600">{clientsError}</p>
                )}
              </div>
            )}

            {activeTab === "historical" && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                    <h3 className="text-sm font-medium text-yellow-800">Historical Transaction Entry</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                      onClick={() => setShowBatchUpload(!showBatchUpload)}
                    >
                      <Package className="w-3 h-3 mr-1" />
                      {showBatchUpload ? 'Single Entry' : 'Batch Upload'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-yellow-700 mb-4">
                  Record transactions that occurred before system implementation. All entries will be audited and marked as historical data.
                </p>
                
                {!showBatchUpload ? (
                  // Single transaction entry form
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">Transaction Date *</label>
                        <input
                          type="date"
                          className="w-full p-2 border border-gray-200 rounded-md"
                          value={historicalDate}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setHistoricalDate(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">Original Reference</label>
                        <input
                          type="text"
                          placeholder="Original receipt/invoice number"
                          className="w-full p-2 border border-gray-200 rounded-md"
                          value={originalReference}
                          onChange={(e) => setOriginalReference(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1 text-gray-700">Migration Batch</label>
                      <input
                        type="text"
                        placeholder="e.g., BATCH-2024-001 (optional)"
                        className="w-full p-2 border border-gray-200 rounded-md"
                        value={migrationBatch}
                        onChange={(e) => setMigrationBatch(e.target.value)}
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1 text-gray-700">Customer (Optional)</label>
                      <ClientSearchCombobox
                        clients={clients}
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        onAddNew={() => setShowClientModal(true)}
                        placeholder="Search or select a customer..."
                        disabled={isLoadingClients}
                        isLoading={isLoadingClients}
                        allowEmpty={true}
                        emptyLabel="Walk-in Customer"
                      />
                    </div>
                  </>
                ) : (
                  // Batch upload form
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">Batch Upload Instructions</h4>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li>• Download the CSV template below and fill in your historical transactions</li>
                        <li>• Each row represents one transaction with all required details</li>
                        <li>• Ensure dates are in YYYY-MM-DD format and not in the future</li>
                        <li>• Upload the completed file to process all transactions at once</li>
                      </ul>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
                        onClick={downloadTemplate}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download CSV Template
                      </button>
                      
                      <div className="flex-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Select File to Upload
                        </button>
                      </div>
                    </div>
                    
                    {selectedFile && (
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 text-gray-500 mr-2" />
                            <span className="text-sm text-gray-700">{selectedFile.name}</span>
                            <span className="text-xs text-gray-500 ml-2">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-800"
                            onClick={() => {
                              setSelectedFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="mt-3">
                          <label className="block text-sm font-medium mb-1 text-gray-700">Migration Batch Name</label>
                          <input
                            type="text"
                            placeholder={`BATCH-${new Date().toISOString().split('T')[0]}`}
                            className="w-full p-2 border border-gray-200 rounded-md text-sm"
                            value={batchName}
                            onChange={(e) => setBatchName(e.target.value)}
                          />
                        </div>
                        
                        <button
                          type="button"
                          className="mt-3 w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center justify-center disabled:opacity-50"
                          onClick={handleBatchUpload}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Batch Transactions
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {uploadResults && (
                      <div className={`border rounded-md p-4 ${uploadResults.results.failed > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                        <h4 className={`text-sm font-medium mb-2 ${uploadResults.results.failed > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                          Upload Results
                        </h4>
                        <div className="text-sm space-y-1">
                          <p className="text-green-700">✓ {uploadResults.results.successful} transactions processed successfully</p>
                          {uploadResults.results.failed > 0 && (
                            <p className="text-red-700">✗ {uploadResults.results.failed} transactions failed</p>
                          )}
                          <p className="text-gray-600">Migration Batch: {uploadResults.results.migrationBatch}</p>
                        </div>
                        
                        {uploadResults.results.failedTransactions?.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-sm font-medium text-red-700 cursor-pointer">View Failed Transactions</summary>
                            <div className="mt-2 text-xs space-y-1">
                              {uploadResults.results.failedTransactions.map((failed, index) => (
                                <div key={index} className="text-red-600">
                                  Row {failed.rowNumber}: {failed.error}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mb-6 relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Add Products</label>
              <p className="text-xs text-gray-500 mb-2">
                {productPickerGrid
                  ? 'Grid view: scroll and click products to add. Search narrows the grid.'
                  : 'Search by name, SKU, or barcode — or open grid view to browse all products.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow" ref={productSearchRef}>
                  <input
                    type="text"
                    placeholder="Search by name, SKU or barcode..."
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (!productPickerGrid) setShowProductSearch(true);
                    }}
                    onKeyDown={(e) => {
                      // Add first matching product on Enter
                      if (e.key === 'Enter' && filteredProducts.length > 0) {
                        const product = filteredProducts[0];
                        if (!(product.stockLevel !== null && product.stockLevel <= 0)) {
                          handleQuickAdd(product);
                        }
                      }
                    }}
                  />
                  <div className="absolute right-3 top-3.5 pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400" />
                  </div>
                  
                  {/* Product search results dropdown (hidden in grid mode — grid shows the same filtered list) */}
                  {showProductSearch && !productPickerGrid && (
                    <div className="absolute z-10 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                      {isLoadingProducts ? (
                        <div className="p-6 text-center">
                          <Loader className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">Loading products...</p>
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="p-6 text-center">
                          <p className="text-gray-500">No products found</p>
                        </div>
                      ) : (
                        filteredProducts.map(product => (
                          <div 
                            key={product.id}
                            className={`p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-100 flex justify-between items-center transition-colors ${product.stockLevel <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => product.stockLevel > 0 && handleQuickAdd(product)}
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{product.name}</p>
                              <div className="flex flex-wrap text-xs text-gray-500 gap-3 mt-1">
                                {product.sku && <span>SKU: {product.sku}</span>}
                                <span className={product.stockLevel !== null && product.stockLevel > 0 ? 'text-green-600' : 'text-red-600'}>
                                  Stock: {product.stockLevel !== null ? product.stockLevel : 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-bold text-gray-900">{formatCurrency(product.price)}</p>
                              {product.stockLevel <= 0 ? (
                                <span className="text-xs text-red-600 font-medium">Out of stock</span>
                              ) : (
                                <button 
                                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold mt-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAdd(product);
                                  }}
                                >
                                  + Add to sale
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto items-stretch sm:items-center">
                  <div className="w-full sm:w-24 shrink-0">
                    <input 
                      type="number" 
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-center font-semibold" 
                      min="1" 
                      value={quantity} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setQuantity(val > 0 ? val : 1);
                      }}
                      placeholder="Qty"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProductPickerGrid((prev) => {
                        const next = !prev;
                        if (next) setShowProductSearch(false);
                        return next;
                      });
                    }}
                    className={`shrink-0 flex items-center justify-center w-12 h-[50px] rounded-xl border-2 transition-all ${
                      productPickerGrid
                        ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600'
                    }`}
                    title={productPickerGrid ? 'Switch to list search dropdown' : 'Show product grid (browse & click)'}
                    aria-pressed={productPickerGrid}
                  >
                    {productPickerGrid ? (
                      <List className="w-5 h-5" aria-hidden />
                    ) : (
                      <LayoutGrid className="w-5 h-5" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {/* Scrollable product grid — same filter as search */}
              {productPickerGrid && (
                <div className="mt-3 rounded-xl border-2 border-gray-200 bg-gradient-to-b from-white to-gray-50/80 shadow-inner max-h-[min(52vh,32rem)] overflow-y-auto overscroll-contain">
                  {isLoadingProducts ? (
                    <div className="p-10 flex flex-col items-center justify-center text-gray-500">
                      <Loader className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                      <span className="text-sm">Loading products…</span>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 text-sm">
                      {productSearchQuery.trim()
                        ? 'No products match your search.'
                        : 'No products available.'}
                    </div>
                  ) : (
                    <div className="p-2 sm:p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                      {filteredProducts.map((product) => {
                        const out =
                          product.stockLevel !== null && product.stockLevel <= 0;
                        const imgSrc =
                          product.image &&
                          String(product.image).trim() !== '' &&
                          !String(product.image).includes('placeholder')
                            ? product.image
                            : null;
                        return (
                          <button
                            key={product.id}
                            type="button"
                            disabled={out}
                            onClick={() => !out && handleQuickAdd(product)}
                            className={`flex flex-col rounded-lg border text-left transition-all min-h-[112px] ${
                              out
                                ? 'border-gray-100 bg-gray-100/80 opacity-60 cursor-not-allowed'
                                : 'border-gray-200 bg-white hover:border-blue-400 hover:shadow-md hover:bg-blue-50/50 active:scale-[0.98]'
                            }`}
                          >
                            <div className="h-14 w-full rounded-t-md bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                              {imgSrc ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={imgSrc}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="w-7 h-7 text-gray-400" />
                              )}
                            </div>
                            <div className="p-2 flex-1 flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight">
                                {product.name}
                              </span>
                              {product.sku ? (
                                <span className="text-[10px] text-gray-500 truncate mt-0.5">
                                  {product.sku}
                                </span>
                              ) : null}
                              <span className="text-sm font-bold text-gray-900 mt-auto pt-1">
                                {formatCurrency(product.price)}
                              </span>
                              <span
                                className={`text-[10px] font-medium mt-0.5 ${
                                  out
                                    ? 'text-red-600'
                                    : product.stockLevel > 0
                                      ? 'text-green-600'
                                      : 'text-gray-500'
                                }`}
                              >
                                {out
                                  ? 'Out of stock'
                                  : `Stock: ${product.stockLevel ?? '—'}`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom Product Button */}
            <div className="mb-6">
              <button
                className="w-full p-3 border-2 border-dashed border-gray-300 bg-white/50 backdrop-blur-sm rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all font-medium"
                onClick={() => setShowCustomProduct(true)}
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Custom Product
              </button>
            </div>

            <div className="border-2 border-gray-200 rounded-xl overflow-hidden mb-6 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Price</th>
                      {selectedProducts.some(p => !hasUnitManagement(p)) && (
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Quantity</th>
                      )}
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Tax</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Discount</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {selectedProducts.length > 0 ? (
                    selectedProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-700">{formatCurrency(product.price)}</td>
                        {!hasUnitManagement(product) && (
                          <td className="px-4 py-3 text-sm text-right">
                            <input
                              type="number"
                              className="w-20 p-1.5 text-right border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none font-semibold"
                              min="1"
                              value={product.quantity}
                              onChange={(e) => updateProductQuantity(product.id, e.target.value)}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-right">
                          {product.taxBreakdown && product.taxBreakdown.length > 0 ? (
                            <div className="space-y-1">
                              {product.taxBreakdown.map((tax, idx) => (
                                <div key={idx} className="text-xs text-gray-700">
                                  <span className="font-medium">{tax.taxName}</span>
                                  <span className="text-gray-500 ml-1">
                                    ({tax.calculationType === 'Fixed' ? `${tax.taxRate} MWK` : `${tax.taxRate}%`})
                                  </span>
                                  {eisEnabled && (
                                    <span className={`ml-1 inline-block px-1 py-0.5 text-[10px] font-bold rounded ${
                                      tax.taxRate === 16.5 ? 'bg-blue-100 text-blue-700' :
                                      tax.taxRate === 0 ? 'bg-gray-100 text-gray-600' :
                                      'bg-amber-100 text-amber-700'
                                    }`}>
                                      {tax.taxRate === 16.5 ? 'A' : tax.taxRate === 0 ? 'B' : 'E'}
                                    </span>
                                  )}
                                  <div className="font-semibold text-gray-900">
                                    {formatCurrency(tax.taxAmount)}
                                  </div>
                                </div>
                              ))}
                              <div className="pt-1 border-t border-gray-200 mt-1 flex items-center justify-end gap-1">
                                <div className="font-bold text-gray-900">
                                  {formatCurrency(product.taxAmount || 0)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeTaxFromProduct(product.id)}
                                  className="text-gray-400 hover:text-red-500 ml-1"
                                  title="Remove tax"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative" ref={openTaxDropdownId === product.id ? taxDropdownRef : null}>
                              <button
                                type="button"
                                onClick={() => { setOpenTaxDropdownId(openTaxDropdownId === product.id ? null : product.id); setIsAddingPosTax(false); setPosTaxSearch(''); }}
                                className="text-xs text-blue-600 hover:text-blue-800 border border-dashed border-blue-300 hover:border-blue-500 rounded px-2 py-1 transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add tax
                              </button>
                              {openTaxDropdownId === product.id && (
                                <div className="absolute z-50 right-0 mt-1 w-56 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
                                  {!isAddingPosTax ? (
                                    <>
                                      <div className="p-2 border-b border-gray-200 flex items-center space-x-2">
                                        <input
                                          type="text"
                                          placeholder="Search taxes..."
                                          value={posTaxSearch}
                                          onChange={(e) => setPosTaxSearch(e.target.value)}
                                          className="flex-1 p-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => { setIsAddingPosTax(true); fetchPosTaxAccounts(); }}
                                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                          title="Add new tax type"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      <div className="max-h-40 overflow-y-auto">
                                        {posTaxTypes
                                          .filter(t => t.taxName.toLowerCase().includes(posTaxSearch.toLowerCase()))
                                          .map(t => (
                                            <button
                                              key={t.id}
                                              type="button"
                                              onClick={() => applyTaxToProduct(product.id, t)}
                                              className="w-full px-3 py-2 text-left hover:bg-gray-100 text-xs text-gray-900"
                                            >
                                              {t.taxName} <span className="text-gray-500">({t.taxRate}%)</span>
                                            </button>
                                          ))}
                                        {posTaxTypes.filter(t => t.taxName.toLowerCase().includes(posTaxSearch.toLowerCase())).length === 0 && (
                                          <div className="px-3 py-2 text-gray-500 text-xs">No tax types found</div>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="p-3 space-y-2">
                                      <p className="text-xs font-medium text-gray-700">Create new tax type</p>
                                      <input
                                        type="text"
                                        placeholder="Tax name (e.g. VAT)"
                                        value={newPosTax.taxName}
                                        onChange={(e) => setNewPosTax(prev => ({ ...prev, taxName: e.target.value }))}
                                        className="w-full p-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                      <input
                                        type="number"
                                        placeholder="Rate % (e.g. 16.5)"
                                        value={newPosTax.taxRate}
                                        onChange={(e) => setNewPosTax(prev => ({ ...prev, taxRate: e.target.value }))}
                                        className="w-full p-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        step="0.01" min="0" max="100"
                                      />
                                      <select
                                        value={newPosTax.accountId}
                                        onChange={(e) => setNewPosTax(prev => ({ ...prev, accountId: e.target.value }))}
                                        className="w-full p-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      >
                                        <option value="">Select tax account</option>
                                        {taxAccounts.map(acc => (
                                          <option key={acc.id} value={acc.id}>
                                            {acc.accountCode ? `${acc.accountCode} - ` : ''}{acc.accountName || acc.name} ({acc.accountType})
                                          </option>
                                        ))}
                                      </select>
                                      <div className="flex items-center justify-end space-x-2">
                                        <button
                                          type="button"
                                          onClick={() => { setIsAddingPosTax(false); setNewPosTax({ taxName: '', taxRate: '', accountId: '' }); }}
                                          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleCreatePosTaxType}
                                          disabled={!newPosTax.taxName.trim() || newPosTax.taxRate === '' || !newPosTax.accountId || addingPosTaxLoading}
                                          className="px-2 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {addingPosTaxLoading ? 'Saving...' : 'Save'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center justify-end">
                            <span className="text-xs mr-1 text-gray-600 font-medium">MK</span>
                            <input
                              type="number"
                              className="w-20 p-1.5 text-right border-2 border-gray-200 rounded-lg text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={product.discount || ''}
                              onChange={(e) => updateProductDiscount(product.id, e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(product.subtotal + (product.taxAmount || 0) - (product.discountAmount || 0))}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <button 
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            onClick={() => removeProduct(product.id)}
                            title="Remove product"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-8 py-12 text-sm text-gray-500 text-center">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium">No products added yet</p>
                        <p className="text-xs mt-1">Search and select products to add to the sale</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>

            {/* Unit-Based Quantity Input Section */}
            {selectedProducts.some(p => hasUnitManagement(p)) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-blue-900 mb-3">Unit-Based Products</h3>
                <div className="space-y-4">
                  {selectedProducts
                    .filter(p => hasUnitManagement(p))
                    .map((product) => (
                      <div key={product.id} className="bg-white border border-blue-200 rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{product.name}</span>
                          <span className="text-sm text-gray-500">{formatCurrency(product.price)}</span>
                        </div>
                        <UnitBasedQuantityInput
                          product={product}
                          quantity={product.quantity}
                          onQuantityChange={(newQuantity) => updateUnitBasedQuantity(product.id, newQuantity)}
                          onPriceChange={(newPrice) => updateUnitBasedPrice(product.id, newPrice)}
                          onUnitQuantitiesChange={(unitQuantities) => updateUnitQuantities(product.id, unitQuantities)}
                          className="w-full"
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-2xl mb-6 border border-gray-200 shadow-lg shadow-gray-200/50">
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Subtotal:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(calculateSubtotal())}</span>
                </div>
                {(() => {
                  // Group all taxes from all products
                  const allTaxes = {};
                  let hasAnyTaxes = false;
                  
                  selectedProducts.forEach(product => {
                    // Check taxBreakdown (from frontend calculation)
                    if (product.taxBreakdown && product.taxBreakdown.length > 0) {
                      hasAnyTaxes = true;
                      product.taxBreakdown.forEach(tax => {
                        const taxKey = tax.taxName || tax.taxId || 'Tax';
                        if (!allTaxes[taxKey]) {
                          allTaxes[taxKey] = {
                            taxName: tax.taxName || tax.taxId || 'Tax',
                            taxCode: tax.taxCode || null,
                            totalAmount: 0
                          };
                        }
                        allTaxes[taxKey].totalAmount += Number(tax.taxAmount || 0);
                      });
                    }
                  });
                  
                  const totalTax = calculateTaxAmount();
                  
                  // Sort taxes by name for consistent display
                  const sortedTaxes = Object.values(allTaxes).sort((a, b) => 
                    (a.taxName || '').localeCompare(b.taxName || '')
                  );
                  
                  // Show individual taxes if we have them
                  if (hasAnyTaxes && sortedTaxes.length > 0) {
                    return (
                      <>
                        {sortedTaxes.map((tax, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">
                              {tax.taxName}{tax.taxCode ? ` (${tax.taxCode})` : ''}:
                            </span>
                            <span className="font-semibold text-gray-800">{formatCurrency(tax.totalAmount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-1 border-t border-gray-200 mt-1">
                          <span className="font-semibold text-gray-700">Total Tax:</span>
                          <span className="font-bold text-gray-900">{formatCurrency(totalTax)}</span>
                        </div>
                      </>
                    );
                  } else if (totalTax > 0) {
                    // Show total tax only if no individual breakdown available
                    return (
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Total Tax:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(totalTax)}</span>
                      </div>
                    );
                  }
                  // No taxes
                  return null;
                })()}
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Total Discount:</span>
                  <span className="font-bold text-red-600">-{formatCurrency(calculateDiscountAmount())}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                  <span className="font-semibold text-gray-700">Global Discount:</span>
                  <div className="flex items-center">
                    <span className="text-xs mr-1 text-gray-600 font-medium">MK</span>
                    <input
                      type="number"
                      className="w-24 p-2 text-right border-2 border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none font-semibold bg-white"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={globalDiscount || ''}
                      onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                {globalDiscount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-600">Applied Global Discount:</span>
                    <span className="font-bold text-red-600">-{formatCurrency(globalDiscount)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pt-4 border-t-2 border-gray-300">
                <span className="text-xl font-bold text-gray-900">Total:</span>
                <span className="text-2xl font-extrabold text-blue-600">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
              <textarea
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none resize-none"
                rows="3"
                placeholder="Add notes about this sale..."
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
              ></textarea>
            </div>
          </div>
        </div>
        )}

        {/* Right Column - Payment Method & Action Buttons */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
          {/* Business (tenant) — POS is scoped per business */}
          {(!isLoadingTenants && tenants.length > 0) && (
            <div className="mb-6 space-y-3">
              <label className="block text-sm font-medium text-gray-700">Business</label>
              {isLoadingTenants ? (
                <div className="text-sm text-gray-500 py-2">Loading businesses...</div>
              ) : tenants.length > 1 ? (
                <select
                  value={currentTenantId || ''}
                  onChange={handleTenantChange}
                  disabled={isSwitchingBusiness}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : tenants.length === 1 ? (
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 flex-shrink-0 text-gray-500" />
                  <span className="truncate font-medium">{tenants[0].name}</span>
                </div>
              ) : null}
            </div>
          )}

          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-6">Payment Method</h2>
          <div className="mb-6">
            {isLoadingPaymentAccounts ? (
              <div className="flex items-center justify-center p-8">
                <Loader className="animate-spin h-6 w-6 text-gray-400" />
                <span className="ml-2 text-gray-500">Loading payment accounts...</span>
              </div>
            ) : paymentAccounts.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                No payment accounts available. Please configure payment accounts in Settings.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                  {paymentAccounts.map(account => (
                    <button
                      key={account.id}
                      onClick={() => {
                        setPaymentMethod(account.id);
                        // Update allocation when account is selected - always use current total
                        const currentTotal = calculateTotal();
                        if (currentTotal > 0) {
                          setPaymentAllocations([{ paymentAccountId: account.id, amount: currentTotal }]);
                        } else {
                          // If total is 0, still set allocation but with 0 amount (will be updated when products are added)
                          setPaymentAllocations([{ paymentAccountId: account.id, amount: 0 }]);
                        }
                        setShowSplitPaymentModal(false); // Close split modal if open
                      }}
                      className={`p-4 border-2 rounded-xl flex flex-col justify-center items-center transition-all ${
                        paymentMethod === account.id || (paymentAllocations.length === 1 && paymentAllocations[0].paymentAccountId === account.id)
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-md scale-105'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-2xl mb-2">
                        {account.accountType === 'Cash' && <DollarSign className="w-6 h-6" />}
                        {account.accountType === 'Bank' && <DollarSign className="w-6 h-6" />}
                        {account.accountType === 'Mobile Money' && <Smartphone className="w-6 h-6" />}
                        {account.accountType === 'Wallet' && <CreditCard className="w-6 h-6" />}
                        {account.accountType === 'POS Terminal' && <CreditCard className="w-6 h-6" />}
                        {!['Cash', 'Bank', 'Mobile Money', 'Wallet', 'POS Terminal'].includes(account.accountType) && <DollarSign className="w-6 h-6" />}
                      </span>
                      <span className="text-sm font-semibold">{account.name}</span>
                      {account.reference && (
                        <span className="text-xs text-gray-500 mt-1">{account.reference}</span>
                      )}
                    </button>
                  ))}
                </div>
                {paymentAllocations.length > 1 && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-semibold text-blue-900 mb-2">Split Payment:</div>
                    {paymentAllocations.map((alloc, idx) => {
                      const account = paymentAccounts.find(a => a.id === alloc.paymentAccountId);
                      return (
                        <div key={idx} className="text-xs text-blue-700">
                          {account?.name}: {formatCurrency(alloc.amount)}
                        </div>
                      );
                    })}
                  </div>
                )}
            <button
              onClick={() => {
                // Initialize split payment with current total if no allocations exist
                if (paymentAllocations.length === 0) {
                  const total = calculateTotal();
                  const cashAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive);
                  const defaultAccount = cashAccount || paymentAccounts.find(acc => acc.isActive) || paymentAccounts[0];
                  if (defaultAccount) {
                    setPaymentAllocations([{ paymentAccountId: defaultAccount.id, amount: total }]);
                  }
                }
                setShowSplitPaymentModal(true);
              }}
              className="mt-2 w-full px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              Split Payment
            </button>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex flex-col gap-3">
              <button 
                className="w-full px-6 py-3 border-2 border-gray-300 bg-white rounded-xl flex items-center justify-center font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow-md"
                onClick={clearSale}
              >
                <X className="w-5 h-5 mr-2" />
                Clear
              </button>
              <button 
                className={`w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl flex items-center justify-center font-semibold transition-all shadow-sm hover:shadow-md ${
                  isSubmitting || selectedProducts.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                }`}
                onClick={saveDraft}
                disabled={isSubmitting || selectedProducts.length === 0}
              >
                <Save className="w-5 h-5 mr-2" />
                Save Draft
              </button>
              {(() => {
                const checkoutTotal = calculateTotal();
                const paidTrim = posPaidAmount.trim();
                const paidNum = paidTrim === '' ? null : parseFloat(paidTrim);
                const paidParsedOk = paidNum !== null && !Number.isNaN(paidNum) && paidNum >= 0;
                const splitPay = paymentAllocations.length > 1;
                const changeDue = paidParsedOk ? paidNum - checkoutTotal : null;
                return (
                  <div className="w-full rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-gray-700">Sale total</span>
                      <span className="font-bold text-gray-900">{formatCurrency(checkoutTotal)}</span>
                    </div>
                    {splitPay ? (
                      <p className="text-xs text-gray-500">
                        Amount paid and change apply to single-payment sales only (not split payment).
                      </p>
                    ) : (
                      <>
                        <div>
                          <label htmlFor="pos-paid-amount" className="block text-xs font-semibold text-gray-600 mb-1">
                            Amount paid (optional)
                          </label>
                          <input
                            id="pos-paid-amount"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            placeholder="Cash tendered"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={posPaidAmount}
                            onChange={(e) => setPosPaidAmount(e.target.value)}
                            disabled={selectedProducts.length === 0}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Leave blank if not needed. If set, must be at least the sale total; change is calculated automatically.
                          </p>
                        </div>
                        {paidTrim !== '' && (
                          <div className="text-sm space-y-1">
                            {!paidParsedOk ? (
                              <p className="text-red-600 font-medium">Enter a valid amount.</p>
                            ) : changeDue < -0.005 ? (
                              <p className="text-red-600 font-medium">
                                Short by {formatCurrency(Math.abs(changeDue))}. Amount paid must cover the sale total.
                              </p>
                            ) : (
                              <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                                <span className="font-semibold text-gray-700">Change due</span>
                                <span className="font-bold text-emerald-700">{formatCurrency(Math.max(0, changeDue))}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
              <button 
                className={`w-full px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl flex items-center justify-center font-bold transition-all shadow-lg hover:shadow-xl ${
                  isSubmitting || selectedProducts.length === 0 ? 'opacity-70 cursor-not-allowed' : 'hover:from-green-700 hover:to-green-800 transform hover:scale-105'
                }`}
                onClick={completeSale}
                disabled={isSubmitting || selectedProducts.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader className="animate-spin h-5 w-5 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Complete Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Daily POS Sales Summary + cash register */}
      <div className="mt-6 lg:mt-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-5 lg:p-6 border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Daily Sales (POS)</h2>
            <p className="text-xs text-gray-500">Opening/closing register, transactions, and exports.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-600">Date</label>
            <input
              type="date"
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
              value={dailyReportDate}
              onChange={(e) => {
                const val = e.target.value;
                setDailyReportDate(val);
                if (val) loadDailyReport(val);
              }}
            />
            <a
              href={`/api/pos/cash-day/export?date=${encodeURIComponent(dailyReportDate)}&format=csv`}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            >
              Export CSV
            </a>
            <a
              href={`/api/pos/cash-day/export?date=${encodeURIComponent(dailyReportDate)}&format=xlsx`}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            >
              Export Excel
            </a>
            <a
              href={`/api/pos/cash-day/export?date=${encodeURIComponent(dailyReportDate)}&format=pdf`}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
            >
              Export PDF
            </a>
          </div>
        </div>
        {posCashMessage && (
          <div className="mb-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {posCashMessage}
          </div>
        )}
        {isLoadingDailyReport ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader className="h-4 w-4 animate-spin" /> Loading daily report...
          </div>
        ) : dailyReport ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Sales</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {formatCurrency(dailyReport.totalSales || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Transactions</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {dailyReport.transactionCount || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Items Sold</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {dailyReport.itemsSold || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Gross Profit</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {formatCurrency(dailyReport.grossProfit || 0)}
                </p>
              </div>
            </div>

            {posCashDayState && (
              <div className="border border-gray-100 rounded-xl p-4 mb-6 bg-gray-50/80">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">POS cash register</h3>
                  <div className="flex flex-wrap gap-2">
                    {!posCashDayState.register ? (
                      <button
                        type="button"
                        onClick={openPosRegisterDay}
                        disabled={posCashActionLoading}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-50"
                      >
                        Open day (sync Cash balance)
                      </button>
                    ) : posCashDayState.register.status === 'OPEN' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowDepositModal(true)}
                          disabled={posCashActionLoading}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                        >
                          Deposit
                        </button>
                        <button
                          type="button"
                          onClick={closePosRegisterDay}
                          disabled={posCashActionLoading}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 text-white disabled:opacity-50"
                        >
                          Close day
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-medium text-gray-600">Day closed</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500">System Cash account (Payment Management)</p>
                    <p className="font-medium text-gray-900">{posCashDayState.systemCashAccount?.name || 'Cash'}</p>
                    <p className="text-gray-500 mt-1">Live ledger balance</p>
                    <p className="font-semibold">{formatCurrency(posCashDayState.liveCashBalance ?? 0)}</p>
                  </div>
                  {posCashDayState.register ? (
                    <>
                      <div>
                        <p className="text-gray-500">Opening balance (locked at open)</p>
                        <p className="font-semibold text-lg text-gray-900">
                          {formatCurrency(posCashDayState.metrics?.openingBalance ?? 0)}
                        </p>
                        <p className="text-gray-500 mt-1">Closing = opening + total sales</p>
                        <p className="font-semibold">{formatCurrency(posCashDayState.metrics?.closingBalance ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Cash in hand (undeposited)</p>
                        <p className="font-semibold text-lg text-emerald-800">
                          {formatCurrency(posCashDayState.metrics?.cashInHandUndeposited ?? 0)}
                        </p>
                        <p className="text-gray-400 mt-1">
                          Total cash sales − opening (check):{' '}
                          {formatCurrency(posCashDayState.metrics?.cashInHandTotalCashMinusOpening ?? 0)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2 text-gray-500 text-xs">
                      Open the day to lock an opening balance equal to the system Cash account balance, then track
                      deposits and closing.
                    </div>
                  )}
                </div>
              </div>
            )}

            {Array.isArray(dailyReport.transactions) && dailyReport.transactions.length > 0 && (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Sale</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Items sold</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyReport.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{tx.saleNumber}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {tx.saleDate ? new Date(tx.saleDate).toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 text-xs max-w-[14rem]">
                          {(tx.lineItems || []).length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <ul className="list-disc list-inside space-y-0.5">
                              {(tx.lineItems || []).map((li, idx) => (
                                <li key={`${tx.id}-${idx}`}>
                                  <span className="font-medium text-gray-800">{li.description}</span>
                                  {' × '}
                                  {li.quantity}
                                  {li.unitPrice != null ? (
                                    <span className="text-gray-500">
                                      {' '}
                                      @ {formatCurrency(li.unitPrice)}
                                    </span>
                                  ) : null}
                                  {' → '}
                                  {formatCurrency(li.amount ?? 0)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(tx.total || 0)}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {(tx.paymentLines || []).map((l, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-medium">{l.label}</span>: {formatCurrency(l.amount)}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">No POS sales found for this date.</p>
        )}

        {showDepositModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Deposit to accounts</h3>
              <p className="text-xs text-gray-500 mb-4">
                Move cash from the system Cash account to bank or other payment accounts (same balances as{' '}
                <a href="/payments/management" className="text-blue-600 underline">
                  Payment Management
                </a>
                ).
              </p>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {depositLines.map((row, idx) => (
                  <div key={idx} className="flex flex-col gap-1 border border-gray-100 rounded-lg p-3">
                    <label className="text-xs text-gray-500">Destination account</label>
                    <select
                      className="border rounded-lg px-2 py-1.5 text-sm"
                      value={row.toAccountId}
                      onChange={(e) => {
                        const next = [...depositLines];
                        next[idx] = { ...next[idx], toAccountId: e.target.value };
                        setDepositLines(next);
                      }}
                    >
                      <option value="">Select account</option>
                      {paymentAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.accountType})
                        </option>
                      ))}
                    </select>
                    <label className="text-xs text-gray-500">Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="border rounded-lg px-2 py-1.5 text-sm"
                      value={row.amount}
                      onChange={(e) => {
                        const next = [...depositLines];
                        next[idx] = { ...next[idx], amount: e.target.value };
                        setDepositLines(next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  className="text-sm text-blue-600"
                  onClick={() => setDepositLines([...depositLines, { toAccountId: '', amount: '', notes: '' }])}
                >
                  + Add split
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200"
                  onClick={() => setShowDepositModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={posCashActionLoading}
                  className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                  onClick={submitPosDeposits}
                >
                  {posCashActionLoading ? 'Saving…' : 'Save deposits'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Sales Section - Full Width at Bottom */}
      <div className="mt-6 lg:mt-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500"></div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Recent Sales</h2>
        </div>
          <div className="mb-6">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search sales..." 
                className="w-full p-3 pl-10 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                // Note: This would ideally be connected to an actual search function
              />
              <div className="absolute left-3 top-3.5">
                <Search className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
          
          {isLoadingSales ? (
            <div className="flex justify-center items-center py-16">
              <Loader className="animate-spin h-8 w-8 text-blue-500" />
            </div>
          ) : salesError ? (
            <div className="text-center py-16">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-500">{salesError}</p>
              <button 
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
                onClick={loadRecentSales}
              >
                <RefreshCw className="w-4 h-4 mr-2 inline-block" />
                Try Again
              </button>
            </div>
          ) : recentSales.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No sales recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {recentSales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      className="hover:bg-blue-50 transition-colors" 
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          {sale.saleNumber}
                          {sale.isHistorical && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Calendar className="w-3 h-3 mr-1" />
                              Historical
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sale.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sale.client}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{sale.total}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                            onClick={() => viewSaleDetails(sale.id)}
                            title="View Details"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          {pagePermissions.canVoidSales && sale.status === 'completed' && (
                            <button
                              className="text-orange-600 hover:text-orange-800 p-1.5 rounded-lg hover:bg-orange-100 transition-colors"
                              onClick={() => {
                                setSelectedSaleForAction(sale);
                                setShowVoidModal(true);
                              }}
                              title="Void Sale"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {pagePermissions.canRefundSales && sale.status === 'completed' && (
                            <button
                              className="text-purple-600 hover:text-purple-800 p-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                              onClick={() => {
                                setSelectedSaleForAction(sale);
                                setShowRefundModal(true);
                              }}
                              title="Refund Sale"
                            >
                              <RotateCcw className="w-4 h-4" />
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
          
        <div className="mt-6 flex justify-center">
          <a href="/pos/list" className="text-blue-600 text-sm font-semibold hover:text-blue-800 hover:underline flex items-center transition-colors">
            View All Sales
            <ArrowRight className="w-4 h-4 ml-1" />
          </a>
        </div>
      </div>
      
      {/* Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-fadeInUp"
            ref={receiptModalRef}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Sale Completed</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowReceiptModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6 text-center">
              <div className="bg-green-100 text-green-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold mb-2">Success!</h4>
              <p className="text-gray-600">
                Sale {receiptNumber} has been completed successfully.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-md p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">Sale Details:</p>
              <p className="text-lg font-bold mb-1">
                Total:{' '}
                {currentReceipt
                  ? formatCurrency(currentReceipt.total)
                  : formatCurrency(calculateTotal())}
              </p>
              {currentReceipt != null &&
                currentReceipt.posAmountTendered != null &&
                currentReceipt.posAmountTendered !== '' && (
                  <div className="text-sm text-gray-700 space-y-0.5 mt-2 pt-2 border-t border-gray-200">
                    <div className="flex justify-between">
                      <span>Amount tendered</span>
                      <span className="font-medium">
                        {formatCurrency(currentReceipt.posAmountTendered)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-emerald-800">
                      <span>Change</span>
                      <span>
                        {formatCurrency(
                          currentReceipt.posChangeGiven != null
                            ? currentReceipt.posChangeGiven
                            : 0
                        )}
                      </span>
                    </div>
                  </div>
                )}
              {/* Payment Method - Show split payments if available */}
              {currentReceipt?.payments && currentReceipt.payments.length > 0 && currentReceipt.payments[0].allocations && currentReceipt.payments[0].allocations.length > 1 ? (
                <div className="text-sm text-gray-600">
                  <div className="font-semibold mb-1">Payment (Split):</div>
                  {currentReceipt.payments[0].allocations.map((alloc, idx) => (
                    <div key={idx} className="flex justify-between text-xs mb-0.5">
                      <span>{alloc.paymentAccount?.name || 'N/A'}:</span>
                      <span className="font-medium">{formatCurrency(alloc.amount || 0)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs mt-1 pt-1 border-t border-gray-200 font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(currentReceipt.payments[0].amount || currentReceipt.total || 0)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Payment Method: {currentReceipt?.payments && currentReceipt.payments.length > 0 && currentReceipt.payments[0].allocations && currentReceipt.payments[0].allocations.length > 0
                    ? currentReceipt.payments[0].allocations.map(alloc => alloc.paymentAccount?.name || 'N/A').join(', ')
                    : currentReceipt?.paymentMethod || (paymentMethod ? (paymentAccounts.find(acc => acc.id === paymentMethod)?.name || paymentMethod) : 'N/A')}
                </p>
              )}
              {calculateTaxAmount() > 0 && (
                <p className="text-sm text-gray-600">
                  Total Tax: {formatCurrency(calculateTaxAmount())}
                </p>
              )}
              {calculateDiscountAmount() > 0 && (
                <p className="text-sm text-gray-600">
                  Total Discount: {formatCurrency(calculateDiscountAmount())}
                </p>
              )}
              {globalDiscount > 0 && (
                <p className="text-sm text-gray-600">
                  Global Discount: {formatCurrency(globalDiscount)}
                </p>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button 
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 flex items-center justify-center hover:bg-gray-50"
                onClick={() => setShowReceiptModal(false)}
              >
                Close
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md flex items-center justify-center hover:bg-blue-700"
                onClick={handlePrintReceipt}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* CSS for animations */}
      <style jsx global>{`
        .animated {
          animation-duration: 0.3s;
          animation-fill-mode: both;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate3d(0, 20px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        
        .fadeIn {
          animation-name: fadeIn;
        }
        
        .fadeInUp {
          animation-name: fadeInUp;
        }
      `}</style>

      {/* Custom Product Modal */}
      {showCustomProduct && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Custom Product</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowCustomProduct(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Product Name *</label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-200 rounded-md"
                  placeholder="Enter product name"
                  value={customProduct.name}
                  onChange={(e) => setCustomProduct({...customProduct, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Price *</label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-200 rounded-md"
                  placeholder="Enter price"
                  min="0"
                  step="0.01"
                  value={customProduct.price}
                  onChange={(e) => setCustomProduct({...customProduct, price: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full p-2 border border-gray-200 rounded-md"
                  rows="2"
                  placeholder="Enter description (optional)"
                  value={customProduct.description}
                  onChange={(e) => setCustomProduct({...customProduct, description: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-200 rounded-md"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button 
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => setShowCustomProduct(false)}
              >
                Cancel
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={addCustomProduct}
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Sale Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Void Sale</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowVoidModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Are you sure you want to void sale {selectedSaleForAction?.saleNumber}?
              </p>
              <p className="text-sm text-red-600">
                This action will cancel the transaction and restore inventory levels.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Reason for voiding *</label>
              <textarea
                className="w-full p-2 border border-gray-200 rounded-md"
                rows="3"
                placeholder="Enter reason for voiding this sale..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>
            
            <div className="flex space-x-3">
              <button 
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => setShowVoidModal(false)}
                disabled={isProcessingVoid}
              >
                Cancel
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center"
                onClick={handleVoidSale}
                disabled={isProcessingVoid || !voidReason.trim()}
              >
                {isProcessingVoid ? (
                  <>
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                    Voiding...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-2" />
                    Void Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Payment Modal */}
      {showSplitPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Split Payment</h2>
            <p className="text-sm text-gray-600 mb-4">
              Total Amount: <span className="font-bold">{formatCurrency(calculateTotal())}</span>
            </p>
            
            <div className="space-y-3 mb-4">
              {paymentAllocations.map((alloc, idx) => {
                const account = paymentAccounts.find(a => a.id === alloc.paymentAccountId);
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <select
                      value={alloc.paymentAccountId}
                      onChange={(e) => {
                        const newAllocations = [...paymentAllocations];
                        newAllocations[idx].paymentAccountId = e.target.value;
                        setPaymentAllocations(newAllocations);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {paymentAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={alloc.amount}
                      onChange={(e) => {
                        const newAllocations = [...paymentAllocations];
                        newAllocations[idx].amount = parseFloat(e.target.value) || 0;
                        setPaymentAllocations(newAllocations);
                      }}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Amount"
                      min="0"
                      step="0.01"
                    />
                    <button
                      onClick={() => {
                        const newAllocations = paymentAllocations.filter((_, i) => i !== idx);
                        setPaymentAllocations(newAllocations);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      disabled={paymentAllocations.length === 1}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
            
            <button
              onClick={() => {
                const cashAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive);
                const defaultAccount = cashAccount || paymentAccounts.find(acc => acc.isActive) || paymentAccounts[0];
                if (defaultAccount) {
                  setPaymentAllocations([...paymentAllocations, { paymentAccountId: defaultAccount.id, amount: 0 }]);
                }
              }}
              className="mb-4 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              + Add Payment Account
            </button>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Allocated:</span>
                <span className="font-semibold">{formatCurrency(paymentAllocations.reduce((sum, a) => sum + (a.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Total:</span>
                <span className="font-semibold">{formatCurrency(calculateTotal())}</span>
              </div>
              <div className="flex justify-between text-sm mt-1 font-bold">
                <span>Remaining:</span>
                <span className={Math.abs(calculateTotal() - paymentAllocations.reduce((sum, a) => sum + (a.amount || 0), 0)) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(calculateTotal() - paymentAllocations.reduce((sum, a) => sum + (a.amount || 0), 0))}
                </span>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  // Auto-allocate remaining amount to first account
                  const total = calculateTotal();
                  const allocated = paymentAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);
                  const remaining = total - allocated;
                  if (remaining > 0 && paymentAllocations.length > 0) {
                    const newAllocations = [...paymentAllocations];
                    newAllocations[0].amount = (newAllocations[0].amount || 0) + remaining;
                    setPaymentAllocations(newAllocations);
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Auto-Allocate Remaining
              </button>
              <button
                onClick={() => setShowSplitPaymentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const total = calculateTotal();
                  const allocated = paymentAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);
                  if (Math.abs(total - allocated) < 0.01) {
                    setShowSplitPaymentModal(false);
                  } else {
                    alert(`Payment allocations must equal the total amount. Remaining: ${formatCurrency(total - allocated)}`);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Sale Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Refund Sale</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowRefundModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Are you sure you want to refund sale {selectedSaleForAction?.saleNumber}?
              </p>
              <p className="text-sm text-purple-600">
                This action will reverse the sale, restore inventory, and adjust financial records.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Reason for refund *</label>
              <textarea
                className="w-full p-2 border border-gray-200 rounded-md"
                rows="3"
                placeholder="Enter reason for refunding this sale..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            
            <div className="flex space-x-3">
              <button 
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => setShowRefundModal(false)}
                disabled={isProcessingRefund}
              >
                Cancel
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center justify-center"
                onClick={handleRefundSale}
                disabled={isProcessingRefund || !refundReason.trim()}
              >
                {isProcessingRefund ? (
                  <>
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Process Refund
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Render the ClientModal at the end of the component */}
      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onClientCreated={handleClientCreated}
      />
    </div>
    </PermissionGuard>
  );
};

export default POSPage;