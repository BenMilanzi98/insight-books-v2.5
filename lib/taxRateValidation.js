/**
 * Validate tax rate / amount for TaxType create & update.
 * @param {number|string} taxRate
 * @param {string} [calculationType='Percentage']
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
export function validateTaxRate(taxRate, calculationType = 'Percentage') {
  if (taxRate === undefined || taxRate === null || taxRate === '') {
    return { ok: false, error: 'taxRate is required' };
  }

  const parsed = parseFloat(taxRate);
  if (Number.isNaN(parsed)) {
    return { ok: false, error: 'taxRate must be a valid number' };
  }
  if (parsed < 0) {
    return { ok: false, error: 'taxRate cannot be negative' };
  }

  const isPercentage = (calculationType || 'Percentage') === 'Percentage';
  if (isPercentage && parsed > 100) {
    return {
      ok: false,
      error: 'Percentage tax rate must be between 0 and 100 (e.g. 17.5 or 0.05)',
    };
  }

  return { ok: true, value: parsed };
}
