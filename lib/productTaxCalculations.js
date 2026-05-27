import {
  addMoney,
  multiplyMoney,
  percentOfMoney,
  roundMoney,
  subtractMoney,
  sumMoney,
} from '@/lib/money';

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

  const taxBreakdown = taxes.map((tax) => {
    const taxAmount =
      tax.calculationType === 'Fixed'
        ? multiplyMoney(tax.taxRate || 0, quantity)
        : percentOfMoney(baseAmount, tax.taxRate || 0);

    return {
      taxTypeId: tax.id,
      taxId: tax.taxId,
      taxName: tax.taxName,
      taxCode: tax.taxCode,
      taxRate: tax.taxRate,
      calculationType: tax.calculationType,
      taxAmount: roundMoney(taxAmount),
    };
  });

  const totalTaxAmount = roundMoney(sumMoney(taxBreakdown.map((t) => t.taxAmount)));

  return {
    totalTaxAmount,
    taxBreakdown,
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
  // IMPORTANT: This must be quantity × unitPrice, not just unitPrice
  const lineTotal = multiplyMoney(quantity, unitPrice);
  const baseAmount = subtractMoney(lineTotal, roundMoney(discountAmount));

  // Debug logging to verify calculation
  if (quantity > 1) {
    console.log('🔍 Tax Calculation Debug:', {
      quantity,
      unitPrice,
      lineTotal,
      discountAmount,
      baseAmount,
      taxCount: taxes.length
    });
  }

  // Pass quantity to calculateProductTaxes for Fixed tax calculations
  const result = calculateProductTaxes(baseAmount, taxes, quantity);
  
  // Verify the calculation
  if (quantity > 1 && result.taxBreakdown.length > 0) {
    console.log('🔍 Tax Result:', {
      quantity,
      baseAmount,
      taxBreakdown: result.taxBreakdown.map(t => ({
        name: t.taxName,
        rate: t.taxRate,
        amount: t.taxAmount,
        expectedForOneUnit: (baseAmount / quantity) * (t.taxRate / 100),
        expectedForQuantity: baseAmount * (t.taxRate / 100)
      })),
      totalTaxAmount: result.totalTaxAmount
    });
  }
  
  return result;
}

