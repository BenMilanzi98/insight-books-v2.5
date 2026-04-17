/**
 * Invoice-style totals for rental/hiring lines (aligned with /api/invoices calculateInvoiceTotals).
 * @param {Array<{ quantity: number, unitPrice: number, taxRate?: number, discountAmount?: number, description: string, accountId: string, productId?: string|null }>} items
 * @param {number} [globalDiscount]
 */
export function calculateRentalInvoiceTotals(items, globalDiscount = 0) {
  let subtotal = 0;
  let totalDiscountAmount = 0;

  const processedItems = items.map((item) => {
    const lineTotal = item.quantity * item.unitPrice;
    const perItemDiscount = item.discountAmount || 0;
    const lineDiscountAmount = perItemDiscount * item.quantity;
    const netLineAmount = lineTotal - lineDiscountAmount;
    const lineTaxAmount = netLineAmount * ((item.taxRate || 0) / 100);
    const finalAmount = netLineAmount + lineTaxAmount;

    subtotal += lineTotal;
    totalDiscountAmount += lineDiscountAmount;

    return {
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate || 0),
      discountAmount: Number(perItemDiscount.toFixed(2)),
      netAmount: Number(netLineAmount.toFixed(2)),
      amount: Number(finalAmount.toFixed(2)),
      taxAmount: Number(lineTaxAmount.toFixed(2)),
      productId: item.productId || null,
      accountId: item.accountId,
      selectedTaxTypeId: item.selectedTaxTypeId || null,
      productTaxes: item.productTaxes || [],
    };
  });

  const netSubtotalBeforeGlobal = subtotal - totalDiscountAmount;
  const validGlobalDiscount = Math.max(0, Math.min(globalDiscount || 0, netSubtotalBeforeGlobal));
  const finalNetSubtotal = netSubtotalBeforeGlobal - validGlobalDiscount;

  let totalTaxAmount = 0;
  processedItems.forEach((item) => {
    const lineTotal = item.quantity * item.unitPrice;
    const lineDiscountAmount = item.discountAmount * item.quantity;
    const netLineAmount = lineTotal - lineDiscountAmount;
    totalTaxAmount += netLineAmount * (item.taxRate / 100);
  });

  const total = finalNetSubtotal + totalTaxAmount;

  return {
    processedItems,
    subtotal: Number(subtotal.toFixed(2)),
    totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
    globalDiscount: Number(validGlobalDiscount.toFixed(2)),
    taxAmount: Number(totalTaxAmount.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}
