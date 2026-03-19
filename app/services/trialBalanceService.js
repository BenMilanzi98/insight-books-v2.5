// app/services/trialBalanceService.js

/**
 * Service for fetching and processing trial balance data
 */
import { calculateDateRange } from '@/lib/dateUtils';

/**
 * Fetch trial balance data for a specific timeframe
 * @param {string} timeframe - Timeframe identifier (e.g., 'thisMonth', 'lastMonth', 'custom')
 * @param {Object} [customRange] - For timeframe 'custom': { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 * @returns {Promise<Object>} Trial balance data
 */
export const fetchTrialBalance = async (timeframe = 'thisMonth', customRange = null) => {
  try {
    // Calculate date range based on timeframe (pass customRange when timeframe is 'custom')
    const { startDate, endDate } = calculateDateRange(timeframe, false, customRange);
    
    // Format dates as YYYY-MM-DD strings
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', formatDate(startDate));
    queryParams.append('endDate', formatDate(endDate));
    
    const response = await fetch(`/api/reports/trial-balance?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching trial balance: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching trial balance:', error);
    throw error;
  }
};

/**
 * Export trial balance data
 * @param {string} timeframe - Timeframe identifier
 * @param {string} format - Export format (csv, pdf, excel)
 * @param {Object} [customRange] - For timeframe 'custom': { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 * @returns {Promise<Blob>} Exported data as blob
 */
export const exportTrialBalance = async (timeframe = 'thisMonth', format = 'pdf', customRange = null) => {
  try {
    // Calculate date range based on timeframe (pass customRange when timeframe is 'custom')
    const { startDate, endDate } = calculateDateRange(timeframe, false, customRange);
    
    // Format dates as YYYY-MM-DD strings
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', formatDate(startDate));
    queryParams.append('endDate', formatDate(endDate));
    queryParams.append('format', format);
    
    const response = await fetch(`/api/reports/trial-balance/export?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Error exporting trial balance: ${response.statusText}`);
    }
    
    // Return the blob data for downloading
    return await response.blob();
  } catch (error) {
    console.error('Error exporting trial balance:', error);
    throw error;
  }
};

/**
 * Create a new journal entry
 * @param {Object} journalEntryData - Journal entry data
 * @returns {Promise<Object>} Created journal entry
 */
export const createJournalEntry = async (journalEntryData) => {
  try {
    const response = await fetch('/api/journal-entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(journalEntryData),
    });
    
    if (!response.ok) {
      throw new Error(`Error creating journal entry: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating journal entry:', error);
    throw error;
  }
};