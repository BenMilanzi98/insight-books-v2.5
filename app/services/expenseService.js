// app/services/expenseService.js

// Fetch expenses with optional filters, sorting, and pagination
export const fetchExpenses = async (params = {}) => {
    try {
      const {
        page,
        limit,
        sortBy,
        sortOrder,
        status,
        category,
        search,
        dateFrom,
        dateTo,
        branchId,
        accountId,
        supplierId,
        includeDeleted,
      } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', page);
      if (limit) queryParams.append('limit', limit);
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      if (status && status !== 'all') queryParams.append('status', status);
      if (category && category !== 'all') queryParams.append('category', category);
      if (search) queryParams.append('search', search);
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);
      if (accountId && accountId !== 'all') queryParams.append('accountId', accountId);
      if (supplierId) queryParams.append('supplierId', supplierId);
      if (includeDeleted === true || includeDeleted === 'true') {
        queryParams.append('includeDeleted', 'true');
      }
      // Note: branchId is handled automatically by API using user's currentBranchId
      // Only pass branchId if explicitly provided (e.g., for "All Branches" view)
      if (branchId) queryParams.append('branchId', branchId);
      
      const queryString = queryParams.toString();
      const url = `/api/expenses${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error fetching expenses: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching expenses:', error);
      throw error;
    }
  };
  // Create expense with attachments in one request
export const createExpenseWithAttachments = async (expenseData, attachments) => {
    try {
      const formData = new FormData();
      
      // Add expense data as a JSON string
      formData.append('data', JSON.stringify(expenseData));
      
      // Add attachments
      attachments.forEach((file, index) => {
        formData.append(`file-${index}`, file);
      });
      
      const response = await fetch('/api/expenses/with-attachments', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error creating expense with attachments: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating expense with attachments:', error);
      throw error;
    }
  };
  // Get a single expense by ID
  export const fetchExpenseById = async (expenseId) => {
    try {
      const response = await fetch(`/api/expenses/${expenseId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching expense: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching expense ${expenseId}:`, error);
      throw error;
    }
  };
  
  // Create a new expense
  export const createExpense = async (expenseData) => {
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error || response.statusText || 'Failed to create expense';
        throw new Error(message);
      }

      return data;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  };
  
  // Update an existing expense
  export const updateExpense = async (expenseId, expenseData) => {
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData),
      });
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error || response.statusText || 'Failed to update expense';
        throw new Error(message);
      }
      
      return data;
    } catch (error) {
      console.error(`Error updating expense ${expenseId}:`, error);
      throw error;
    }
  };
  
  // Delete an expense
  export const deleteExpense = async (expenseId, reason = 'Manual deletion') => {
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete expense');
      }

      return response.json();
    } catch (error) {
      console.error(`Error deleting expense ${expenseId}:`, error);
      throw error;
    }
  };
  
  // Upload attachment for an expense
  export const uploadAttachment = async (expenseId, formData) => {
    try {
      const response = await fetch(`/api/expenses/${expenseId}/attachments`, {
        method: 'POST',
        body: formData, // FormData should contain the file
      });
      
      if (!response.ok) {
        throw new Error(`Error uploading attachment: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error uploading attachment for expense ${expenseId}:`, error);
      throw error;
    }
  };
  

  
  // Delete an attachment
  export const deleteAttachment = async (expenseId, attachmentId) => {
    try {
      const response = await fetch(`/api/expenses/${expenseId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting attachment: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting attachment ${attachmentId}:`, error);
      throw error;
    }
  };
  
  // Get expense statistics
  export const getExpenseStatistics = async (params = {}) => {
    try {
      const { dateFrom, dateTo, accountId, category, search, _t } = params;
      
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);
      if (accountId && accountId !== 'all') queryParams.append('accountId', accountId);
      if (category && category !== 'all') queryParams.append('category', category);
      if (search && String(search).trim()) queryParams.append('search', String(search).trim());
      if (_t) queryParams.append('_t', _t); // Cache-busting parameter
      
      const queryString = queryParams.toString();
      const url = `/api/expenses/statistics${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching expense statistics: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching expense statistics:', error);
      throw error;
    }
  };

/**
 * Full GL reversal of a posted Transaction (e.g. sale COGS journal).
 * Uses /api/transactions/reverse — original entry stays; opposite lines + audit log.
 */
export const reversePostedGlTransaction = async ({ transactionId, reversalReason }) => {
  const response = await fetch('/api/transactions/reverse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionId,
      transactionType: 'Transaction',
      reversalReason,
    }),
  });
  if (!response.ok) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      /* ignore */
    }
    throw new Error(body.error || 'Failed to reverse GL posting');
  }
  return response.json();
};

/** Full sale reversal (revenue, tax, remaining GL, payments). Skips journals already reversed (e.g. COGS done first). */
export const reverseSalePosting = async ({ saleId, reversalReason }) => {
  const response = await fetch('/api/transactions/reverse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionId: saleId,
      transactionType: 'Sale',
      reversalReason,
    }),
  });
  if (!response.ok) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      /* ignore */
    }
    throw new Error(body.error || 'Failed to reverse sale');
  }
  return response.json();
};

export const updateSalaryAdvance = async (advanceId, payload) => {
  const response = await fetch(`/api/salary-advances/${advanceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      /* ignore */
    }
    throw new Error(body.error || body.details || 'Failed to update salary advance');
  }
  return response.json();
};

/** Salary advances listed on /expenses use synthetic ids `salary-advance-{id}`; delete via this API. */
export const deleteSalaryAdvance = async (advanceId) => {
  const response = await fetch(`/api/salary-advances/${advanceId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      /* ignore */
    }
    throw new Error(body.error || body.details || 'Failed to delete salary advance');
  }
  return response.json();
};

// Batch delete expenses
export const batchDeleteExpenses = async (expenseIds, reason = 'Batch deletion') => {
  const response = await fetch('/api/expenses/batch-delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expenseIds, reason }),
  });

  if (!response.ok) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      // non-JSON error body
    }
    let msg = body.error || 'Failed to delete expenses';
    const missing = body.missingIds;
    if (Array.isArray(missing) && missing.length > 0) {
      const sample = missing.slice(0, 3).join(', ');
      msg += ` Refresh the list and try again. Missing IDs (${missing.length}): ${sample}${missing.length > 3 ? '…' : ''}`;
    }
    throw new Error(msg);
  }

  return response.json();
};

// Fetch deleted expenses
export const fetchDeletedExpenses = async (params = {}) => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);

  const response = await fetch(`/api/expenses/deleted?${queryParams}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch deleted expenses');
  }

  return response.json();
};

// Restore a deleted expense
export const restoreExpense = async (expenseId, reason = 'Manual restoration') => {
  const response = await fetch('/api/expenses/restore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expenseId, reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to restore expense');
  }

  return response.json();
};
  
  // Export expense data (CSV/PDF)
  export const exportExpenses = async (filters = {}, format = 'csv') => {
    try {
      // Build query string from filters
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') queryParams.append(key, value);
      });
      queryParams.append('format', format);
      
      const queryString = queryParams.toString();
      const url = `/api/expenses/export${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error exporting expenses: ${response.statusText}`);
      }
      
      return response.blob();
    } catch (error) {
      console.error('Error exporting expenses:', error);
      throw error;
    }
  };
