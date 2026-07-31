"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, ChevronDown, Info, Search, Loader, Package, Tag, Edit2, Check, XCircle } from "lucide-react";
import { calculateInvoiceTotals as calculateInvoiceTotalsCanonical } from "@/lib/invoiceTotals";
import { calculateProductTaxes } from "@/lib/productTaxCalculations";
import { denormalizedPercentageTaxRate, normalizeLineTaxes } from "@/lib/documentLineTaxes";
import { addMoney, percentOfMoney, roundMoney, subtractMoney, multiplyMoney, parseMoney } from "@/lib/money";
import ClientModal from "./ClientModal";
import ClientSearchCombobox from "./ClientSearchCombobox";
import InvoiceReceiptModal from "./InvoiceReceiptModal";
import UnitBasedQuantityInput from "./UnitBasedQuantityInput";
import { fetchProductsForSaleAll } from "@/app/services/salesService";

const lineTaxesOf = (item) =>
  normalizeLineTaxes(item?.taxes || item?.itemTaxes || item?.productTaxes || []);

const calculateItemTotals = (item) => {
  const quantity = parseMoney(item.quantity);
  const unitPrice = parseMoney(item.unitPrice);
  const perItemDiscount = parseMoney(item.discountAmount);
  const lineTotal = multiplyMoney(quantity, unitPrice);
  const totalDiscountAmount = multiplyMoney(perItemDiscount, quantity);
  const netAmount = subtractMoney(lineTotal, totalDiscountAmount);
  const taxes = lineTaxesOf(item);
  const taxAmount =
    taxes.length > 0
      ? calculateProductTaxes(netAmount, taxes, quantity).totalTaxAmount
      : percentOfMoney(netAmount, item.taxRate || 0);
  const finalAmount = addMoney(netAmount, taxAmount);
  return {
    lineTotal: roundMoney(lineTotal),
    discountAmount: roundMoney(totalDiscountAmount),
    perItemDiscount: roundMoney(perItemDiscount),
    netAmount: roundMoney(netAmount),
    taxAmount: roundMoney(taxAmount),
    amount: roundMoney(finalAmount),
  };
};

const calculateInvoiceTotals = (items, globalDiscount = 0) => {
  const t = calculateInvoiceTotalsCanonical(items, globalDiscount);
  const netSubtotal = subtractMoney(
    subtractMoney(t.subtotal, t.totalDiscountAmount),
    t.globalDiscount
  );
  return {
    subtotal: t.subtotal,
    totalDiscountAmount: t.totalDiscountAmount,
    globalDiscount: t.globalDiscount,
    netSubtotal,
    taxAmount: t.taxAmount,
    total: t.total,
  };
};

const InvoiceModal = ({
  isOpen,
  onClose,
  mode,
  invoice,
  onSubmit,
  // Added template props
  templates = [],
  selectedTemplate = null,
  onTemplateChange = () => {}
}) => {
  const [formData, setFormData] = useState({
    clientId: "",
    title: "",
    orderNumber: "",
    orderNumberAutogenerate: false,
    items: [{ 
      description: "", 
      quantity: "", 
      unitPrice: "", 
      taxRate: "0",
      discountAmount: "", // NEW: Added discount amount
      accountId: "",
      productTaxes: [] // Store all taxes applied to the product
    }],
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "Draft",
    notes: "",
    discount: "",
    templateId: selectedTemplate?.id || "",
    footerPhoneOverride: "",
    footerBankDetailsOverride: ""
  });
  
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [incomeAccounts, setIncomeAccounts] = useState([]);
  // Default postable revenue leaf (e.g. 4100 Product Sales), not section header 4000
  const [revenueAccount, setRevenueAccount] = useState(null);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [itemSearchQueries, setItemSearchQueries] = useState({}); // Separate search query for each item
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(null); // Track which item is actively searching
  const [loading, setLoading] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [errors, setErrors] = useState({});
  const [showClientModal, setShowClientModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState(null);
  
  // NEW: Tax types state and default for inflow (sales/invoices) - auto-populated from settings
  const [taxTypes, setTaxTypes] = useState([]);
  const [defaultTaxTypeForInflow, setDefaultTaxTypeForInflow] = useState(null);
  const [isLoadingTaxTypes, setIsLoadingTaxTypes] = useState(false);
  const [showNewTaxForm, setShowNewTaxForm] = useState(false);
  const [newTaxData, setNewTaxData] = useState({ name: '', taxRate: 17.5, calculationType: 'Percentage', description: '' });
  
  // Unit management state
  const [unitQuantities, setUnitQuantities] = useState({}); // Store unit quantities for each item
  
  // Refs for product search dropdown
  const productSearchRef = useRef(null);
  const prevIsOpenRef = useRef(false);

  // Helper function to detect if a product has unit management
  const hasUnitManagement = (product) => {
    return product && product.units && product.units.length > 0;
  };
  
  // Handle unit-based quantity changes
  const handleUnitQuantityChange = (itemIndex, newQuantity) => {
    const updatedItems = [...formData.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      quantity: newQuantity
    };
    setFormData({ ...formData, items: updatedItems });
  };
  
  // Handle unit-based price changes
  const handleUnitPriceChange = (itemIndex, newPrice) => {
    const updatedItems = [...formData.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      unitPrice: newPrice
    };
    setFormData({ ...formData, items: updatedItems });
  };
  
  // Handle unit quantities changes
  const handleUnitQuantitiesChange = (itemIndex, newUnitQuantities) => {
    setUnitQuantities(prev => ({
      ...prev,
      [itemIndex]: newUnitQuantities
    }));
    
    // Update the item's quantity and Selling Price based on unit quantities
    const item = formData.items[itemIndex];
    if (hasUnitManagement(item.product) && item.product.units) {
      let totalBaseQuantity = 0;
      let totalPrice = 0;
      
      Object.entries(newUnitQuantities).forEach(([unitId, qty]) => {
        const unit = item.product.units.find(u => u.id === unitId);
        if (unit && qty > 0) {
          const conversionRate = parseFloat(unit.conversionToBase);
          const convertedToBase = unit.isBaseUnit ? qty : qty / conversionRate;
          totalBaseQuantity += convertedToBase;
          totalPrice = addMoney(totalPrice, multiplyMoney(qty, unit.unitPrice || 0));
        }
      });
      
      // Calculate average Selling Price (total price / total quantity)
      const averageUnitPrice = totalBaseQuantity > 0 ? roundMoney(totalPrice / totalBaseQuantity) : 0;
      
      // Update the item with calculated values
      const updatedItems = [...formData.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        quantity: totalBaseQuantity,
        unitPrice: averageUnitPrice // Use average Selling Price, not total price
      };
      setFormData({ ...formData, items: updatedItems });
    }
  };
  
  // Initialize form data when editing an existing invoice
  useEffect(() => {
    if (mode === "edit" && invoice) {
      setFormData({
        clientId: invoice.clientId,
        title: invoice.title || "",
        orderNumber: invoice.orderNumber || "",
        orderNumberAutogenerate: false,
        items: invoice.items?.map(item => {
          const taxes = normalizeLineTaxes(item.taxes || item.itemTaxes || item.productTaxes || []);
          return {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: taxes.length ? denormalizedPercentageTaxRate(taxes) : (item.taxRate || "0"),
            productId: item.productId,
            discountAmount: item.discountAmount || 0,
            accountId: item.accountId || revenueAccount?.id || "",
            taxes,
            productTaxes: taxes,
            selectedTaxTypeId: taxes[0]?.taxTypeId || taxes[0]?.id || "",
          };
        }) || [{ 
          description: "", 
          quantity: "", 
          unitPrice: "", 
          taxRate: "0",
          discountAmount: "",
          accountId: revenueAccount?.id || "",
          taxes: [],
          productTaxes: [],
          selectedTaxTypeId: "",
        }],
        issueDate: new Date(invoice.issueDate).toISOString().split("T")[0],
        dueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
        status: invoice.status,
        notes: invoice.notes || "",
        discount: parseFloat((invoice.discount || '0').toString().replace(/,/g, '')) || "",
        templateId: invoice.templateId || selectedTemplate?.id || "",
        footerPhoneOverride: invoice.footerPhoneOverride ?? "",
        footerBankDetailsOverride: invoice.footerBankDetailsOverride ?? ""
      });
    }
  }, [invoice, mode]);

  // Reset form when opening Create New Invoice; default to no tax (user selects tax from dropdown if needed)
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = !!isOpen;
    if (!justOpened || mode !== 'create' || invoice) return;
    const firstItem = {
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: "0",
      discountAmount: "",
      accountId: revenueAccount?.id || "",
      productTaxes: [],
      selectedTaxTypeId: ""
    };
    setFormData({
      clientId: "",
      title: "",
      orderNumber: "",
      orderNumberAutogenerate: false,
      items: [firstItem],
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "Draft",
      notes: "",
      discount: "",
      templateId: selectedTemplate?.id || "",
      footerPhoneOverride: "",
      footerBankDetailsOverride: ""
    });
    setUnitQuantities({});
  }, [isOpen, mode, invoice, revenueAccount?.id, selectedTemplate?.id]);

  // When modal opens without a revenue account, fetch income accounts (e.g. retry or late load)
  useEffect(() => {
    if (!isOpen || revenueAccount != null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chart-of-accounts/income-accounts');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const accounts = Array.isArray(data.accounts) ? data.accounts : [];
        const revenueOnly =
          accounts.find((a) => a.id === data.defaultAccountId) ||
          accounts[0] ||
          null;
        if (!cancelled && revenueOnly) {
          setRevenueAccount(revenueOnly);
          setIncomeAccounts(accounts.length ? accounts : [revenueOnly]);
        }
      } catch (e) {
        if (!cancelled) console.error('Error loading income accounts:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, revenueAccount]);

  // When default revenue account is set, ensure all items use it
  useEffect(() => {
    if (revenueAccount?.id && formData.items.some(item => item.accountId !== revenueAccount.id)) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => ({ ...item, accountId: revenueAccount.id }))
      }));
    }
  }, [revenueAccount?.id]);

  // No auto-apply of default tax: user selects tax from dropdown per line (default is "No tax")

  // Update template selection when available templates change
  useEffect(() => {
    if (templates.length && !formData.templateId) {
      const defaultTemplate = templates.find(t => t.isDefault) || templates[0];
      if (defaultTemplate) {
        setFormData(prev => ({ 
          ...prev, 
          templateId: defaultTemplate.id 
        }));
        if (onTemplateChange) {
          onTemplateChange(defaultTemplate);
        }
      }
    }
  }, [templates]);
  
  // Load products using the same enhanced method as POS
  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true);
      setProductsError(null);
      
      // Fetch all products across pages so everything is searchable
      const productsData = await fetchProductsForSaleAll({ pageSize: 100 });
      setProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error) {
      console.error("Error loading products:", error);
      setProductsError("Failed to load products");
      
      // Use sample data if API fails
      const sampleProducts = [
      ];
      setProducts(sampleProducts);
      setFilteredProducts(sampleProducts);
    } finally {
      setIsLoadingProducts(false);
    }
  };
  
  // Load clients and products on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all clients without pagination limits
        const clientsResponse = await fetch('/api/clients?limit=10000');
        if (clientsResponse.ok) {
          const clientsData = await clientsResponse.json();
          setClients(clientsData.clients || []);
        }
        
        // Load products using enhanced method
        await loadProducts();

        // Postable leaf income accounts only (never section header 4000)
        const accountsResponse = await fetch('/api/chart-of-accounts/income-accounts');
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          const accounts = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
          const revenueOnly =
            accounts.find((a) => a.id === accountsData.defaultAccountId) ||
            accounts[0] ||
            null;
          setRevenueAccount(revenueOnly);
          setIncomeAccounts(accounts.length ? accounts : revenueOnly ? [revenueOnly] : []);
        } else {
          console.error('Failed to fetch income accounts:', accountsResponse.status, accountsResponse.statusText);
        }

        // NEW: Load tax types and default tax for inflow (sales/invoices)
        setIsLoadingTaxTypes(true);
        try {
          const [taxTypesResponse, taxDefaultsResponse] = await Promise.all([
            fetch('/api/tax-types'),
            fetch('/api/settings/tax-defaults').catch(() => null)
          ]);
          let taxTypesData = [];
          if (taxTypesResponse.ok) {
            const taxTypesJson = await taxTypesResponse.json();
            taxTypesData = taxTypesJson.taxTypes || taxTypesJson || [];
            if (!Array.isArray(taxTypesData)) taxTypesData = [];
            setTaxTypes(taxTypesData);
          }
          let defaultInflow = null;
          if (taxDefaultsResponse?.ok) {
            const defaults = await taxDefaultsResponse.json();
            defaultInflow = defaults.defaultTaxTypeForInflow || null;
          }
          // Fallback: if no default from settings, use first active tax type so VAT is applied on new invoices
          if (!defaultInflow && taxTypesData.length > 0) {
            defaultInflow = taxTypesData[0];
          }
          setDefaultTaxTypeForInflow(defaultInflow);
        } catch (taxError) {
          console.error('Error loading tax types:', taxError);
        } finally {
          setIsLoadingTaxTypes(false);
        }
      } catch (error) {
        console.error("Error loading form data:", error);
      }
    };
    
    fetchData();
  }, []);

  // Filter products based on active search query - True combobox like POS
  useEffect(() => {
    if (activeSearchIndex === null) {
      setFilteredProducts([]);
      setShowProductDropdown(false);
      return;
    }
    
    const currentQuery = itemSearchQueries[activeSearchIndex] || "";
    
    // If search query is empty, show ALL products (true combobox behavior)
    if (currentQuery.trim() === "") {
      setFilteredProducts(products);
    } else {
      // Filter products by search query (name and SKU)
      const query = currentQuery.toLowerCase();
      const filtered = products.filter(
      product => 
        product.name.toLowerCase().includes(query) || 
        (product.sku && product.sku.toLowerCase().includes(query))
    );
    setFilteredProducts(filtered);
    }
    
    // Show dropdown if we have an active search index and products
    setShowProductDropdown(activeSearchIndex !== null && products.length > 0);
  }, [itemSearchQueries, activeSearchIndex, products]);

  // Close product dropdown when clicking outside or pressing escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target)) {
        setShowProductDropdown(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowProductDropdown(false);
        setActiveSearchIndex(null);
      }
    };

    if (showProductDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showProductDropdown]);
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
    
    // Handle template change
    if (name === "templateId" && onTemplateChange) {
      const selected = templates.find(t => t.id === value);
      onTemplateChange(selected || null);
    }
  };
  
  // Handle item changes
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: field === "quantity" || field === "unitPrice" || field === "taxRate" || field === "discountAmount" // NEW: Added discountAmount
        ? parseFloat(value) || "" 
        : value
    };
    
    // If product ID changes, update the description, unitPrice, and taxRate
    if (field === "productId" && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        updatedItems[index].description = product.name;
        updatedItems[index].unitPrice = product.price;
        // Apply product's tax rate if available
        if (product.taxRate !== undefined && product.taxRate !== null) {
          updatedItems[index].taxRate = product.taxRate;
        }
      }
    }
    
    setFormData({
      ...formData,
      items: updatedItems
    });
    
    // Clear item errors
    if (errors[`items.${index}.${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`items.${index}.${field}`];
      setErrors(newErrors);
    }
  };

  // Toggle a tax type on/off for a line (multi-tax)
  const handleTaxTypeToggle = (index, taxTypeId) => {
    const updatedItems = [...formData.items];
    const current = lineTaxesOf(updatedItems[index]);
    let next;
    if (!taxTypeId) {
      next = [];
    } else if (current.some((t) => t.taxTypeId === taxTypeId || t.id === taxTypeId)) {
      next = current.filter((t) => t.taxTypeId !== taxTypeId && t.id !== taxTypeId);
    } else {
      const selectedTax = taxTypes.find((t) => t.id === taxTypeId);
      next = selectedTax ? normalizeLineTaxes([...current, selectedTax]) : current;
    }
    updatedItems[index] = {
      ...updatedItems[index],
      taxes: next,
      productTaxes: next,
      taxRate: denormalizedPercentageTaxRate(next),
      selectedTaxTypeId: next[0]?.taxTypeId || next[0]?.id || '',
    };
    setFormData({ ...formData, items: updatedItems });
  };

  // NEW: Add new tax type
  const handleAddNewTax = async () => {
    if (!newTaxData.name.trim()) {
      alert('Please enter a tax name');
      return;
    }
    
    try {
      const response = await fetch('/api/tax-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTaxData)
      });
      
      if (response.ok) {
        const createdTax = await response.json();
        setTaxTypes(prev => [...prev, createdTax]);
        setShowNewTaxForm(false);
        setNewTaxData({ name: '', taxRate: 17.5, calculationType: 'Percentage', description: '' });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create tax type');
      }
    } catch (error) {
      console.error('Error creating tax type:', error);
      alert('Failed to create tax type');
    }
  };

  // Handle product selection from dropdown
  const handleProductSelect = async (index, product) => {
    try {
      // Fetch full product details including units and taxes
      const [productResponse, taxesResponse] = await Promise.all([
        fetch(`/api/stock/${product.id}`),
        fetch(`/api/products/${product.id}/taxes`)
      ]);
      
      let productData = product;
      let productTaxes = [];
      
      if (productResponse.ok) {
        productData = await productResponse.json();
      }
      
      if (taxesResponse.ok) {
        const taxesData = await taxesResponse.json();
        productTaxes = taxesData.taxes || [];
      }
      
      // If taxes API returned empty, try to get taxes from product data
      if (productTaxes.length === 0 && productData.taxes && productData.taxes.length > 0) {
        productTaxes = productData.taxes;
      }
      
      // If still no taxes, try productTaxes array from product data
      if (productTaxes.length === 0 && productData.productTaxes && productData.productTaxes.length > 0) {
        productTaxes = productData.productTaxes.map(pt => pt.taxType || pt).filter(Boolean);
      }
      
      const normalizedTaxes = normalizeLineTaxes(productTaxes);
      const combinedTaxRate =
        normalizedTaxes.length > 0
          ? denormalizedPercentageTaxRate(normalizedTaxes)
          : productData.taxRate !== undefined && productData.taxRate !== null
            ? productData.taxRate
            : 0;
      
      const updatedItems = [...formData.items];
      updatedItems[index] = {
        ...updatedItems[index],
        description: productData.name, // Set description from product name
        unitPrice: productData.price || productData.unitPrice || "",
        productId: productData.id,
        taxRate: combinedTaxRate,
        product: productData,
        taxes: normalizedTaxes,
        productTaxes: normalizedTaxes,
        selectedTaxTypeId: normalizedTaxes[0]?.taxTypeId || normalizedTaxes[0]?.id || '',
      };
      
      // Initialize unit quantities for unit-based products
      if (hasUnitManagement(productData)) {
        const initialUnitQuantities = {};
        productData.units?.forEach(unit => {
          initialUnitQuantities[unit.id] = 0;
        });
        setUnitQuantities(prev => ({
          ...prev,
          [index]: initialUnitQuantities
        }));
      }
      
      setFormData({ ...formData, items: updatedItems });
    } catch (error) {
      console.error("Error fetching product details:", error);
      // Fallback to basic product data
      const updatedItems = [...formData.items];
      updatedItems[index] = {
        ...updatedItems[index],
        description: product.name,
        unitPrice: product.price || product.unitPrice || "",
        productId: product.id,
        // Apply product's tax rate if available
        taxRate: product.taxRate !== undefined && product.taxRate !== null ? product.taxRate : (updatedItems[index].taxRate || 0),
        product: product,
        productTaxes: []
      };
      
      setFormData({ ...formData, items: updatedItems });
    }
    
    // Clear search state for this specific item
    setItemSearchQueries(prev => ({ ...prev, [index]: "" }));
    setShowProductDropdown(false);
    setActiveSearchIndex(null);
  };
  
  // Enhanced update discount function for global discount
  const updateGlobalDiscount = (discountValue) => {
    const discount = parseFloat(discountValue) || "";
    setFormData({ ...formData, discount });
  };
  
  // Add a new item (income account fixed to default postable revenue); default to no tax
  const addItem = () => {
    const newItem = {
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: "0",
      discountAmount: "",
      accountId: revenueAccount?.id || "",
      productTaxes: [],
      selectedTaxTypeId: ""
    };
    setFormData({
      ...formData,
      items: [...formData.items, newItem]
    });
  };
  
  // Remove an item
  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const updatedItems = [...formData.items];
      updatedItems.splice(index, 1);
      setFormData({
        ...formData,
        items: updatedItems
      });
    }
  };
  
  // Calculate totals
  const invoiceTotals = calculateInvoiceTotals(formData.items, formData.discount);
  const isAccountSelectionValid = formData.items.every(item => item.accountId);
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!revenueAccount) {
      newErrors.incomeAccount = "Income account is not loaded. Add a detail Income account (e.g. 4100 Product Sales) in Chart of Accounts, then try again.";
    }
    
    if (!formData.clientId) {
      newErrors.clientId = "Client is required";
    }
    
    if (!formData.issueDate) {
      newErrors.issueDate = "Issue date is required";
    }
    
    if (!formData.dueDate) {
      newErrors.dueDate = "Due date is required";
    }
    
    if (new Date(formData.dueDate) < new Date(formData.issueDate)) {
      newErrors.dueDate = "Due date cannot be before issue date";
    }
    
    // Validate each item
    formData.items.forEach((item, index) => {
      if (hasUnitManagement(item.product)) {
        // Special validation for unit-based products
        const itemUnitQuantities = unitQuantities[index] || {};
        const hasValidQuantities = Object.values(itemUnitQuantities).some(qty => qty > 0);
        
        if (!hasValidQuantities) {
          newErrors[`items.${index}.unitQuantities`] = "Please enter quantities for at least one unit";
        }
        
        return; // Skip other validations for unit-based products
      }
      
      // Only validate for non-unit-based products
      if (!item.description) {
        newErrors[`items.${index}.description`] = "Description is required";
      }
      
      if (item.quantity === "") {
        newErrors[`items.${index}.quantity`] = "Quantity is required";
      }
      
      if (item.unitPrice === "") {
        newErrors[`items.${index}.unitPrice`] = "Selling Price is required";
      }
      
      // Income account is set from revenueAccount when loaded; only validate per-item if we have revenue account
      if (revenueAccount && !item.accountId) {
        newErrors[`items.${index}.accountId`] = "Income account is required";
      }
      
      // Validate that per-item discount doesn't exceed Selling Price (only if discount is provided)
      if (item.discountAmount && item.discountAmount !== "") {
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const perItemDiscount = parseFloat(item.discountAmount) || 0;
        if (perItemDiscount > unitPrice) {
          newErrors[`items.${index}.discountAmount`] = "Per-item discount cannot exceed Selling Price";
        }
      }
    });
    
    // Check if there's at least one item
    if (formData.items.length === 0) {
      newErrors.items = "At least one item is required";
    }
    
    // Validate template selection
    if (!formData.templateId && templates.length > 0) {
      newErrors.templateId = "Please select an invoice template";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      // Transform form data to ensure proper types
      const transformedData = {
        ...formData,
        discount: parseFloat(formData.discount) || 0,
        items: formData.items.map((item, index) => {
          // For unit-based products, calculate total quantity from unit quantities
          let finalQuantity = parseFloat(item.quantity) || 0;
          
          if (hasUnitManagement(item.product) && unitQuantities[index]) {
            // Calculate total quantity in base units from unit quantities
            let totalBaseQuantity = 0;
            Object.entries(unitQuantities[index]).forEach(([unitId, qty]) => {
              const unit = item.product.units?.find(u => u.id === unitId);
              if (unit && qty > 0) {
                const conversionRate = parseFloat(unit.conversionToBase);
                const convertedToBase = unit.isBaseUnit ? qty : qty / conversionRate;
                totalBaseQuantity += convertedToBase;
              }
            });
            finalQuantity = totalBaseQuantity;
          }
          
          const taxes = lineTaxesOf(item);
          return {
            ...item,
            description: item.description || "",
            quantity: finalQuantity,
            unitPrice: parseFloat(item.unitPrice) || 0,
            taxRate: taxes.length ? denormalizedPercentageTaxRate(taxes) : parseFloat(item.taxRate) || 0,
            discountAmount: parseFloat(item.discountAmount) || 0,
            accountId: item.accountId || revenueAccount?.id || "",
            taxes,
            productTaxes: taxes,
            selectedTaxTypeId: taxes[0]?.taxTypeId || taxes[0]?.id || '',
            // Include unit quantities for unit-based products
            unitQuantities: hasUnitManagement(item.product) ? (unitQuantities[index] || {}) : null
          };
        })
      };
      
      // Debug logging removed for production
      
      // Submit transformed form data and get the created invoice
      const invoiceResult = await onSubmit(transformedData);
      setCreatedInvoice(invoiceResult);
      setShowReceiptModal(true);
      setFormData({
        clientId: "",
        title: "",
        orderNumber: "",
        orderNumberAutogenerate: false,
        items: [{ description: "", quantity: "", unitPrice: "", taxRate: "0", discountAmount: "", accountId: revenueAccount?.id || "", productTaxes: [] }],
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "Draft",
        notes: "",
        discount: "",
        templateId: selectedTemplate?.id || "",
        footerPhoneOverride: "",
        footerBankDetailsOverride: ""
      });
      onClose();
    } catch (error) {
      console.error("Error submitting invoice:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  const handleClientCreated = (newClient) => {
    setClients((prev) => [...prev, newClient]);
    setFormData((prev) => ({ ...prev, clientId: newClient.id }));
    setShowClientModal(false);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            {mode === "create" ? "Create New Invoice" : "Edit Invoice"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {!revenueAccount && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
              Loading income account… If this persists, add a detail Income account (e.g. 4100 Product Sales) in <strong>Chart of Accounts</strong>.
            </div>
          )}
          {errors.incomeAccount && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {errors.incomeAccount}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="clientId">
                  Client <span className="text-red-500">*</span>
                </label>
                <ClientSearchCombobox
                  clients={clients}
                  value={formData.clientId}
                  onChange={handleChange}
                  onAddNew={() => setShowClientModal(true)}
                  placeholder="Search or select a client..."
                  error={errors.clientId}
                  showAddNew={true}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
                  Invoice title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  placeholder="e.g. Consulting services, Project XYZ"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={formData.title || ""}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="orderNumber">
                  Order number
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    id="orderNumber"
                    name="orderNumber"
                    placeholder={formData.orderNumberAutogenerate ? "Auto-generated" : "Enter order number"}
                    className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500"
                    value={formData.orderNumber || ""}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    disabled={formData.orderNumberAutogenerate}
                  />
                  <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.orderNumberAutogenerate || false}
                      onChange={(e) => {
                        const autogen = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          orderNumberAutogenerate: autogen,
                          orderNumber: autogen ? `ORD-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : prev.orderNumber
                        }));
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Autogenerate
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="issueDate">
                  Issue Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="issueDate"
                  name="issueDate"
                  className={`w-full p-2 border rounded-md ${errors.issueDate ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.issueDate}
                  onChange={handleChange}
                />
                {errors.issueDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.issueDate}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="dueDate">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="dueDate"
                  name="dueDate"
                  className={`w-full p-2 border rounded-md ${errors.dueDate ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.dueDate}
                  onChange={handleChange}
                />
                {errors.dueDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>
                )}
              </div>
              
              {/* Template Selection */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="templateId">
                  Invoice Template
                </label>
                <div className="flex items-start">
                  <select
                    id="templateId"
                    name="templateId"
                    className={`w-full p-2 border rounded-md ${errors.templateId ? 'border-red-500' : 'border-gray-300'}`}
                    value={formData.templateId}
                    onChange={handleChange}
                  >
                    <option value="">Select a template</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <div className="flex items-center ml-2 text-blue-500 text-sm">
                      <Info className="h-4 w-4 mr-1" />
                      <span>No templates available. Create them in Account & business.</span>
                    </div>
                  )}
                </div>
                {errors.templateId && (
                  <p className="text-red-500 text-xs mt-1">{errors.templateId}</p>
                )}
              </div>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Invoice Items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </button>
              </div>
              
              <div className="">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                        Item
                      </th>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        Qty
                      </th>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Price
                      </th>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                        Discount (per item)
                      </th>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        Tax %
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Amount
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <div className="relative w-full min-w-[300px]" ref={productSearchRef}>
                              <input
                                type="text"
                              placeholder="Search products by name or SKU..."
                              className={`w-full p-3 border rounded-md text-sm ${errors[`items.${index}.description`] ? 'border-red-500' : 'border-gray-300'}`}
                                value={item.productId ? (products.find(p => p.id === item.productId)?.name || item.description) : (itemSearchQueries[index] || item.description)}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  
                                  if (item.productId) {
                                    // If a product is selected, clear it to allow custom description
                                    handleItemChange(index, "productId", "");
                                  }
                                  handleItemChange(index, "description", value);
                                  setItemSearchQueries(prev => ({ ...prev, [index]: value }));
                                  setActiveSearchIndex(index);
                                // Always show dropdown when typing (true combobox behavior)
                                setShowProductDropdown(true);
                                }}
                                onFocus={() => {
                                    setActiveSearchIndex(index);
                                // Show dropdown immediately on focus (true combobox behavior)
                                    setShowProductDropdown(true);
                              }}
                              onKeyDown={(e) => {
                                // Add first matching product on Enter
                                if (e.key === 'Enter' && filteredProducts.length > 0) {
                                  e.preventDefault();
                                  const product = filteredProducts[0];
                                  handleProductSelect(index, product);
                                }
                              }}
                            />
                            <div className="absolute right-3 top-3 pointer-events-none">
                              <Search className="w-4 h-4 text-gray-400" />
                            </div>

                            {/* Revenue account fixed to default postable leaf; hidden to reduce UI confusion */}
                            <input type="hidden" name={`items.${index}.accountId`} value={revenueAccount?.id || ''} />
                            {errors[`items.${index}.accountId`] && (
                              <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.accountId`]}</p>
                            )}
                            
                            {/* Enhanced Product combobox dropdown - POS Style */}
                            {showProductDropdown && activeSearchIndex === index && (
                              <div className="absolute z-10 mt-1 w-full min-w-[400px] bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {isLoadingProducts ? (
                                  <div className="p-4 text-center">
                                    <Loader className="w-5 h-5 text-blue-500 animate-spin mx-auto mb-2" />
                                    <p className="text-gray-500 text-sm">Loading products...</p>
                                  </div>
                                ) : filteredProducts.length === 0 ? (
                                  <div className="p-4 text-center">
                                    <p className="text-gray-500">No products found</p>
                                  </div>
                                ) : (
                                  <>
                                    {/* Show header with count */}
                                <div className="p-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                                      {itemSearchQueries[index] && itemSearchQueries[index].trim() !== "" 
                                        ? `Found ${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`
                                        : `All ${filteredProducts.length} products available`
                                      }
                                </div>
                                {filteredProducts.map(product => (
                                  <div 
                                    key={product.id}
                                        className={`p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex justify-between items-center ${product.stockLevel <= 0 ? 'opacity-50' : ''}`}
                                    onClick={() => handleProductSelect(index, product)}
                                  >
                                    <div>
                                          <p className="font-medium">{product.name}</p>
                                          <div className="flex text-xs text-gray-500 gap-2">
                                            {product.sku && <span>SKU: {product.sku}</span>}
                                            <span>In stock: {product.stockLevel !== null ? product.stockLevel : 'N/A'}</span>
                                          </div>
                                    </div>
                                    <div className="text-right">
                                          <p className="font-medium">{formatCurrency(product.price)}</p>
                                          {product.stockLevel <= 0 ? (
                                            <span className="text-xs text-red-500">Out of stock</span>
                                          ) : (
                                            <button 
                                              className="text-xs text-blue-600 hover:text-blue-800"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleProductSelect(index, product);
                                              }}
                                            >
                                              + Add to invoice
                                            </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          {errors[`items.${index}.description`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.description`]}</p>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {hasUnitManagement(item.product) ? (
                            <div className="text-center">
                              <div className="text-sm text-blue-600 font-medium">
                                {parseFloat(item.quantity || 0).toFixed(3)}
                              </div>
                              <div className="text-xs text-blue-500">calculated</div>
                            </div>
                          ) : (
                            <input
                              type="number"
                              className={`w-16 p-2 border rounded-md text-sm ${errors[`items.${index}.quantity`] ? 'border-red-500' : 'border-gray-300'}`}
                              value={item.quantity || ''}
                              step="1"
                              onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                              title="Enter the quantity of items"
                            />
                          )}
                          {errors[`items.${index}.quantity`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.quantity`]}</p>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {hasUnitManagement(item.product) ? (
                            <div className="text-center">
                              <div className="text-sm text-blue-600 font-medium">
                                {formatCurrency(item.unitPrice || 0)}
                              </div>
                              <div className="text-xs text-blue-500">per unit</div>
                            </div>
                          ) : (
                            <input
                              type="number"
                              className={`w-24 p-2 border rounded-md text-sm ${errors[`items.${index}.unitPrice`] ? 'border-red-500' : 'border-gray-300'}`}
                              value={item.unitPrice || ''}
                              step="0.01"
                              onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                              title="Enter the price per unit in MWK"
                            />
                          )}
                          {errors[`items.${index}.unitPrice`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.unitPrice`]}</p>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">MK</span>
                            <input
                              type="number"
                              className={`w-20 pl-6 pr-2 py-2 border rounded-md text-sm ${errors[`items.${index}.discountAmount`] ? 'border-red-500' : 'border-gray-300'}`}
                              value={item.discountAmount || ''}
                              step="0.01"
                              placeholder="0.00"
                              onChange={(e) => handleItemChange(index, "discountAmount", e.target.value)}
                              title="Enter the discount amount in MWK per individual item"
                            />
                          </div>
                          {errors[`items.${index}.discountAmount`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.discountAmount`]}</p>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <div className="flex flex-col min-w-[11rem] max-w-[14rem]">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[11px] font-medium text-slate-600">Taxes</span>
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-800"
                                onClick={() => setShowNewTaxForm(!showNewTaxForm)}
                                title="Add new tax type"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div
                              className={`max-h-28 overflow-y-auto rounded-md border px-2 py-1.5 space-y-1 ${
                                errors[`items.${index}.taxRate`] ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              {isLoadingTaxTypes ? (
                                <p className="text-xs text-slate-500">Loading...</p>
                              ) : taxTypes.length === 0 ? (
                                <p className="text-xs text-slate-500">No taxes configured</p>
                              ) : (
                                taxTypes.map((tax) => {
                                  const checked = lineTaxesOf(item).some(
                                    (t) => t.taxTypeId === tax.id || t.id === tax.id
                                  );
                                  const label = tax.calculationType === 'Fixed'
                                    ? `${tax.taxName || tax.taxId} (Fixed ${tax.taxRate})`
                                    : `${tax.taxName || tax.taxId} (${tax.taxRate}%)`;
                                  return (
                                    <label
                                      key={tax.id}
                                      className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-0.5 py-0.5"
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={checked}
                                        onChange={() => handleTaxTypeToggle(index, tax.id)}
                                      />
                                      <span className="leading-snug">{label}</span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                            {lineTaxesOf(item).length > 0 && (
                              <button
                                type="button"
                                className="mt-1 text-left text-xs text-slate-500 hover:text-slate-700"
                                onClick={() => handleTaxTypeToggle(index, '')}
                              >
                                Clear taxes
                              </button>
                            )}

                            {showNewTaxForm && (
                              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs">
                                <div className="font-medium text-blue-900 mb-1">Add New Tax</div>
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    placeholder="Tax name (e.g., VAT)"
                                    className="w-full p-1 border border-gray-300 rounded text-xs"
                                    value={newTaxData.name}
                                    onChange={(e) => setNewTaxData({...newTaxData, name: e.target.value})}
                                  />
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      placeholder="Rate"
                                      className="w-16 p-1 border border-gray-300 rounded text-xs"
                                      value={newTaxData.taxRate}
                                      onChange={(e) => setNewTaxData({...newTaxData, taxRate: parseFloat(e.target.value) || 0})}
                                    />
                                    <select
                                      className="p-1 border border-gray-300 rounded text-xs"
                                      value={newTaxData.calculationType}
                                      onChange={(e) => setNewTaxData({...newTaxData, calculationType: e.target.value})}
                                    >
                                      <option value="Percentage">%</option>
                                      <option value="Fixed">Fixed</option>
                                    </select>
                                    <button
                                      type="button"
                                      className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                      onClick={handleAddNewTax}
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      className="p-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                      onClick={() => {
                                        setShowNewTaxForm(false);
                                        setNewTaxData({ name: '', taxRate: 17.5, calculationType: 'Percentage', description: '' });
                                      }}
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                            {errors[`items.${index}.taxRate`] && (
                              <p className="text-red-500 text-xs mt-1">{errors[`items.${index}.taxRate`]}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                          {formatCurrency(calculateItemTotals(item).amount)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => removeItem(index)}
                            disabled={formData.items.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Unit-Based Products Section */}
              {formData.items.some(item => hasUnitManagement(item.product)) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-3">Unit-Based Products</h3>
                  <div className="space-y-4">
                    {formData.items
                      .map((item, index) => ({ item, index }))
                      .filter(({ item }) => hasUnitManagement(item.product))
                      .map(({ item, index }) => (
                        <div key={index} className="bg-white border border-blue-200 rounded-md p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">{item.description}</span>
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-xs text-blue-600 font-medium">Unit-Based</span>
                              </div>
                            </div>
                            <span className="text-sm text-gray-500">MK {item.unitPrice}</span>
                          </div>
                          <UnitBasedQuantityInput
                            product={item.product}
                            quantity={item.quantity}
                            onQuantityChange={(newQuantity) => handleUnitQuantityChange(index, newQuantity)}
                            onPriceChange={(newPrice) => handleUnitPriceChange(index, newPrice)}
                            onUnitQuantitiesChange={(unitQuantities) => handleUnitQuantitiesChange(index, unitQuantities)}
                            className="w-full"
                          />
                          {errors[`items.${index}.unitQuantities`] && (
                            <p className="text-red-500 text-xs mt-2">{errors[`items.${index}.unitQuantities`]}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              {errors.items && (
                <p className="text-red-500 text-xs mt-1">{errors.items}</p>
              )}
              
              <div className="flex justify-end mt-4">
                <div className="w-64">
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">MK {invoiceTotals.subtotal.toLocaleString()}</span>
                  </div>
                  {invoiceTotals.totalDiscountAmount > 0 && (
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-gray-600">Line Item Discounts:</span>
                      <span className="font-medium text-red-600">-MK {invoiceTotals.totalDiscountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Global Discount:</span>
                    <div className="flex items-center">
                      <span className="text-gray-500 text-sm mr-1">MK</span>
                      <input
                        type="number"
                        className="w-28 p-1 text-right border border-gray-200 rounded-md"
                        step="0.01"
                        min="0"
                        value={formData.discount || ''}
                        placeholder="0.00"
                        onChange={(e) => updateGlobalDiscount(e.target.value)}
                        title="Enter the global discount amount in MWK (applied to all items)"
                      />
                    </div>
                  </div>
                  {invoiceTotals.globalDiscount > 0 && (
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-gray-600">Applied Global Discount:</span>
                      <span className="font-medium text-red-600">-MK {invoiceTotals.globalDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">MK {invoiceTotals.taxAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 text-lg font-bold border-t border-gray-200 mt-2 pt-2">
                    <span>Total:</span>
                    <span>MK {invoiceTotals.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows="3"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add any additional notes or payment instructions"
              ></textarea>
            </div>
            
            <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm font-medium text-gray-700 mb-2">Footer overrides (optional)</p>
              <p className="text-xs text-gray-500 mb-2">Override the default phone and bank details shown in the document footer. Leave blank to use settings defaults.</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5" htmlFor="footerPhoneOverride">Footer phone</label>
                  <input
                    id="footerPhoneOverride"
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={formData.footerPhoneOverride || ""}
                    onChange={(e) => setFormData({ ...formData, footerPhoneOverride: e.target.value })}
                    placeholder="e.g. +265 1 234 567"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5" htmlFor="footerBankDetailsOverride">Footer bank details</label>
                  <textarea
                    id="footerBankDetailsOverride"
                    rows={2}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={formData.footerBankDetailsOverride || ""}
                    onChange={(e) => setFormData({ ...formData, footerBankDetailsOverride: e.target.value })}
                    placeholder="Bank name, account name, number, branch..."
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
                title={!isAccountSelectionValid ? "Fill required fields (client, items, income account)" : ""}
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⌛</span>
                    Saving...
                  </>
                ) : (
                  mode === "create" ? "Create Invoice" : "Update Invoice"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onClientCreated={handleClientCreated}
      />
      <InvoiceReceiptModal
        isOpen={showReceiptModal}
        invoice={createdInvoice}
        template={templates.find(t => t.id === (createdInvoice?.templateId || formData.templateId))}
        branding={{}}
        onClose={() => setShowReceiptModal(false)}
      />
    </div>
  );
};

export default InvoiceModal;
