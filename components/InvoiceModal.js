"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, ChevronDown, Info, Search, Loader, Package, Tag, Edit2, Check, XCircle } from "lucide-react";
import { calculateTax, calculateSubtotal, calculateTotal } from "@/lib/invoiceCalculations";
import ClientModal from "./ClientModal";
import ClientSearchCombobox from "./ClientSearchCombobox";
import InvoiceReceiptModal from "./InvoiceReceiptModal";
import UnitBasedQuantityInput from "./UnitBasedQuantityInput";
import { fetchProductsForSaleAll } from "@/app/services/salesService";

// Enhanced calculation functions with per-item discount support
const calculateItemTotals = (item) => {
  const quantity = parseFloat(item.quantity) || 0;
  const unitPrice = parseFloat(item.unitPrice) || 0;
  const perItemDiscount = parseFloat(item.discountAmount) || 0; // Discount per individual item
  
  // Debug logging removed for production
  
  const lineTotal = quantity * unitPrice;
  const totalDiscountAmount = quantity * perItemDiscount; // Total discount = per-item discount × quantity
  const netAmount = lineTotal - totalDiscountAmount;
  const taxAmount = netAmount * ((item.taxRate || 0) / 100);
  const finalAmount = netAmount + taxAmount;
  
  return {
    lineTotal: Number(lineTotal.toFixed(2)),
    discountAmount: Number(totalDiscountAmount.toFixed(2)), // Total discount for the line
    perItemDiscount: Number(perItemDiscount.toFixed(2)), // Per-item discount amount
    netAmount: Number(netAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    amount: Number(finalAmount.toFixed(2))
  };
};

const calculateInvoiceTotals = (items, globalDiscount = 0) => {
  let subtotal = 0;
  let totalDiscountAmount = 0;
  let taxAmount = 0;
  
  items.forEach(item => {
    const calculations = calculateItemTotals(item);
    subtotal += calculations.lineTotal;
    totalDiscountAmount += calculations.discountAmount;
    taxAmount += calculations.taxAmount;
  });
  
  // Apply global discount to the net subtotal (after line item discounts)
  const netSubtotalBeforeGlobal = subtotal - totalDiscountAmount;
  const validGlobalDiscount = Math.max(0, Math.min(globalDiscount || 0, netSubtotalBeforeGlobal));
  const finalNetSubtotal = netSubtotalBeforeGlobal - validGlobalDiscount;
  const total = finalNetSubtotal + taxAmount;
  
  return {
    subtotal: Number(subtotal.toFixed(2)),
    totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
    globalDiscount: Number(validGlobalDiscount.toFixed(2)),
    netSubtotal: Number(finalNetSubtotal.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    total: Number(total.toFixed(2))
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
  // Fixed revenue account for invoice items (4000 - Revenue only, not changeable)
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
  const [newTaxData, setNewTaxData] = useState({ name: '', taxRate: 16.5, calculationType: 'Percentage', description: '' });
  
  // Unit management state
  const [unitQuantities, setUnitQuantities] = useState({}); // Store unit quantities for each item
  
  // Refs for product search dropdown
  const productSearchRef = useRef(null);
  
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
    
    // Update the item's quantity and unit price based on unit quantities
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
          totalPrice += qty * parseFloat(unit.unitPrice || 0);
        }
      });
      
      // Calculate average unit price (total price / total quantity)
      const averageUnitPrice = totalBaseQuantity > 0 ? totalPrice / totalBaseQuantity : 0;
      
      // Update the item with calculated values
      const updatedItems = [...formData.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        quantity: totalBaseQuantity,
        unitPrice: averageUnitPrice // Use average unit price, not total price
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
        items: invoice.items?.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate || "0",
          productId: item.productId,
          discountAmount: item.discountAmount || 0,
          accountId: item.accountId || revenueAccount?.id || ""
        })) || [{ 
          description: "", 
          quantity: "", 
          unitPrice: "", 
          taxRate: "0",
          discountAmount: "",
          accountId: revenueAccount?.id || ""
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
  
  // When revenue account (4000 - Revenue) is set, ensure all items use it
  useEffect(() => {
    if (revenueAccount?.id && formData.items.some(item => item.accountId !== revenueAccount.id)) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => ({ ...item, accountId: revenueAccount.id }))
      }));
    }
  }, [revenueAccount?.id]);

  // Auto-populate default tax (inflow) on initial item when creating a new invoice
  useEffect(() => {
    if (mode === "edit" || !defaultTaxTypeForInflow) return;
    if (formData.items.length !== 1) return;
    const first = formData.items[0];
    if (first.selectedTaxTypeId) return;
    setFormData(prev => ({
      ...prev,
      items: [{
        ...prev.items[0],
        taxRate: String(defaultTaxTypeForInflow.taxRate ?? 0),
        selectedTaxTypeId: defaultTaxTypeForInflow.id,
        productTaxes: [defaultTaxTypeForInflow]
      }]
    }));
  }, [defaultTaxTypeForInflow?.id, mode]);

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

        // Use the lightweight income accounts endpoint; we only use 4000 - Revenue (fixed, not changeable)
        const accountsResponse = await fetch('/api/chart-of-accounts/income-accounts');
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          const accounts = accountsData.accounts || [];
          const revenueOnly = accounts.find(a => String(a.accountCode || '').trim() === '4000') || accounts[0] || null;
          setRevenueAccount(revenueOnly);
          setIncomeAccounts(revenueOnly ? [revenueOnly] : []);
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
          if (taxTypesResponse.ok) {
            const taxTypesData = await taxTypesResponse.json();
            setTaxTypes(taxTypesData.taxTypes || taxTypesData || []);
          }
          if (taxDefaultsResponse?.ok) {
            const defaults = await taxDefaultsResponse.json();
            setDefaultTaxTypeForInflow(defaults.defaultTaxTypeForInflow || null);
          }
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

  // NEW: Handle tax type selection for an item
  const handleTaxTypeChange = (index, taxTypeId) => {
    const updatedItems = [...formData.items];
    
    if (!taxTypeId || taxTypeId === '') {
      // Clear tax if empty selection
      updatedItems[index] = {
        ...updatedItems[index],
        taxRate: 0,
        selectedTaxTypeId: '',
        productTaxes: []
      };
    } else {
      const selectedTax = taxTypes.find(t => t.id === taxTypeId);
      if (selectedTax) {
        updatedItems[index] = {
          ...updatedItems[index],
          taxRate: selectedTax.taxRate || 0,
          selectedTaxTypeId: taxTypeId,
          productTaxes: [selectedTax]
        };
      }
    }
    
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
        setNewTaxData({ name: '', taxRate: 16.5, calculationType: 'Percentage', description: '' });
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
    console.log(`Product selected: ${product.name} (ID: ${product.id}) for item ${index}`);
    
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
        console.log("Full product data with units:", productData);
      }
      
      if (taxesResponse.ok) {
        const taxesData = await taxesResponse.json();
        productTaxes = taxesData.taxes || [];
        console.log("Product taxes from API:", productTaxes);
      }
      
      // If taxes API returned empty, try to get taxes from product data
      if (productTaxes.length === 0 && productData.taxes && productData.taxes.length > 0) {
        productTaxes = productData.taxes;
        console.log("Product taxes from product data:", productTaxes);
      }
      
      // If still no taxes, try productTaxes array from product data
      if (productTaxes.length === 0 && productData.productTaxes && productData.productTaxes.length > 0) {
        productTaxes = productData.productTaxes.map(pt => pt.taxType || pt).filter(Boolean);
        console.log("Product taxes from productTaxes array:", productTaxes);
      }
      
      // Calculate combined tax rate from all taxes (for backward compatibility with single taxRate field)
      let combinedTaxRate = 0;
      if (productTaxes.length > 0) {
        // Sum all percentage taxes
        combinedTaxRate = productTaxes
          .filter(tax => {
            const calcType = tax.calculationType || (tax.taxType?.calculationType);
            return calcType === 'Percentage' || !calcType; // Default to percentage if not specified
          })
          .reduce((sum, tax) => {
            const rate = tax.taxRate || tax.taxType?.taxRate || 0;
            return sum + rate;
          }, 0);
      } else if (productData.taxRate !== undefined && productData.taxRate !== null) {
        // Fallback to product's taxRate field
        combinedTaxRate = productData.taxRate;
      }
      
      const updatedItems = [...formData.items];
      updatedItems[index] = {
        ...updatedItems[index],
        description: productData.name, // Set description from product name
        unitPrice: productData.price || productData.unitPrice || "",
        productId: productData.id,
        // Use combined tax rate from all taxes, or fallback to product's taxRate
        taxRate: combinedTaxRate,
        // Store full product data including units and taxes
        product: productData,
        productTaxes: productTaxes // Store all taxes for display
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
    
    console.log(`Updated item ${index} with product: ${product.name}`);
  };
  
  // Enhanced update discount function for global discount
  const updateGlobalDiscount = (discountValue) => {
    const discount = parseFloat(discountValue) || "";
    setFormData({ ...formData, discount });
  };
  
  // Add a new item (income account fixed to 4000 - Revenue); auto-apply default tax inflow
  const addItem = () => {
    const defaultTax = defaultTaxTypeForInflow;
    const newItem = {
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: defaultTax ? String(defaultTax.taxRate ?? 0) : "0",
      discountAmount: "",
      accountId: revenueAccount?.id || "",
      productTaxes: defaultTax ? [defaultTax] : [],
      selectedTaxTypeId: defaultTax?.id ?? ""
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
        newErrors[`items.${index}.unitPrice`] = "Unit price is required";
      }
      
      // Tax is now optional with dropdown - users can select "No Tax"
      // if (item.taxRate === "") {
      //   newErrors[`items.${index}.taxRate"] = "Tax rate is required";
      // }

      if (!item.accountId) {
        newErrors[`items.${index}.accountId`] = "Income account is required";
      }
      
      // Validate that per-item discount doesn't exceed unit price (only if discount is provided)
      if (item.discountAmount && item.discountAmount !== "") {
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const perItemDiscount = parseFloat(item.discountAmount) || 0;
        if (perItemDiscount > unitPrice) {
          newErrors[`items.${index}.discountAmount`] = "Per-item discount cannot exceed unit price";
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
                console.log(`Unit ${unit.symbol}: ${qty} = ${convertedToBase.toFixed(6)} base units`);
              }
            });
            finalQuantity = totalBaseQuantity;
            console.log(`Total calculated quantity for ${item.description}: ${finalQuantity.toFixed(6)}`);
          }
          
          return {
            ...item,
            description: item.description || "",
            quantity: finalQuantity,
            unitPrice: parseFloat(item.unitPrice) || 0,
            taxRate: parseFloat(item.taxRate) || 0,
            discountAmount: parseFloat(item.discountAmount) || 0,
            accountId: item.accountId || revenueAccount?.id || "",
            selectedTaxTypeId: item.selectedTaxTypeId || '',
            productTaxes: item.productTaxes || [],
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
                                  console.log(`Search input changed to: "${value}"`);
                                  
                                  if (item.productId) {
                                    // If a product is selected, clear it to allow custom description
                                    console.log(`Clearing productId for item ${index}`);
                                    handleItemChange(index, "productId", "");
                                  }
                                  handleItemChange(index, "description", value);
                                  setItemSearchQueries(prev => ({ ...prev, [index]: value }));
                                  setActiveSearchIndex(index);
                                // Always show dropdown when typing (true combobox behavior)
                                setShowProductDropdown(true);
                                }}
                                onFocus={() => {
                                  console.log(`Search input focused for item ${index}`);
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

                            {/* Revenue account fixed to 4000 - Revenue; hidden to reduce UI confusion */}
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
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="relative">
                              <select
                                className={`w-24 p-2 border rounded-md text-sm ${errors[`items.${index}.taxRate`] ? 'border-red-500' : 'border-gray-300'}`}
                                value={item.selectedTaxTypeId || ''}
                                onChange={(e) => handleTaxTypeChange(index, e.target.value)}
                                title="Select a tax type for this item"
                              >
                                <option value="">No Tax</option>
                                {isLoadingTaxTypes ? (
                                  <option value="" disabled>Loading...</option>
                                ) : (
                                  taxTypes.map(tax => (
                                    <option key={tax.id} value={tax.id}>
                                      {tax.taxRate ? `${tax.taxName || tax.taxId} (${tax.taxRate}%)` : (tax.taxName || tax.taxId)}
                                    </option>
                                  ))
                                )}
                              </select>
                              <button
                                type="button"
                                className="ml-1 text-blue-600 hover:text-blue-800 text-xs"
                                onClick={() => setShowNewTaxForm(!showNewTaxForm)}
                                title="Add new tax type"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            
                            {/* NEW TAX FORM */}
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
                                        setNewTaxData({ name: '', taxRate: 16.5, calculationType: 'Percentage', description: '' });
                                      }}
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Display applied taxes */}
                            {item.productTaxes && item.productTaxes.length > 0 && (
                              <div className="mt-1 text-xs text-gray-600">
                                <div className="font-medium mb-0.5">Applied:</div>
                                {item.productTaxes.map((tax, taxIdx) => (
                                  <div key={taxIdx} className="text-xs">
                                    {tax.taxName || tax.taxId || tax.name}: {tax.taxRate}%
                                    {tax.calculationType === 'Fixed' && ' (Fixed)'}
                                  </div>
                                ))}
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
          </form>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            disabled={loading || !isAccountSelectionValid}
            title={!isAccountSelectionValid ? "Select an income account for each item" : ""}
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