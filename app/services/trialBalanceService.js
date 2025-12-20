// app/services/trialBalanceService.js

/**
 * Service for fetching and processing trial balance data
 */
import { calculateDateRange } from '@/lib/dateUtils';

/**
 * Fetch trial balance data for a specific timeframe
 * @param {string} timeframe - Timeframe identifier (e.g., 'thisMonth', 'lastMonth')
 * @returns {Promise<Object>} Trial balance data
 */
export const fetchTrialBalance = async (timeframe = 'thisMonth') => {
  try {
    // Calculate date range based on timeframe
    const { startDate, endDate } = calculateDateRange(timeframe);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', startDate);
    queryParams.append('endDate', endDate);
    
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
 * @returns {Promise<Blob>} Exported data as blob
 */
export const exportTrialBalance = async (timeframe = 'thisMonth', format = 'pdf') => {
  try {
    // Calculate date range based on timeframe
    const { startDate, endDate } = calculateDateRange(timeframe);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', startDate);
    queryParams.append('endDate', endDate);
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