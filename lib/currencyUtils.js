// lib/currencyUtils.js
import { addMoney, multiplyMoney, parseMoney, percentOfMoney } from '@/lib/money';

/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: 'MWK' for Malawian Kwacha)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'MWK', decimals = 2) => {
  if (amount === null || amount === undefined) {
    return `${currency} 0.00`;
  }
  
  // Format number with commas and specified decimal places
  const formattedNumber = new Intl.NumberFormat('en-MW', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(parseMoney(amount));
  
  return `${currency} ${formattedNumber}`;
};

/**
 * Format salary/pay amounts: no decimals when the value is a whole number (e.g. 50000 → "MWK 50,000" not "MWK 50,000.00").
 * Use for payslips, emails, and payroll displays.
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: 'MWK')
 * @returns {string} Formatted string without .00 for whole numbers
 */
export const formatSalaryAmount = (amount, currency = 'MWK') => {
  if (amount === null || amount === undefined) {
    return `${currency} 0`;
  }
  const n = parseMoney(amount);
  if (Number.isNaN(n)) return `${currency} 0`;
  const isWhole = n === Math.round(n);
  const formattedNumber = new Intl.NumberFormat('en-MW', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2
  }).format(n);
  return `${currency} ${formattedNumber}`;
};

/**
 * Format a percentage value
 * @param {number} value - The value to format as percentage
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined) {
    return '0.00%';
  }
  
  return `${parseMoney(value).toFixed(decimals)}%`;
};

/**
 * Calculate percentage change between two numbers
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number} Percentage change
 */
export const calculatePercentageChange = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? 100 : current < 0 ? -100 : 0;
  }
  
  return ((current - previous) / Math.abs(previous)) * 100;
};

// lib/dateUtils.js

/**
 * Format a date string (DD-MM-YYYY)
 * @param {string|Date} date - Date to format
 * @param {string} format - Format style (ignored, always uses DD-MM-YYYY)
 * @returns {string} Formatted date string (DD-MM-YYYY)
 */
export const formatDate = (date, format = 'medium') => {
  if (!date) return '';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    return '';
  }
};

/**
 * Get a human-readable label for a timeframe
 * @param {string} timeframe - Timeframe identifier
 * @returns {string} Human-readable timeframe description
 */
export const getTimeframeLabel = (timeframe) => {
  const labels = {
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    thisQuarter: 'This Quarter',
    lastQuarter: 'Last Quarter',
    thisYear: 'This Year',
    lastYear: 'Last Year',
    custom: 'Custom Range'
  };
  
  return labels[timeframe] || timeframe;
};

/** Local civil calendar YYYY-MM-DD (not UTC); same idea as `toYmdLocal` in `lib/dateUtils.js`. */
function civilDateToYmdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get date range for a timeframe
 * @param {string} timeframe - Timeframe identifier
 * @returns {Object} Object with startDate and endDate
 */
export const getDateRange = (timeframe) => {
  const now = new Date();
  let startDate, endDate;
  
  switch (timeframe) {
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'thisQuarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      break;
    case 'lastQuarter':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
      const yearOffset = lastQuarter < 0 ? -1 : 0;
      const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
      startDate = new Date(now.getFullYear() + yearOffset, adjustedQuarter * 3, 1);
      endDate = new Date(now.getFullYear() + yearOffset, adjustedQuarter * 3 + 3, 0);
      break;
    case 'thisYear':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case 'lastYear':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      // Default to this month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  
  return {
    startDate: civilDateToYmdLocal(startDate),
    endDate: civilDateToYmdLocal(endDate),
  };
};

// lib/invoiceCalculations.js

/**
 * Calculate subtotal from invoice items
 * @param {Array} items - Array of invoice items
 * @returns {number} Subtotal amount
 */
export const calculateSubtotal = (items = []) => {
  return items.reduce((total, item) => {
    return addMoney(total, multiplyMoney(item.quantity, item.unitPrice));
  }, 0);
};

/**
 * Calculate tax amount from invoice items
 * @param {Array} items - Array of invoice items
 * @returns {number} Total tax amount
 */
export const calculateTax = (items = []) => {
  return items.reduce((total, item) => {
    return addMoney(total, percentOfMoney(multiplyMoney(item.quantity, item.unitPrice), item.taxRate));
  }, 0);
};

/**
 * Calculate total invoice amount
 * @param {Array} items - Array of invoice items
 * @returns {number} Total invoice amount
 */
export const calculateTotal = (items = []) => {
  const subtotal = calculateSubtotal(items);
  const tax = calculateTax(items);
  return addMoney(subtotal, tax);
};