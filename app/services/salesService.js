// app/services/salesService.js - Complete Enhanced Version

// Fetch sales with optional filters, sorting, and pagination
export const fetchSales = async (params = {}) => {
  try {
    const { page, limit, sortBy, sortOrder, status, clientId, search, dateFrom, dateTo } = params;
    
    // Build query string from params
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);
    if (status && status !== 'all') queryParams.append('status', status);
    if (clientId && clientId !== 'all') queryParams.append('clientId', clientId);
    if (search) queryParams.append('search', search);
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);
    
    const queryString = queryParams.toString();
    const url = `/api/sales${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      const message = data?.error || response.statusText || 'Failed to fetch sales';
      throw new Error(message);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching sales:', error);
    throw error;
  }
};

// Get sales statistics
export const getSalesStatistics = async (params = {}) => {
  try {
    const { dateFrom, dateTo, period } = params;
    
    // Build query string from params
    const queryParams = new URLSearchParams();
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);
    if (period) queryParams.append('period', period);
    
    const queryString = queryParams.toString();
    const url = `/api/sales/statistics${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching sales statistics: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching sales statistics:', error);
    throw error;
  }
};

// Get a single sale by ID
export const fetchSaleById = async (saleId) => {
  try {
    const response = await fetch(`/api/sales/${saleId}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching sale: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching sale ${saleId}:`, error);
    throw error;
  }
};

// Enhanced create sale function to support new features
export const createSale = async (saleData) => {
  console.log('🚀 CREATE SALE FUNCTION CALLED');
  console.log('🚀 Sale data received:', JSON.stringify(saleData, null, 2));
  console.log('🚀 paymentAllocations in saleData:', saleData.paymentAllocations);
  console.log('🚀 paymentMethod in saleData:', saleData.paymentMethod);
  
  try {
    // Validate required fields
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Sale must contain at least one item');
    }

    // Enhanced payload to support custom products, individual taxes, and discounts
    console.log('=== SALES SERVICE DEBUG ===');
    console.log('Sale data items:', saleData.items);
    console.log('First item unitQuantities:', saleData.items[0]?.unitQuantities);
    console.log('==========================');
    
    const payload = {
      clientId: saleData.clientId || null,
      branchId: saleData.branchId || null,
      items: saleData.items.map(item => ({
        productId: item.isCustom ? null : (item.productId || null),
        description: String(item.description),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate || 0),
        taxAmount: Number(item.taxAmount || 0),
        taxDescription: String(item.taxDescription || ''),
        discount: Number(item.discount || 0),
        discountAmount: Number(item.discountAmount || 0),
        isCustom: Boolean(item.isCustom || false),
        customProductData: item.isCustom ? {
          name: String(item.description),
          price: Number(item.unitPrice),
          description: String(item.description)
        } : null,
        // Include tax breakdown for detailed tax tracking per tax type
        taxBreakdown: item.taxBreakdown || [],
        // Include accountId for Chart of Accounts requirement
        accountId: item.accountId || null,
        // Include unit quantities for unit-managed products
        unitQuantities: item.unitQuantities || null
      })),
      subtotal: Number(saleData.subtotal || 0),
      totalTaxAmount: Number(saleData.totalTaxAmount || 0),
      totalDiscountAmount: Number(saleData.totalDiscountAmount || 0),
      globalDiscount: Number(saleData.globalDiscount || 0),
      total: Number(saleData.total || 0),
      // Only include paymentMethod if paymentAllocations is not present (legacy support)
      ...(saleData.paymentAllocations && saleData.paymentAllocations.length > 0 
        ? {} 
        : { paymentMethod: String(saleData.paymentMethod || 'cash') }),
      // Always include paymentAllocations if present
      ...(saleData.paymentAllocations && saleData.paymentAllocations.length > 0 
        ? { paymentAllocations: saleData.paymentAllocations }
        : {}),
      notes: String(saleData.notes || ''),
      status: String(saleData.status || 'completed'),
      // Historical transaction fields
      isHistorical: Boolean(saleData.isHistorical || false),
      historicalDate: saleData.historicalDate || null,
      migrationBatch: saleData.migrationBatch || null,
      originalReference: saleData.originalReference || null
    };

    console.log('Sending sale payload:', JSON.stringify(payload, null, 2));

    console.log('🚀 FRONTEND: Making API call to /api/sales');
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    console.log('🚀 FRONTEND: API response status:', response.status);
    console.log('🚀 FRONTEND: API response ok:', response.ok);
    
    if (!response.ok) {
      // Get detailed error message
      let errorMessage = `Error creating sale: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
        if (errorData.details) {
          errorMessage += ` - ${errorData.details}`;
        }
        console.error('Sale creation error details:', errorData);
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating sale:', error);
    throw error;
  }
};

// Update an existing sale
export const updateSale = async (saleId, saleData) => {
  try {
    const response = await fetch(`/api/sales/${saleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(saleData),
    });
    
    if (!response.ok) {
      throw new Error(`Error updating sale: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error updating sale ${saleId}:`, error);
    throw error;
  }
};

// Delete a sale (for drafts only)
export const deleteSale = async (saleId) => {
  try {
    const response = await fetch(`/api/sales/${saleId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Error deleting sale: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error deleting sale ${saleId}:`, error);
    throw error;
  }
};

// Enhanced void sale function with inventory restoration
export const voidSale = async (saleId, reason) => {
  try {
    const response = await fetch(`/api/sales/${saleId}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: reason || 'Sale voided'
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Error voiding sale: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error voiding sale ${saleId}:`, error);
    throw error;
  }
};

// Enhanced refund sale function with inventory restoration
export const refundSale = async (saleId, reason, refundMethod = null) => {
  try {
    const response = await fetch(`/api/sales/${saleId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: reason || 'Sale refunded',
        ...(refundMethod && { refundMethod })
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Error refunding sale: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error refunding sale ${saleId}:`, error);
    throw error;
  }
};

// Print receipt (PDF from server; HTML is only returned without ?format=pdf)
export const printReceipt = async (saleId) => {
  try {
    const response = await fetch(
      `/api/sales/${saleId}/receipt?format=pdf`,
      {
        method: 'GET'
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error generating receipt: ${response.statusText}`);
    }

    const ct = (response.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      throw new Error('Receipt API returned JSON instead of a PDF.');
    }

    const blob = await response.blob();
    const blobType = (blob.type || '').toLowerCase();
    if (blobType.includes('text/html')) {
      throw new Error(
        'Receipt was returned as HTML instead of PDF. Ensure the server can generate PDFs (format=pdf).'
      );
    }

    const url = window.URL.createObjectURL(blob);
    
    // Open a new window/tab with the receipt
    const receiptWindow = window.open(url, '_blank');
    if (!receiptWindow) {
      // If popup is blocked, create a download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${saleId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    }
    
    return true;
  } catch (error) {
    console.error(`Error printing receipt for sale ${saleId}:`, error);
    throw error;
  }
};

// Export sales data (CSV or PDF)
export const exportSales = async (filters = {}, format = 'csv') => {
  try {
    // Build query string from filters
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') queryParams.append(key, value);
    });
    queryParams.append('format', format);
    
    const queryString = queryParams.toString();
    const url = `/api/sales/export${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error exporting sales: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    
    // Create a download link
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `sales-export.${format}`;
    link.click();
    
    // Clean up
    window.URL.revokeObjectURL(downloadUrl);
    
    return true;
  } catch (error) {
    console.error('Error exporting sales:', error);
    throw error;
  }
};

// Fetch products for sale
export const fetchProductsForSale = async (params = {}) => {
  try {
    const { search, category, limit, page } = params;
    
    // Build query string from params
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (category && category !== 'all') queryParams.append('category', category);
    if (limit) queryParams.append('limit', limit);
    if (page) queryParams.append('page', page);
    
    const queryString = queryParams.toString();
    const url = `/api/stock${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching products: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.products || [];
  } catch (error) {
    console.error('Error fetching products for sale:', error);
    throw error;
  }
};

// Fetch one page of products for sale and return pagination metadata
export const fetchProductsForSalePage = async (params = {}) => {
  try {
    const { search, category, limit = 50, page = 1 } = params;
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (category && category !== 'all') queryParams.append('category', category);
    if (limit) queryParams.append('limit', limit);
    if (page) queryParams.append('page', page);

    const url = `/api/stock?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching products page: ${response.statusText}`);
    }
    const data = await response.json();
    return {
      products: data.products || [],
      pagination: data.pagination || { page, limit, totalCount: 0, totalPages: 0 }
    };
  } catch (error) {
    console.error('Error fetching products page for sale:', error);
    throw error;
  }
};

// Fetch all products for sale across pages (server-backed, de-duplicated)
export const fetchProductsForSaleAll = async (params = {}) => {
  try {
    const { search, category, pageSize = 100, maxPages = 50 } = params;

    const allProducts = [];
    const seenIds = new Set();

    for (let page = 1; page <= maxPages; page++) {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (category && category !== 'all') queryParams.append('category', category);
      queryParams.append('limit', pageSize);
      queryParams.append('page', String(page));

      const url = `/api/stock?${queryParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error fetching products (page ${page}): ${response.statusText}`);
      }

      const data = await response.json();
      const products = Array.isArray(data.products) ? data.products : [];

      for (const product of products) {
        if (product && !seenIds.has(product.id)) {
          seenIds.add(product.id);
          allProducts.push(product);
        }
      }

      const pagination = data.pagination || {};
      if (!pagination.totalPages || page >= pagination.totalPages) {
        break;
      }
    }

    return allProducts;
  } catch (error) {
    console.error('Error fetching all products for sale:', error);
    throw error;
  }
};

// Fetch clients for sale
export const fetchClients = async (params = {}) => {
  try {
    const { search, limit } = params;
    
    // Build query string from params
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (limit) queryParams.append('limit', limit);
    
    const queryString = queryParams.toString();
    const url = `/api/clients${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching clients: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.clients || [];
  } catch (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }
};

// Create a new client
export const createClient = async (clientData) => {
  try {
    // Make sure required fields are present
    if (!clientData.name) {
      throw new Error('Client name is required');
    }
    
    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    });
    
    if (!response.ok) {
      // Try to extract error message from response if possible
      let errorMessage = `Error creating client: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // If JSON parsing fails, use the default error message
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Return the newly created client object
    return data.client || data;
  } catch (error) {
    console.error('Error creating client:', error);
    throw error;
  }
};

// NEW ENHANCED FUNCTIONS

// Create custom product (if you want to save custom products for future use)
export const createCustomProduct = async (productData) => {
  try {
    const response = await fetch('/api/products/custom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: productData.name,
        description: productData.description,
        price: productData.price,
        isService: true, // Custom products are typically services
        category: 'Custom Items'
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Error creating custom product: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating custom product:', error);
    throw error;
  }
};

// Get sale details with items (enhanced version)
export const getSaleDetails = async (saleId) => {
  try {
    const response = await fetch(`/api/sales/${saleId}/details`);
    
    if (!response.ok) {
      throw new Error(`Error fetching sale details: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching sale details ${saleId}:`, error);
    throw error;
  }
};

// Get sale history for a specific sale
export const getSaleHistory = async (saleId) => {
  try {
    const response = await fetch(`/api/sales/${saleId}/history`);
    
    if (!response.ok) {
      throw new Error(`Error fetching sale history: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching sale history ${saleId}:`, error);
    throw error;
  }
};

// Update inventory after void/refund
export const adjustInventory = async (adjustments) => {
  try {
    const response = await fetch('/api/stock/adjust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adjustments }),
    });
    
    if (!response.ok) {
      throw new Error(`Error adjusting inventory: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    throw error;
  }
};

// Get inventory adjustment history
export const getInventoryAdjustments = async (productId) => {
  try {
    const response = await fetch(`/api/stock/adjustments?productId=${productId}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching inventory adjustments: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching inventory adjustments:', error);
    throw error;
  }
};

// Validate sale before processing
export const validateSale = async (saleData) => {
  try {
    const response = await fetch('/api/sales/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(saleData),
    });
    
    if (!response.ok) {
      throw new Error(`Error validating sale: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error validating sale:', error);
    throw error;
  }
};

// Get tax configurations for the tenant
export const getTaxConfigurations = async () => {
  try {
    const response = await fetch('/api/settings/tax-configurations');
    
    if (!response.ok) {
      throw new Error(`Error fetching tax configurations: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching tax configurations:', error);
    throw error;
  }
};

// Search products with advanced filters
export const searchProducts = async (searchParams) => {
  try {
    const queryParams = new URLSearchParams(searchParams);
    const response = await fetch(`/api/products/search?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Error searching products: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching products:', error);
    throw error;
  }
};

// Get sales report with filters
export const getSalesReport = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams(filters);
    const response = await fetch(`/api/sales/report?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching sales report: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching sales report:', error);
    throw error;
  }
};

// Bulk update sale items (for editing completed sales if permitted)
export const updateSaleItems = async (saleId, items) => {
  try {
    const response = await fetch(`/api/sales/${saleId}/items`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });
    
    if (!response.ok) {
      throw new Error(`Error updating sale items: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error updating sale items ${saleId}:`, error);
    throw error;
  }
};

// Get payment method statistics
export const getPaymentMethodStats = async (dateRange = {}) => {
  try {
    const queryParams = new URLSearchParams(dateRange);
    const response = await fetch(`/api/sales/payment-methods/stats?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching payment method stats: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching payment method stats:', error);
    throw error;
  }
};

// Get void/refund permissions for current user
export const getSalePermissions = async () => {
  try {
    const response = await fetch('/api/sales/permissions');
    
    if (!response.ok) {
      throw new Error(`Error fetching sale permissions: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching sale permissions:', error);
    throw error;
  }
};

// Get audit trail for a sale
export const getSaleAuditTrail = async (saleId) => {
  try {
    const response = await fetch(`/api/sales/${saleId}/audit-trail`);
    
    if (!response.ok) {
      throw new Error(`Error fetching sale audit trail: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching sale audit trail ${saleId}:`, error);
    throw error;
  }
};

// Batch operations for bulk actions
export const batchVoidSales = async (saleIds, reason) => {
  try {
    const response = await fetch('/api/sales/batch/void', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ saleIds, reason }),
    });
    
    if (!response.ok) {
      throw new Error(`Error batch voiding sales: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error batch voiding sales:', error);
    throw error;
  }
};

export const batchRefundSales = async (saleIds, reason) => {
  try {
    const response = await fetch('/api/sales/batch/refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ saleIds, reason }),
    });
    
    if (!response.ok) {
      throw new Error(`Error batch refunding sales: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error batch refunding sales:', error);
    throw error;
  }
};

// Real-time inventory check
export const checkInventoryAvailability = async (productId, quantity) => {
  try {
    const response = await fetch(`/api/products/${productId}/availability?quantity=${quantity}`);
    
    if (!response.ok) {
      throw new Error(`Error checking inventory availability: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking inventory availability:', error);
    throw error;
  }
};

// Get similar products (for suggestions)
export const getSimilarProducts = async (productId) => {
  try {
    const response = await fetch(`/api/products/${productId}/similar`);
    
    if (!response.ok) {
      throw new Error(`Error fetching similar products: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching similar products:', error);
    throw error;
  }
};

// Save draft sale (auto-save functionality)
export const saveDraftSale = async (draftData) => {
  try {
    const response = await fetch('/api/sales/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(draftData),
    });
    
    if (!response.ok) {
      throw new Error(`Error saving draft sale: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error saving draft sale:', error);
    throw error;
  }
};

// Load draft sales
export const loadDraftSales = async () => {
  try {
    const response = await fetch('/api/sales/drafts');
    
    if (!response.ok) {
      throw new Error(`Error loading draft sales: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading draft sales:', error);
    throw error;
  }
};

// Delete draft sale
export const deleteDraftSale = async (draftId) => {
  try {
    const response = await fetch(`/api/sales/drafts/${draftId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Error deleting draft sale: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error deleting draft sale ${draftId}:`, error);
    throw error;
  }
};

// UTILITY FUNCTIONS

// Calculate sale totals (for preview before saving)
export const calculateSaleTotals = (items) => {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalTaxAmount = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  const totalDiscountAmount = items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  const total = subtotal + totalTaxAmount - totalDiscountAmount;

  return {
    subtotal,
    totalTaxAmount,
    totalDiscountAmount,
    total
  };
};

// Helper function to format currency
export const formatCurrency = (amount, currencyCode = 'MWK') => {
  const currencySymbols = {
    'MWK': 'MK',
    'USD': '$',
    'EUR': '€',
    'GBP': '£'
  };

  const symbol = currencySymbols[currencyCode] || currencyCode;
  
  return `${symbol} ${typeof amount === 'number' 
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount}`;
};

// Helper function to validate product data
export const validateProductData = (product) => {
  const errors = [];

  if (!product.name || product.name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (!product.price || product.price <= 0) {
    errors.push('Product price must be greater than 0');
  }

  if (product.quantity && product.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  if (product.taxRate && (product.taxRate < 0 || product.taxRate > 100)) {
    errors.push('Tax rate must be between 0 and 100');
  }

  if (product.discount && product.discount < 0) {
    errors.push('Discount must be a positive amount');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Helper function to calculate item totals
export const calculateItemTotals = (item) => {
  const subtotal = item.quantity * item.unitPrice;
  const taxAmount = subtotal * ((item.taxRate || 0) / 100);
  const discountAmount = item.discount || 0; // Direct amount, not percentage
  const total = subtotal + taxAmount - discountAmount;

  return {
    subtotal,
    taxAmount,
    discountAmount,
    total
  };
};

// Default export object with all functions organized
export default {
  // Core sales functions
  fetchSales,
  createSale,
  updateSale,
  deleteSale,
  fetchSaleById,
  getSaleDetails,
  getSalesStatistics,
  
  // Product and client functions
  fetchProductsForSale,
  fetchClients,
  createClient,
  searchProducts,
  
  // Void/refund functions
  voidSale,
  refundSale,
  batchVoidSales,
  batchRefundSales,
  
  // Inventory functions
  adjustInventory,
  getInventoryAdjustments,
  checkInventoryAvailability,
  
  // Custom product functions
  createCustomProduct,
  getSimilarProducts,
  
  // Draft functions
  saveDraftSale,
  loadDraftSales,
  deleteDraftSale,
  
  // Reporting and export
  getSalesReport,
  exportSales,
  getPaymentMethodStats,
  
  // Utility functions
  calculateSaleTotals,
  calculateItemTotals,
  validateProductData,
  formatCurrency,
  
  // Audit and permissions
  getSaleHistory,
  getSaleAuditTrail,
  getSalePermissions,
  
  // Settings and configuration
  getTaxConfigurations,
  validateSale,
  
  // Receipt and printing
  printReceipt
};