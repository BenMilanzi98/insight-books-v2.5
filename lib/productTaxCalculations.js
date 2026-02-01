/**
 * Calculate tax amount for a product based on its assigned taxes
 * @param {number} baseAmount - The base amount to calculate tax on (after discounts)
 * @param {Array} taxes - Array of tax objects with { taxRate, calculationType }
 * @param {number} quantity - Quantity of items (required for Fixed taxes)
 * @returns {Object} - { totalTaxAmount, taxBreakdown }
 */
export function calculateProductTaxes(baseAmount, taxes = [], quantity = 1) {
  if (!Array.isArray(taxes) || taxes.length === 0) {
    return {
      totalTaxAmount: 0,
      taxBreakdown: []
    };
  }

  const taxBreakdown = taxes.map(tax => {
    let taxAmount = 0;
    
    if (tax.calculationType === 'Fixed') {
      // Fixed amount tax - multiply by quantity (tax is per unit)
      taxAmount = (tax.taxRate || 0) * quantity;
    } else {
      // Percentage tax - apply to base amount
      taxAmount = baseAmount * ((tax.taxRate || 0) / 100);
    }

    return {
      taxTypeId: tax.id,
      taxId: tax.taxId,
      taxName: tax.taxName,
      taxCode: tax.taxCode,
      taxRate: tax.taxRate,
      calculationType: tax.calculationType,
      taxAmount: Number(taxAmount.toFixed(2))
    };
  });

  const totalTaxAmount = taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0);

  return {
    totalTaxAmount: Number(totalTaxAmount.toFixed(2)),
    taxBreakdown
  };
}

/**
 * Calculate taxes for a sale item (product with quantity and discounts)
 * @param {Object} item - Sale item with { quantity, unitPrice, discountAmount, taxes }
 * @returns {Object} - { totalTaxAmount, taxBreakdown }
 */
export function calculateSaleItemTaxes(item) {
  const { quantity = 1, unitPrice = 0, discountAmount = 0, taxes = [] } = item;
  
  // Calculate base amount (line total after discount)
  const lineTotal = quantity * unitPrice;
  const baseAmount = lineTotal - discountAmount;

  // Pass quantity to calculateProductTaxes for Fixed tax calculations
  return calculateProductTaxes(baseAmount, taxes, quantity);
}

