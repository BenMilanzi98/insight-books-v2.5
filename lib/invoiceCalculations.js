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
 * @param {boolean} includeSymbol - Whether to include currency symbol
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currencyCode = 'MWK', includeSymbol = true) => {
  try {
    // Try to use the provided currency
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    // If the currency code is invalid, fall back to a simpler format without currency symbol
    console.warn(`Invalid currency code: ${currencyCode}. Using fallback format.`);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    
    // If symbol is requested, manually add the currency code as prefix
    return includeSymbol ? `${currencyCode} ${formatted}` : formatted;
  }
};

/**
 * Format a date as a localized date string
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  try {
    return new Date(date).toLocaleDateString();
  } catch (error) {
    console.error('Invalid date format', error);
    return '';
  }
};