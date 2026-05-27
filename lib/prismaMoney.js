/**
 * Normalize Prisma Decimal / numeric fields for JSON API responses.
 */
import { roundMoney, serializeMoney } from '@/lib/money';

export function decimalToMoney(value) {
  return serializeMoney(value);
}

/**
 * Walk plain objects/arrays and round known money keys to 2 dp for API output.
 * @param {unknown} data
 * @param {Set<string>} [moneyKeys]
 */
export function serializeMoneyFields(data, moneyKeys = DEFAULT_MONEY_KEYS) {
  if (data == null) return data;
  if (Array.isArray(data)) {
    return data.map((item) => serializeMoneyFields(item, moneyKeys));
  }
  if (typeof data === 'object') {
    if (typeof data.toNumber === 'function') {
      return serializeMoney(data);
    }
    const out = {};
    for (const [key, val] of Object.entries(data)) {
      if (moneyKeys.has(key) && (typeof val === 'number' || (val && typeof val.toNumber === 'function'))) {
        out[key] = serializeMoney(val);
      } else if (val && typeof val === 'object') {
        out[key] = serializeMoneyFields(val, moneyKeys);
      } else {
        out[key] = val;
      }
    }
    return out;
  }
  return data;
}

const DEFAULT_MONEY_KEYS = new Set([
  'amount',
  'subtotal',
  'taxAmount',
  'total',
  'totalAmount',
  'totalTaxAmount',
  'totalDiscountAmount',
  'totalPaid',
  'remainingBalance',
  'paidAmount',
  'discount',
  'discountAmount',
  'netAmount',
  'unitPrice',
  'debitAmount',
  'creditAmount',
  'balance',
  'openingBalance',
  'currentBalance',
  'refundAmount',
  'originalTotal',
  'posAmountTendered',
  'posChangeGiven',
  'amountPaid',
  'grossSalary',
  'netPay',
  'basicSalary',
]);

export { roundMoney };
