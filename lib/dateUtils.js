// lib/dateUtils.js

/**
 * Calculate date range based on timeframe string
 * @param {string} timeframe - Options: today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth, thisQuarter, lastQuarter, thisYear, lastYear, last7Days, last30Days, last90Days, last365Days, custom
 * @param {boolean} previous - Whether to return the previous period instead
 * @param {Object} customRange - Custom date range object with startDate and endDate (for custom timeframe)
 * @returns {Object} Object containing startDate and endDate
 */
export function calculateDateRange(timeframe, previous = false, customRange = null) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    let startDate, endDate;
    
    // Handle custom date range
    if (timeframe === 'custom' && customRange) {
      startDate = new Date(customRange.startDate);
      endDate = new Date(customRange.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
    
    switch (timeframe) {
      case 'today':
        if (!previous) {
          startDate = new Date(today);
          endDate = new Date(today);
        } else {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = yesterday;
          endDate = yesterday;
        }
        break;
        
      case 'yesterday':
        if (!previous) {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = yesterday;
          endDate = yesterday;
        } else {
          const dayBeforeYesterday = new Date(today);
          dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
          startDate = dayBeforeYesterday;
          endDate = dayBeforeYesterday;
        }
        break;
        
      case 'thisWeek':
        if (!previous) {
          // Start of week (Monday)
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate = new Date(today);
          startDate.setDate(today.getDate() - daysToMonday);
          endDate = new Date(today);
        } else {
          // Previous week
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const thisWeekStart = new Date(today);
          thisWeekStart.setDate(today.getDate() - daysToMonday);
          startDate = new Date(thisWeekStart);
          startDate.setDate(thisWeekStart.getDate() - 7);
          endDate = new Date(thisWeekStart);
          endDate.setDate(thisWeekStart.getDate() - 1);
        }
        break;
        
      case 'lastWeek':
        if (!previous) {
          // Last week
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const thisWeekStart = new Date(today);
          thisWeekStart.setDate(today.getDate() - daysToMonday);
          startDate = new Date(thisWeekStart);
          startDate.setDate(thisWeekStart.getDate() - 7);
          endDate = new Date(thisWeekStart);
          endDate.setDate(thisWeekStart.getDate() - 1);
        } else {
          // Week before last week
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const thisWeekStart = new Date(today);
          thisWeekStart.setDate(today.getDate() - daysToMonday);
          startDate = new Date(thisWeekStart);
          startDate.setDate(thisWeekStart.getDate() - 14);
          endDate = new Date(thisWeekStart);
          endDate.setDate(thisWeekStart.getDate() - 8);
        }
        break;
        
      case 'thisMonth':
        if (!previous) {
          // This month
          startDate = new Date(currentYear, currentMonth, 1);
          endDate = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
        } else {
          // Previous month
          startDate = new Date(currentYear, currentMonth - 1, 1);
          endDate = new Date(currentYear, currentMonth, 0); // Last day of previous month
        }
        break;
        
      case 'lastMonth':
        if (!previous) {
          // Last month
          startDate = new Date(currentYear, currentMonth - 1, 1);
          endDate = new Date(currentYear, currentMonth, 0); // Last day of previous month
        } else {
          // Month before last month
          startDate = new Date(currentYear, currentMonth - 2, 1);
          endDate = new Date(currentYear, currentMonth - 1, 0);
        }
        break;
        
      case 'thisQuarter':
        const currentQuarter = Math.floor(currentMonth / 3);
        if (!previous) {
          // This quarter
          startDate = new Date(currentYear, currentQuarter * 3, 1);
          endDate = new Date(currentYear, currentQuarter * 3 + 3, 0);
        } else {
          // Previous quarter
          startDate = new Date(currentYear, currentQuarter * 3 - 3, 1);
          endDate = new Date(currentYear, currentQuarter * 3, 0);
        }
        break;
        
      case 'lastQuarter':
        const lastQuarter = Math.floor(currentMonth / 3) - 1;
        const lastQuarterYear = lastQuarter < 0 ? currentYear - 1 : currentYear;
        const normalizedLastQuarter = lastQuarter < 0 ? 3 + lastQuarter : lastQuarter;
        
        if (!previous) {
          // Last quarter
          startDate = new Date(lastQuarterYear, normalizedLastQuarter * 3, 1);
          endDate = new Date(lastQuarterYear, normalizedLastQuarter * 3 + 3, 0);
        } else {
          // Quarter before last quarter
          startDate = new Date(lastQuarterYear, normalizedLastQuarter * 3 - 3, 1);
          endDate = new Date(lastQuarterYear, normalizedLastQuarter * 3, 0);
        }
        break;
        
      case 'thisYear':
        if (!previous) {
          // This year
          startDate = new Date(currentYear, 0, 1);
          endDate = new Date(currentYear, 11, 31);
        } else {
          // Last year
          startDate = new Date(currentYear - 1, 0, 1);
          endDate = new Date(currentYear - 1, 11, 31);
        }
        break;
        
      case 'lastYear':
        if (!previous) {
          // Last year
          startDate = new Date(currentYear - 1, 0, 1);
          endDate = new Date(currentYear - 1, 11, 31);
        } else {
          // Year before last year
          startDate = new Date(currentYear - 2, 0, 1);
          endDate = new Date(currentYear - 2, 11, 31);
        }
        break;
        
      case 'last7Days':
        if (!previous) {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 7);
          endDate = new Date(today);
        } else {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 14);
          endDate = new Date(today);
          endDate.setDate(today.getDate() - 8);
        }
        break;
        
      case 'last30Days':
        if (!previous) {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 30);
          endDate = new Date(today);
        } else {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 60);
          endDate = new Date(today);
          endDate.setDate(today.getDate() - 31);
        }
        break;
        
      case 'last90Days':
        if (!previous) {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 90);
          endDate = new Date(today);
        } else {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 180);
          endDate = new Date(today);
          endDate.setDate(today.getDate() - 91);
        }
        break;
        
      case 'last365Days':
        if (!previous) {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 365);
          endDate = new Date(today);
        } else {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 730);
          endDate = new Date(today);
          endDate.setDate(today.getDate() - 366);
        }
        break;
        
      case 'allTime':
        if (!previous) {
          // All time (default to 5 years ago)
          startDate = new Date(currentYear - 5, 0, 1);
          endDate = new Date(currentYear, 11, 31);
        } else {
          // N/A for all time
          startDate = new Date(currentYear - 10, 0, 1);
          endDate = new Date(currentYear - 5, 11, 31);
        }
        break;
        
      default:
        // Default to this month
        startDate = new Date(currentYear, currentMonth, 1);
        endDate = new Date(currentYear, currentMonth + 1, 0);
    }
    
    // Set time to beginning/end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate };
  }
  
  /**
   * Get the number of days in a month
   */
  Date.prototype.daysInMonth = function() {
    return new Date(this.getFullYear(), this.getMonth() + 1, 0).getDate();
  };
  
  // Format currency to MWK format
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'MWK 0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MWK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Format date to readable format
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

// Format date and time
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

// Get relative time (e.g., "2 hours ago")
export const getRelativeTime = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  } catch (error) {
    return 'Invalid Date';
  }
};

// Check if date is today
export const isToday = (dateString) => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
};

// Check if date is this week
export const isThisWeek = (dateString) => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    return date >= startOfWeek && date <= endOfWeek;
  } catch (error) {
    return false;
  }
};

// Check if date is this month
export const isThisMonth = (dateString) => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  } catch (error) {
    return false;
  }
};

  /**
   * Get a human-readable timeframe label
   * @param {string} timeframe - The timeframe string
   * @returns {string} Human-readable timeframe label
   */
  export function getTimeframeLabel(timeframe) {
    switch (timeframe) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'thisWeek':
        return 'This Week';
      case 'lastWeek':
        return 'Last Week';
      case 'thisMonth':
        return 'This Month';
      case 'lastMonth':
        return 'Last Month';
      case 'thisQuarter':
        return 'This Quarter';
      case 'lastQuarter':
        return 'Last Quarter';
      case 'thisYear':
        return 'This Year';
      case 'lastYear':
        return 'Last Year';
      case 'last7Days':
        return 'Last 7 Days';
      case 'last30Days':
        return 'Last 30 Days';
      case 'last90Days':
        return 'Last 90 Days';
      case 'last365Days':
        return 'Last 365 Days';
      case 'allTime':
        return 'All Time';
      case 'custom':
        return 'Custom Range';
      default:
        return 'Custom Range';
    }
  }

  /**
   * Get all available timeframes for date range selection
   * @returns {Array} Array of timeframe objects with value, label, and description
   */
  export function getAvailableTimeframes() {
    return [
      { value: 'today', label: 'Today', description: 'Current day' },
      { value: 'yesterday', label: 'Yesterday', description: 'Previous day' },
      { value: 'thisWeek', label: 'This Week', description: 'Current week (Mon-Sun)' },
      { value: 'thisMonth', label: 'This Month', description: 'Current month' },
      { value: 'lastMonth', label: 'Last Month', description: 'Previous month' },
      { value: 'thisYear', label: 'This Year', description: 'Current year' },
      { value: 'custom', label: 'Custom Range', description: 'Select custom dates' }
    ];
  }

  /**
   * Validate if a date range is valid
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Object} Object with isValid boolean and error message if invalid
   */
  export function validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
      return { isValid: false, error: 'Both start and end dates are required' };
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { isValid: false, error: 'Invalid date format' };
    }
    
    if (start > end) {
      return { isValid: false, error: 'Start date cannot be after end date' };
    }
    
    
    return { isValid: true, error: null };
  }

  /**
   * Get default custom date range (last 30 days)
   * @returns {Object} Object with startDate and endDate in YYYY-MM-DD format
   */
  export function getDefaultCustomRange() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    return {
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
  }

  /**
   * Get date range based on selected range string
   * @param {string} selectedRange - Range string (e.g., 'today', 'yesterday', 'thisWeek', 'thisMonth', etc.)
   * @returns {Object} Object containing startDate and endDate
   */
  export function getDateRange(selectedRange) {
    const today = new Date();
    let startDate, endDate;

    switch (selectedRange) {
      case 'today':
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'yesterday':
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        break;
      case 'thisWeek':
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysToMonday);
        endDate = new Date(today);
        break;
      case 'lastWeek':
        const lastWeekDayOfWeek = today.getDay();
        const lastWeekDaysToMonday = lastWeekDayOfWeek === 0 ? 6 : lastWeekDayOfWeek - 1;
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - lastWeekDaysToMonday);
        startDate = new Date(thisWeekStart);
        startDate.setDate(thisWeekStart.getDate() - 7);
        endDate = new Date(thisWeekStart);
        endDate.setDate(thisWeekStart.getDate() - 1);
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisQuarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(today.getFullYear(), currentQuarter * 3 + 3, 0);
        break;
      case 'lastQuarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
        const lastQuarterYear = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const normalizedLastQuarter = lastQuarter < 0 ? 3 + lastQuarter : lastQuarter;
        startDate = new Date(lastQuarterYear, normalizedLastQuarter * 3, 1);
        endDate = new Date(lastQuarterYear, normalizedLastQuarter * 3 + 3, 0);
        break;
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
      case 'lastYear':
        startDate = new Date(today.getFullYear() - 1, 0, 1);
        endDate = new Date(today.getFullYear() - 1, 11, 31);
        break;
      case 'last7Days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        endDate = new Date(today);
        break;
      case 'last30Days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        endDate = new Date(today);
        break;
      case 'last90Days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 90);
        endDate = new Date(today);
        break;
      case 'last365Days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 365);
        endDate = new Date(today);
        break;
      default:
        // Default to today
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }

    // Set time to beginning/end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }