// app/services/taxService.js

/**
 * Fetch tax summary data for a specific timeframe
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Tax summary data
 */
export const fetchTaxSummary = async (params = {}) => {
    try {
      const { startDate, endDate } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      
      const queryString = queryParams.toString();
      const url = `/api/reports/tax-summary${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching tax summary: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching tax summary:', error);
      throw error;
    }
  };
  
  /**
   * Export tax data
   * @param {Object} params - Query parameters
   * @param {string} format - Export format (csv, pdf, excel)
   * @returns {Promise<Blob>} Exported data as blob
   */
  export const exportTaxData = async (params = {}, format = 'csv') => {
    try {
      const { startDate, endDate } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      queryParams.append('format', format);
      
      const queryString = queryParams.toString();
      const url = `/api/reports/tax-summary/export${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error exporting tax data: ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Error exporting tax data:', error);
      throw error;
    }
  };
  
  /**
   * Fetch tax settings
   * @returns {Promise<Object>} Tax settings
   */
  export const fetchTaxSettings = async () => {
    try {
      const response = await fetch('/api/tenant/settings/tax');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching tax settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching tax settings:', error);
      throw error;
    }
  };
  
  /**
   * Update tax settings
   * @param {Object} settings - Tax settings to update
   * @returns {Promise<Object>} Updated tax settings
   */
  export const updateTaxSettings = async (settings) => {
    try {
      const response = await fetch('/api/tenant/settings/tax', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error updating tax settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating tax settings:', error);
      throw error;
    }
  };
  
  /**
   * Fetch tax rates
   * @returns {Promise<Object>} Tax rates
   */
  export const fetchTaxRates = async () => {
    try {
      const response = await fetch('/api/tenant/tax-rates');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching tax rates: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching tax rates:', error);
      throw error;
    }
  };
  
  /**
   * Add a new tax rate
   * @param {Object} taxRate - Tax rate to add
   * @returns {Promise<Object>} Added tax rate
   */
  export const addTaxRate = async (taxRate) => {
    try {
      const response = await fetch('/api/tenant/tax-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taxRate),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error adding tax rate: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error adding tax rate:', error);
      throw error;
    }
  };
  
  /**
   * Update a tax rate
   * @param {string} rateId - Tax rate ID to update
   * @param {Object} taxRate - Updated tax rate data
   * @returns {Promise<Object>} Updated tax rate
   */
  export const updateTaxRate = async (rateId, taxRate) => {
    try {
      const response = await fetch(`/api/tenant/tax-rates/${rateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taxRate),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error updating tax rate: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating tax rate:', error);
      throw error;
    }
  };
  
  /**
   * Delete a tax rate
   * @param {string} rateId - Tax rate ID to delete
   * @returns {Promise<boolean>} Success status
   */
  export const deleteTaxRate = async (rateId) => {
    try {
      const response = await fetch(`/api/tenant/tax-rates/${rateId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error deleting tax rate: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting tax rate:', error);
      throw error;
    }
  };