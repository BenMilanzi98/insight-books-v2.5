// app/services/quotationService.js
import { captureInvoiceAsPDF, saveInvoiceAsPDF } from '@/lib/invoiceCapture';

// Fetch quotations with optional filters, sorting, and pagination
export const fetchQuotations = async (params = {}) => {
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
      const url = `/api/quotations${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || response.statusText;
        throw new Error(`Error fetching quotations: ${errorMessage}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching quotations:', error);
      throw error;
    }
  };
  
  // Get a single quotation by ID
  export const fetchQuotationById = async (quotationId) => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching quotation: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching quotation ${quotationId}:`, error);
      throw error;
    }
  };
  
  // Create a new quotation
  export const createQuotation = async (quotationData) => {
    try {
      const response = await fetch('/api/quotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quotationData),
      });
      
      if (!response.ok) {
        throw new Error(`Error creating quotation: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating quotation:', error);
      throw error;
    }
  };
  
  // Update an existing quotation
  export const updateQuotation = async (quotationId, quotationData) => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quotationData),
      });
      
      if (!response.ok) {
        throw new Error(`Error updating quotation: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error updating quotation ${quotationId}:`, error);
      throw error;
    }
  };
  
  // Delete a quotation
  export const deleteQuotation = async (quotationId) => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting quotation: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting quotation ${quotationId}:`, error);
      throw error;
    }
  };
  
  // Send quotation to client
  export const sendQuotation = async (quotationId) => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}/send`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Error sending quotation: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error sending quotation ${quotationId}:`, error);
      throw error;
    }
  };
  
  // Convert quotation to invoice
  export const convertToInvoice = async (quotationId, invoiceData = {}) => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      });
      
      if (!response.ok) {
        throw new Error(`Error converting quotation to invoice: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error converting quotation ${quotationId} to invoice:`, error);
      throw error;
    }
  };
  
  // Download quotation as PDF
  export const downloadQuotation = async (quotationId, templateId = null) => {
    try {
      // Include templateId if provided
      const queryParams = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
      
      const response = await fetch(`/api/quotations/${quotationId}/download${queryParams}`);
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || response.statusText;
        } catch {
          errorMessage = response.statusText;
        }
        
        throw new Error(`Error downloading quotation: ${errorMessage}`);
      }
      
      // Get the quotation data from the response
      const data = await response.json();
      
      // Return the data to the component that will render and capture the quotation
      return data;
    } catch (error) {
      console.error(`Error downloading quotation ${quotationId}:`, error);
      throw error;
    }
  };
  
  // New function to export rendered quotation as PDF
  export const exportRenderedQuotationAsPDF = async (quotationElementRef, filename) => {
    try {
      if (!quotationElementRef.current) {
        throw new Error('Quotation element reference is not available');
      }
      
      // Use the invoiceCapture.js function to create PDF from the rendered template
      await captureInvoiceAsPDF(quotationElementRef, filename);
      return true;
    } catch (error) {
      console.error('Error exporting quotation as PDF:', error);
      throw error;
    }
  };
  
  // New function to save rendered quotation as PDF
  export const saveRenderedQuotationAsPDF = async (quotationElementRef, filename) => {
    try {
      if (!quotationElementRef.current) {
        throw new Error('Quotation element reference is not available');
      }
      
      // Use the invoiceCapture.js function to create PDF from the rendered template
      await saveInvoiceAsPDF(quotationElementRef, filename);
      return true;
    } catch (error) {
      console.error('Error saving quotation as PDF:', error);
      throw error;
    }
  };
  
  // Get quotation statistics
  export const getQuotationStatistics = async (params = {}) => {
    try {
      const { dateFrom, dateTo } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);
      
      const queryString = queryParams.toString();
      const url = `/api/quotations/statistics${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error fetching quotation statistics: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching quotation statistics:', error);
      throw error;
    }
  };
  
  // Export quotations data (CSV/PDF)
  export const exportQuotations = async (filters = {}, format = 'csv') => {
    try {
      // Build query string from filters
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') queryParams.append(key, value);
      });
      queryParams.append('format', format);
      
      const queryString = queryParams.toString();
      const url = `/api/quotations/export${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error exporting quotations: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Create a link element
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `quotations-export.${format}`;
      
      // Append the link to the body
      document.body.appendChild(link);
      
      // Click the link to trigger the download
      link.click();
      
      // Remove the link from the body
      document.body.removeChild(link);
      
      // Release the URL object
      window.URL.revokeObjectURL(downloadUrl);
      
      return true;
    } catch (error) {
      console.error('Error exporting quotations:', error);
      throw error;
    }
  };
  
  // Duplicate a quotation
  export const duplicateQuotation = async (quotationId) => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}/duplicate`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Error duplicating quotation: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error duplicating quotation ${quotationId}:`, error);
      throw error;
    }
  };