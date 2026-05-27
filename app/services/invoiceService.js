// app/services/invoiceService.js
import { generateInvoicePdf } from '@/lib/jspdfUtils';
import { captureInvoiceAsPDF, saveInvoiceAsPDF } from '@/lib/invoiceCapture';
import { calculateInvoiceTotals } from '@/lib/invoiceTotals';
// Fetch invoices with optional filters, sorting, and pagination
export const fetchInvoices = async (params = {}) => {
  try {
    const { page, limit, sortBy, sortOrder, status, client, search, dateFrom, dateTo } = params;
    
    // Build query string from params
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);
    if (status) queryParams.append('status', status);
    if (client) queryParams.append('client', client);
    if (search) queryParams.append('search', search);
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);
    
    const queryString = queryParams.toString();
    const url = `/api/invoices${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching invoices: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};

// Get a single invoice by ID
export const getInvoiceById = async (invoiceId) => {
  try {
    const response = await fetch(`/api/invoices/${invoiceId}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching invoice: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching invoice ${invoiceId}:`, error);
    throw error;
  }
};

// Create a new invoice
export const createInvoice = async (invoiceData) => {
  try {
    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("🚀 INVOICE SERVICE ERROR:", response.status, response.statusText);
      console.error("🚀 INVOICE SERVICE ERROR BODY:", errorText);
      let message = `Error creating invoice: ${response.statusText}`;
      try {
        const body = JSON.parse(errorText);
        if (body?.error && typeof body.error === 'string') {
          message = body.error;
        }
        if (body?.details?.code === 'PERIOD_LOCKED') {
          message = body.error;
        }
      } catch (_) {}
      const err = new Error(message);
      err.code = response.status === 403 ? 'PERIOD_LOCKED' : undefined;
      throw err;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

// Update an existing invoice
export const updateInvoice = async (invoiceId, invoiceData) => {
  try {
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceData),
    });
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error || `Error updating invoice: ${response.statusText}`;
      throw new Error(message);
    }
    return data;
  } catch (error) {
    console.error(`Error updating invoice ${invoiceId}:`, error);
    throw error;
  }
};

// Delete an invoice
export const deleteInvoice = async (invoiceId) => {
  try {
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error deleting invoice: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error deleting invoice ${invoiceId}:`, error);
    throw error;
  }
};

// Send invoice to client
export const sendInvoice = async (invoiceId, templateId = null) => {
  try {
    // Include templateId if provided
    const queryParams = templateId ? `?templateId=${templateId}` : '';
    
    const response = await fetch(`/api/invoices/${invoiceId}/send${queryParams}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error sending invoice: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error sending invoice ${invoiceId}:`, error);
    throw error;
  }
};

export const downloadInvoice = async (invoiceId, templateId = null) => {
    try {
      // Include templateId if provided
      const queryParams = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
      
      const response = await fetch(`/api/invoices/${invoiceId}/download${queryParams}`);
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || response.statusText;
        } catch {
          errorMessage = response.statusText;
        }
        
        throw new Error(`Error downloading invoice: ${errorMessage}`);
      }
      
      // Get the invoice data from the response
      const data = await response.json();
      
      // Return the data to the component that will render and capture the invoice
      return data;
    } catch (error) {
      console.error(`Error downloading invoice ${invoiceId}:`, error);
      throw error;
    }
  };
  
  // New function to export rendered invoice as PDF
  export const exportRenderedInvoiceAsPDF = async (invoiceElementRef, filename) => {
    try {
      if (!invoiceElementRef.current) {
        throw new Error('Invoice element reference is not available');
      }
      
      // Use the invoiceCapture.js function to create PDF from the rendered template
      await captureInvoiceAsPDF(invoiceElementRef, filename);
      return true;
    } catch (error) {
      console.error('Error exporting invoice as PDF:', error);
      throw error;
    }
  };
  // New function to export rendered invoice as PDF
  export const saveRenderedInvoiceAsPDF = async (invoiceElementRef, filename) => {
    try {
      if (!invoiceElementRef.current) {
        throw new Error('Invoice element reference is not available');
      }
      
      // Use the invoiceCapture.js function to create PDF from the rendered template
      await saveInvoiceAsPDF(invoiceElementRef, filename);
      return true;
    } catch (error) {
      console.error('Error exporting invoice as PDF:', error);
      throw error;
    }
  };
// Mark invoice as paid
export const markAsPaid = async (invoiceId, paymentData) => {
  try {
    const response = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });
    
    if (!response.ok) {
      throw new Error(`Error marking invoice as paid: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error marking invoice ${invoiceId} as paid:`, error);
    throw error;
  }
};

// Get invoice statistics
export const getInvoiceStatistics = async (params = {}) => {
  try {
    const { dateFrom, dateTo } = params;
    
    // Build query string from params
    const queryParams = new URLSearchParams();
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);
    
    const queryString = queryParams.toString();
    const url = `/api/invoices/statistics${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching invoice statistics: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching invoice statistics:', error);
    throw error;
  }
};

// Export invoice data (CSV/PDF)
export const exportInvoices = async (filters = {}, format = 'csv') => {
  try {
    // Build query string from filters
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });
    queryParams.append('format', format);
    
    const queryString = queryParams.toString();
    const url = `/api/invoices/export${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error exporting invoices: ${response.statusText}`);
    }
    
    return response.blob();
  } catch (error) {
    console.error('Error exporting invoices:', error);
    throw error;
  }
};

// Calculate invoice calculations
export const calculateInvoice = (items = []) => {
  try {
    const totals = calculateInvoiceTotals(items);
    
    return {
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total
    };
  } catch (error) {
    console.error('Error calculating invoice:', error);
    return {
      subtotal: 0,
      taxAmount: 0,
      total: 0
    };
  }
};
