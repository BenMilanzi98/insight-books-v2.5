// lib/invoiceCalculations.js with fixed formatCurrency function

/**
 * Calculate the subtotal of invoice items (sum of quantity * unitPrice for each item)
 * @param {Array} items - Array of invoice items
 * @returns {number} Subtotal amount
 */
export const calculateSubtotal = (items, discount = 0) => {
  if (!items || !Array.isArray(items)) return 0;
  
  const subtotal = items.reduce((total, item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const perItemDiscount = parseFloat(item.discountAmount) || 0; // Per-item discount
    const totalLineDiscount = quantity * perItemDiscount; // Total discount = per-item × quantity
    return total + (quantity * unitPrice) - totalLineDiscount;
  }, 0);
  
  // Apply global discount
  const globalDiscount = parseFloat(discount) || 0;
  return Math.max(0, subtotal - globalDiscount);
};

/**
 * Calculate the total tax amount from invoice items
 * @param {Array} items - Array of invoice items
 * @returns {number} Total tax amount
 */
export const calculateTax = (items, discount = 0) => {
  if (!items || !Array.isArray(items)) return 0;

  const cleanNumber = (value) => {
    if (value === null || value === undefined) return 0;
    return parseFloat(value.toString().replace(/,/g, '')) || 0;
  };

  // Calculate subtotal with per-item discounts but without global discount
  const subtotalBeforeGlobalDiscount = items.reduce((total, item) => {
    const quantity = cleanNumber(item.quantity);
    const unitPrice = cleanNumber(item.unitPrice);
    const perItemDiscount = cleanNumber(item.discountAmount); // Per-item discount
    const totalLineDiscount = quantity * perItemDiscount; // Total discount = per-item × quantity
    return total + (quantity * unitPrice) - totalLineDiscount;
  }, 0);

  const globalDiscount = cleanNumber(discount);
  const validGlobalDiscount = Math.max(0, Math.min(globalDiscount, subtotalBeforeGlobalDiscount));
  const finalSubtotal = subtotalBeforeGlobalDiscount - validGlobalDiscount;

  return items.reduce((taxTotal, item) => {
    const quantity = cleanNumber(item.quantity);
    const unitPrice = cleanNumber(item.unitPrice);
    const taxRate = cleanNumber(item.taxRate);
    const perItemDiscount = cleanNumber(item.discountAmount); // Per-item discount
    const totalLineDiscount = quantity * perItemDiscount; // Total discount = per-item × quantity

    const itemSubtotal = quantity * unitPrice;
    const itemNetAmount = itemSubtotal - totalLineDiscount;
    
    // Calculate proportional global discount for this item
    const itemGlobalDiscountShare = subtotalBeforeGlobalDiscount > 0 ? 
      (itemNetAmount / subtotalBeforeGlobalDiscount) * validGlobalDiscount : 0;
    
    const finalItemAmount = itemNetAmount - itemGlobalDiscountShare;
    const itemTax = finalItemAmount * (taxRate / 100);

    return taxTotal + itemTax;
  }, 0);
};

/**
 * Calculate the total invoice amount (subtotal + tax)
 * @param {Array} items - Array of invoice items
 * @returns {number} Total amount
 */
export const calculateTotal = (items,discount=0) => {
  return calculateSubtotal(items,discount) + calculateTax(items,discount);
};

/**
 * Format a number as currency string
 * @param {number} amount - The amount to format
 * @param {string} currencyCode - Currency code (default: 'MWK')
 * @param {boolean} includeSymbol - Whether to include currency symbol (use false for line items; symbol only in headers/totals)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currencyCode = 'MWK', includeSymbol = true) => {
  const decimalFormatted = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount));
  if (!includeSymbol) return decimalFormatted;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    console.warn(`Invalid currency code: ${currencyCode}. Using fallback format.`);
    return `${currencyCode} ${decimalFormatted}`;
  }
};

/** Format amount as number only (no currency symbol). Use in invoice/quote line items; show symbol only in headers and totals. Always shows .00 in UI. */
export const formatAmount = (amount) => formatCurrency(amount, 'MWK', false);

/**
 * Format for export/print: no trailing .00 (e.g. 1,234.00 → 1,234). Keeps document tidy.
 * Use in PDF generation and when isPrint is true.
 */
const exportNumberFormat = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

export const formatAmountForExport = (amount) => exportNumberFormat.format(Number(amount));

export const formatCurrencyForExport = (amount, currencyCode = 'MWK') => {
  const num = Number(amount);
  const formatted = exportNumberFormat.format(num);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  } catch (error) {
    return `${currencyCode} ${formatted}`;
  }
};

/**
 * Format a date as DD-MM-YYYY format
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string (DD-MM-YYYY)
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  try {
    const dateObj = new Date(date);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Invalid date format', error);
    return '';
  }
};