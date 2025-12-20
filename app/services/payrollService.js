// app/services/payrollService.js
/**
 * Fetch payrolls with optional filters, sorting, andecondary
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Payroll data
 */
export const fetchPayrolls = async (params = {}) => {
  try {
    const { page, limit, sortBy, sortOrder, status, employeeId, search, fromDate, toDate } = params;
    
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);
    if (status && status !== 'all') queryParams.append('status', status);
    if (employeeId && employeeId !== 'all') queryParams.append('employeeId', employeeId);
    if (search) queryParams.append('search', search);
    if (fromDate) queryParams.append('fromDate', fromDate);
    if (toDate) queryParams.append('toDate', toDate);
    
    const queryString = queryParams.toString();
    const url = `/api/payroll${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, { credentials: 'include' });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error fetching payrolls: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching payrolls:', error);
    throw error;
  }
};

/**
 * Get a single payroll by ID
 * @param {string} payrollId - Payroll ID
 * @returns {Promise<Object>} Payroll data
 */
export const fetchPayrollById = async (payrollId) => {
  try {
    const response = await fetch(`/api/payroll/${payrollId}`, { credentials: 'include' });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error fetching payroll: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching payroll ${payrollId}:`, error);
    throw error;
  }
};

/**
 * Fetch payslip data for a payroll
 * @param {string} payrollId - Payroll ID
 * @returns {Promise<Object>} Payslip data
 */
export const fetchPayslipData = async (payrollId) => {
  try {
    const response = await fetch(`/api/payroll/${payrollId}/details`, { credentials: 'include' });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error fetching payslip data: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching payslip data for payroll ${payrollId}:`, error);
    throw error;
  }
};

/**
 * Generate payslip PDF
 * @param {string} payrollId - Payroll ID
 * @returns {Promise<Blob>} PDF blob
 */
export const generatePayslip = async (payrollId) => {
  try {
    const response = await fetch(`/api/payroll/${payrollId}/payslip`, { credentials: 'include' });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error generating payslip: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error(`Error generating payslip for payroll ${payrollId}:`, error);
    throw error;
  }
};

/**
 * Create a new payroll
 * @param {Object} payrollData - Payroll data
 * @returns {Promise<Object>} Created payroll
 */
export const createPayroll = async (payrollData) => {
  try {
    const response = await fetch('/api/payroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payrollData),
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error creating payroll: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating payroll:', error);
    throw error;
  }
};

/**
 * Update an existing payroll
 * @param {string} payrollId - Payroll ID
 * @param {Object} payrollData - Updated payroll data
 * @returns {Promise<Object>} Updated payroll
 */
export const updatePayroll = async (payrollId, payrollData) => {
  try {
    const response = await fetch(`/api/payroll/${payrollId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payrollData),
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error updating payroll: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error updating payroll ${payrollId}:`, error);
    throw error;
  }
};

/**
 * Delete a payroll
 * @param {string} payrollId - Payroll ID
 * @returns {Promise<boolean>} Success indicator
 */
export const deletePayroll = async (payrollId) => {
  try {
    const response = await fetch(`/api/payroll/${payrollId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error deleting payroll: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error deleting payroll ${payrollId}:`, error);
    throw error;
  }
};

/**
 * Process payroll (change status to Completed and set payment date)
 * @param {Object} payrollData - Payroll data
 * @returns {Promise<Object>} Updated payroll
 */
export const processPayroll = async (payrollData) => {
  try {
    const response = await fetch('/api/payroll/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payrollData),
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error processing payroll: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error processing payroll:', error);
    throw error;
  }
};

/**
 * Export payrolls data (CSV/PDF)
 * @param {Object} filters - Filter parameters
 * @param {string} format - Export format ('csv' or 'pdf')
 * @returns {Promise<Blob>} File blob
 */
export const exportPayrolls = async (filters = {}, format = 'csv') => {
  try {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') queryParams.append(key, value);
    });
    queryParams.append('format', format);
    
    const queryString = queryParams.toString();
    const url = `/api/payroll/export${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, { credentials: 'include' });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error exporting payrolls: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error('Error exporting payrolls:', error);
    throw error;
  }
};

/**
 * Create a bulk payroll run for multiple employees
 * @param {Object} payrollRunData - Bulk payroll data
 * @returns {Promise<Object>} Result of the payroll run
 */
export const createBulkPayroll = async (payrollRunData) => {
  try {
    const response = await fetch('/api/payroll/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payrollRunData),
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error creating bulk payroll: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating bulk payroll:', error);
    throw error;
  }
};