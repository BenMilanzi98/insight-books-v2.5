// lib/invoiceCalculations.js — formatting + thin wrappers over canonical totals

import { calculateInvoiceTotals } from '@/lib/invoiceTotals';
import { roundMoney, subtractMoney } from '@/lib/money';

export const calculateSubtotal = (items, discount = 0) => {
  const t = calculateInvoiceTotals(items, discount);
  return subtractMoney(subtractMoney(t.subtotal, t.totalDiscountAmount), t.globalDiscount);
};

export const calculateTax = (items, discount = 0) => {
  return calculateInvoiceTotals(items, discount).taxAmount;
};

export const calculateTotal = (items, discount = 0) => {
  return calculateInvoiceTotals(items, discount).total;
};

export { calculateInvoiceTotals };

export const formatCurrency = (amount, currencyCode = 'MWK', includeSymbol = true) => {
  const num = roundMoney(amount);
  const decimalFormatted = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  if (!includeSymbol) return decimalFormatted;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (error) {
    console.warn(`Invalid currency code: ${currencyCode}. Using fallback format.`);
    return `${currencyCode} ${decimalFormatted}`;
  }
};

export const formatAmount = (amount) => formatCurrency(amount, 'MWK', false);

const exportNumberFormat = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatAmountForExport = (amount) =>
  exportNumberFormat.format(roundMoney(amount));

export const formatCurrencyForExport = (amount, currencyCode = 'MWK') => {
  const num = roundMoney(amount);
  const formatted = exportNumberFormat.format(num);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (error) {
    return `${currencyCode} ${formatted}`;
  }
};

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
