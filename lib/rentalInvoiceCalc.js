import { calculateInvoiceTotals } from '@/lib/invoiceTotals';

/**
 * Invoice-style totals for rental/hiring lines (canonical cent-safe calculator).
 */
export function calculateRentalInvoiceTotals(items, globalDiscount = 0) {
  return calculateInvoiceTotals(items, globalDiscount);
}
