/**
 * Canonical invoice / quotation totals (cent-safe, 2 dp).
 */
import {
  addMoney,
  clampMoney,
  multiplyMoney,
  parseMoney,
  percentOfMoney,
  roundMoney,
  subtractMoney,
  sumMoney,
} from '@/lib/money';

function lineParts(item) {
  const quantity = parseMoney(item.quantity);
  const unitPrice = parseMoney(item.unitPrice);
  const perItemDiscount = parseMoney(item.discountAmount);
  const taxRate = parseMoney(item.taxRate);

  const lineTotal = multiplyMoney(quantity, unitPrice);
  const lineDiscountAmount = multiplyMoney(perItemDiscount, quantity);
  const netLineAmount = subtractMoney(lineTotal, lineDiscountAmount);

  return {
    quantity,
    unitPrice,
    perItemDiscount,
    taxRate,
    lineTotal,
    lineDiscountAmount,
    netLineAmount,
  };
}

/**
 * @param {Array} items
 * @param {number} globalDiscount
 * @returns {{
 *   processedItems: Array,
 *   subtotal: number,
 *   totalDiscountAmount: number,
 *   globalDiscount: number,
 *   taxAmount: number,
 *   total: number,
 * }}
 */
export function calculateInvoiceTotals(items, globalDiscount = 0) {
  const list = Array.isArray(items) ? items : [];

  const lines = list.map((item) => {
    const p = lineParts(item);
    return {
      raw: item,
      ...p,
    };
  });

  const subtotal = roundMoney(sumMoney(lines.map((l) => l.lineTotal)));
  const totalDiscountAmount = roundMoney(sumMoney(lines.map((l) => l.lineDiscountAmount)));
  const netSubtotalBeforeGlobal = subtractMoney(subtotal, totalDiscountAmount);
  const validGlobalDiscount = clampMoney(
    globalDiscount,
    0,
    netSubtotalBeforeGlobal
  );

  let totalTaxAmount = 0;
  const processedItems = lines.map((line) => {
    const { raw, quantity, unitPrice, perItemDiscount, taxRate, netLineAmount } = line;

    const itemGlobalDiscountShare =
      netSubtotalBeforeGlobal > 0
        ? multiplyMoney(
            netLineAmount,
            validGlobalDiscount / netSubtotalBeforeGlobal
          )
        : 0;

    const taxableNet = subtractMoney(netLineAmount, itemGlobalDiscountShare);
    const lineTaxAmount = percentOfMoney(taxableNet, taxRate);
    totalTaxAmount = addMoney(totalTaxAmount, lineTaxAmount);
    const finalAmount = addMoney(taxableNet, lineTaxAmount);

    return {
      description: raw.description,
      quantity,
      unitPrice: roundMoney(unitPrice),
      taxRate: roundMoney(taxRate),
      discountAmount: roundMoney(perItemDiscount),
      netAmount: roundMoney(taxableNet),
      amount: roundMoney(finalAmount),
      taxAmount: roundMoney(lineTaxAmount),
      productId: raw.productId || null,
      accountId: raw.accountId,
      selectedTaxTypeId: raw.selectedTaxTypeId || null,
      productTaxes: raw.productTaxes || [],
    };
  });

  const finalNetSubtotal = subtractMoney(netSubtotalBeforeGlobal, validGlobalDiscount);
  const total = addMoney(finalNetSubtotal, totalTaxAmount);

  return {
    processedItems,
    subtotal: roundMoney(subtotal),
    totalDiscountAmount: roundMoney(totalDiscountAmount),
    globalDiscount: roundMoney(validGlobalDiscount),
    taxAmount: roundMoney(totalTaxAmount),
    total: roundMoney(total),
  };
}
