// app/services/recurringExpenseService.js

// Fetch recurring expenses with optional filters, sorting, and pagination
export const fetchRecurringExpenses = async (params = {}) => {
    try {
      const { page, limit, sortBy, sortOrder, status, category, search } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', page);
      if (limit) queryParams.append('limit', limit);
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      if (status && status !== 'all') queryParams.append('status', status);
      if (category && category !== 'all') queryParams.append('category', category);
      if (search) queryParams.append('search', search);
      
      const queryString = queryParams.toString();
      const url = `/api/recurring-expenses${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error fetching recurring expenses: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
      throw error;
    }
  };
  
  // Get a single recurring expense by ID
  export const fetchRecurringExpenseById = async (expenseId) => {
    try {
      const response = await fetch(`/api/recurring-expenses/${expenseId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching recurring expense: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching recurring expense ${expenseId}:`, error);
      throw error;
    }
  };
  
  // Create a new recurring expense
  export const createRecurringExpense = async (expenseData) => {
    try {
      const response = await fetch('/api/recurring-expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData),
      });
      
      if (!response.ok) {
        throw new Error(`Error creating recurring expense: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating recurring expense:', error);
      throw error;
    }
  };
  
  // Update an existing recurring expense
  export const updateRecurringExpense = async (expenseId, expenseData) => {
    try {
      const response = await fetch(`/api/recurring-expenses/${expenseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData),
      });
      
      if (!response.ok) {
        throw new Error(`Error updating recurring expense: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error updating recurring expense ${expenseId}:`, error);
      throw error;
    }
  };
  
  // Delete a recurring expense (or cancel it)
  export const deleteRecurringExpense = async (expenseId) => {
    try {
      const response = await fetch(`/api/recurring-expenses/${expenseId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting recurring expense: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting recurring expense ${expenseId}:`, error);
      throw error;
    }
  };
  
  // Pause a recurring expense
  export const pauseRecurringExpense = async (expenseId) => {
    try {
      const response = await fetch(`/api/recurring-expenses/${expenseId}/pause`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Error pausing recurring expense: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error pausing recurring expense ${expenseId}:`, error);
      throw error;
    }
  };
  
  // Resume a recurring expense
  export const resumeRecurringExpense = async (expenseId) => {
    try {
      const response = await fetch(`/api/recurring-expenses/${expenseId}/resume`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Error resuming recurring expense: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error resuming recurring expense ${expenseId}:`, error);
      throw error;
    }
  };
  
  // Get expense history for a recurring expense
  export const getRecurringExpenseHistory = async (expenseId) => {
    try {
      const response = await fetch(`/api/recurring-expenses/${expenseId}/history`);
      
      if (!response.ok) {
        throw new Error(`Error fetching recurring expense history: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching recurring expense history ${expenseId}:`, error);
      throw error;
    }
  };