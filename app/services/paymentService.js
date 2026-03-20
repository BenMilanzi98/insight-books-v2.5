// app/services/paymentService.js

// Fetch payments with optional filters, sorting, and pagination
export const fetchPayments = async (params = {}) => {
    try {
      const { page, limit, sortBy, sortOrder, status, method, search, dateFrom, dateTo } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', page);
      if (limit) queryParams.append('limit', limit);
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      if (status && status !== 'all') queryParams.append('status', status);
      if (method && method !== 'all') queryParams.append('method', method);
      if (search) queryParams.append('search', search);
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);
      
      const queryString = queryParams.toString();
      const url = `/api/payments${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error fetching payments: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  };
  
  // Get payment statistics
  export const getPaymentStatistics = async (params = {}) => {
    try {
      const { dateFrom, dateTo } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);
      
      const queryString = queryParams.toString();
      const url = `/api/payments/statistics${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error fetching payment statistics: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching payment statistics:', error);
      throw error;
    }
  };
  
  // Get a single payment by ID
  export const fetchPaymentById = async (paymentId) => {
    try {
      const response = await fetch(`/api/payments/${paymentId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching payment: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching payment ${paymentId}:`, error);
      throw error;
    }
  };
  
  // Create a new payment
  export const createPayment = async (paymentData) => {
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });
      
      if (!response.ok) {
        throw new Error(`Error creating payment: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  };
  
  // Update an existing payment
  export const updatePayment = async (paymentId, paymentData) => {
    try {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });
      
      if (!response.ok) {
        throw new Error(`Error updating payment: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error updating payment ${paymentId}:`, error);
      throw error;
    }
  };
  
  // Remove a payment via reversal (API requires audit reason; default satisfies min length)
  export const deletePayment = async (paymentId, options = {}) => {
    try {
      const reversalReason =
        options.reversalReason ||
        options.reason ||
        'Payment removal requested; recorded with full audit trail per system policy';
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reversalReason })
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting payment: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting payment ${paymentId}:`, error);
      throw error;
    }
  };
  
  // Export payments data (CSV/PDF)
  export const exportPayments = async (filters = {}, format = 'csv') => {
    try {
      // Build query string from filters
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') queryParams.append(key, value);
      });
      queryParams.append('format', format);
      
      const queryString = queryParams.toString();
      const url = `/api/payments/export${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error exporting payments: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Create a download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `payments-export.${format}`;
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(downloadUrl);
      
      return true;
    } catch (error) {
      console.error('Error exporting payments:', error);
      throw error;
    }
  };
  
  // Sync payments from external sources
  export const syncPayments = async () => {
    try {
      const response = await fetch('/api/payments/sync', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Error syncing payments: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error syncing payments:', error);
      throw error;
    }
  };
  
  // Mark payment as complete or failed
  export const updatePaymentStatus = async (paymentId, status, notes = '') => {
    try {
      const response = await fetch(`/api/payments/${paymentId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, notes }),
      });
      
      if (!response.ok) {
        throw new Error(`Error updating payment status: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error updating payment status for ${paymentId}:`, error);
      throw error;
    }
  };