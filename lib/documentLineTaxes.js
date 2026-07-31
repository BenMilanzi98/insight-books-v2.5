import { roundMoney, sumMoney } from '@/lib/money';

function unwrapTax(raw) {
  if (!raw) return null;
  const t = raw.taxType && typeof raw.taxType === 'object' ? { ...raw.taxType, ...raw } : raw;
  const taxTypeId = t.taxTypeId || t.id || null;
  if (!taxTypeId && t.taxRate == null) return null;
  return {
    id: taxTypeId,
    taxTypeId,
    taxName: t.taxName || t.name || 'Tax',
    taxCode: t.taxCode || '',
    taxRate: Number(t.taxRate) || 0,
    calculationType: t.calculationType === 'Fixed' ? 'Fixed' : 'Percentage',
  };
}

export function normalizeLineTaxes(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of rawList) {
    const t = unwrapTax(raw);
    if (!t?.taxTypeId) continue;
    if (seen.has(t.taxTypeId)) continue;
    seen.add(t.taxTypeId);
    out.push(t);
  }
  return out;
}

export function denormalizedPercentageTaxRate(taxes) {
  if (!Array.isArray(taxes)) return 0;
  const pct = taxes
    .map(unwrapTax)
    .filter((t) => t && t.calculationType === 'Percentage');
  return roundMoney(sumMoney(pct.map((t) => t.taxRate)));
}

export function resolveLineTaxesInput(item) {
  if (!item || typeof item !== 'object') return [];
  if (Array.isArray(item.taxes) && item.taxes.length) return normalizeLineTaxes(item.taxes);
  if (Array.isArray(item.itemTaxes) && item.itemTaxes.length) return normalizeLineTaxes(item.itemTaxes);
  if (Array.isArray(item.productTaxes) && item.productTaxes.length) return normalizeLineTaxes(item.productTaxes);
  return [];
}

export function toItemTaxCreateRows(taxBreakdown) {
  return (taxBreakdown || []).map((t) => ({
    taxTypeId: t.taxTypeId || t.id,
    taxName: t.taxName || 'Tax',
    taxCode: t.taxCode || '',
    taxRate: Number(t.taxRate) || 0,
    calculationType: t.calculationType === 'Fixed' ? 'Fixed' : 'Percentage',
    taxAmount: Number(t.taxAmount) || 0,
  }));
}
