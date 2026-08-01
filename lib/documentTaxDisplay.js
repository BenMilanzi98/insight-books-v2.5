const TAX_DISPLAY_EPSILON = 0.000001;

export function taxLineAmount(t) {
  return Number(t?.taxAmount ?? t?.total ?? t?.totalAmount ?? 0) || 0;
}

/**
 * Show document-level tax row/section only when total tax or named breakdown lines are positive.
 */
export function shouldDisplayDocumentTax({ taxAmount, taxLines } = {}) {
  const amount = Number(taxAmount) || 0;
  if (amount > TAX_DISPLAY_EPSILON) return true;
  if (Array.isArray(taxLines) && taxLines.some((t) => taxLineAmount(t) > TAX_DISPLAY_EPSILON)) {
    return true;
  }
  return false;
}

/**
 * Whether any line item carries tax (rate or amount) for table column visibility.
 */
export function documentHasLineTax(items = []) {
  if (!Array.isArray(items)) return false;
  return items.some((item) => {
    const rate = Number(item?.taxRate) || 0;
    const amt = Number(item?.taxAmount) || 0;
    const lineTax = Number(item?.lineTaxAmount) || 0;
    if (rate > TAX_DISPLAY_EPSILON || amt > TAX_DISPLAY_EPSILON || lineTax > TAX_DISPLAY_EPSILON) {
      return true;
    }
    const itemTaxes = item?.itemTaxes || item?.taxes || [];
    return itemTaxes.some((t) => taxLineAmount(t) > TAX_DISPLAY_EPSILON);
  });
}
