/**
 * Configurable PAYE/tax bands per tenant. Falls back to Malawi 2026 defaults when none active.
 */
import prisma from '@/lib/prisma';
import {
  MALAWI_PAYE_MONTHLY_CEILINGS,
  MALAWI_PAYE_MONTHLY_RATES,
  computeMalawiPayeMonthly,
} from '@/lib/malawiPAYE';

export const DEFAULT_MALAWI_TAX_BANDS = MALAWI_PAYE_MONTHLY_CEILINGS.map((ceiling, i) => ({
  ceiling: Number.isFinite(ceiling) ? ceiling : null,
  rate: MALAWI_PAYE_MONTHLY_RATES[i],
  label: null,
}));

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * @param {unknown} bands
 * @returns {Array<{ ceiling: number|null, rate: number, label?: string|null }>}
 */
export function normalizeTaxBands(bands) {
  if (!Array.isArray(bands) || !bands.length) {
    return DEFAULT_MALAWI_TAX_BANDS.map((b) => ({ ...b }));
  }
  return bands.map((b, i) => ({
    ceiling:
      b?.ceiling == null || b?.ceiling === '' || b?.ceiling === Infinity
        ? null
        : Number(b.ceiling),
    rate: Number(b.rate) || 0,
    label: b?.label ?? null,
    _index: i,
  }));
}

/**
 * Compute monthly PAYE from configurable bands.
 * @param {number} monthlyTaxableIncome
 * @param {Array<{ ceiling: number|null, rate: number, label?: string|null }>} bands
 * @param {number} [monthlyTaxFreeAllowance=0]
 */
export function computePayeFromBands(monthlyTaxableIncome, bands, monthlyTaxFreeAllowance = 0) {
  const allowance = Math.max(0, Number(monthlyTaxFreeAllowance) || 0);
  const taxable = Math.max(0, (Number(monthlyTaxableIncome) || 0) - allowance);
  const normalized = normalizeTaxBands(bands);

  if (!normalized.length) {
    return computeMalawiPayeMonthly(taxable);
  }

  let prevTop = 0;
  let total = 0;
  const breakdown = [];

  for (let i = 0; i < normalized.length; i++) {
    const { ceiling, rate, label } = normalized[i];
    if (taxable <= prevTop) break;

    const sliceEnd =
      ceiling == null || !Number.isFinite(ceiling)
        ? taxable
        : Math.min(taxable, ceiling);
    const sliceTaxable = sliceEnd - prevTop;

    if (sliceTaxable > 0) {
      const tax = sliceTaxable * rate;
      total += tax;
      breakdown.push({
        bracket: label || `Band ${i + 1}`,
        taxableAmount: round2(sliceTaxable),
        rate: rate * 100,
        tax: round2(tax),
      });
    }

    prevTop = sliceEnd;
    if (ceiling == null || taxable <= ceiling) break;
  }

  return {
    payeAmount: Math.max(0, round2(total)),
    breakdown,
    taxableIncomeUsed: round2(taxable),
  };
}

/**
 * Active tax configuration for a payroll period date.
 * @param {string} tenantId
 * @param {Date|string} [asOf=new Date()]
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function loadActivePayrollTaxConfiguration(tenantId, asOf = new Date(), db = prisma) {
  const at = asOf instanceof Date ? asOf : new Date(asOf);
  if (Number.isNaN(at.getTime())) {
    return getDefaultMalawiTaxConfiguration(tenantId);
  }

  let row = null;
  try {
    row = await db.payrollTaxConfiguration.findFirst({
      where: {
        tenantId,
        isActive: true,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  } catch (err) {
    if (err?.code === 'P2021' || /PayrollTaxConfiguration/.test(String(err?.message))) {
      return getDefaultMalawiTaxConfiguration(tenantId);
    }
    throw err;
  }

  if (!row) {
    return getDefaultMalawiTaxConfiguration(tenantId);
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    country: row.country,
    taxYear: row.taxYear,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    bands: normalizeTaxBands(row.bands),
    monthlyTaxFreeAllowance: Number(row.monthlyTaxFreeAllowance) || 0,
    isActive: row.isActive,
    isDefault: false,
  };
}

export function getDefaultMalawiTaxConfiguration(tenantId) {
  const year = new Date().getFullYear();
  return {
    id: null,
    tenantId,
    country: 'MW',
    taxYear: year,
    effectiveFrom: new Date(`${year}-01-01`),
    effectiveTo: null,
    bands: DEFAULT_MALAWI_TAX_BANDS.map((b) => ({ ...b })),
    monthlyTaxFreeAllowance: 0,
    isActive: true,
    isDefault: true,
  };
}

/**
 * @param {number} monthlyTaxableIncome
 * @param {Awaited<ReturnType<typeof loadActivePayrollTaxConfiguration>>} config
 */
export function computePayeForConfiguration(monthlyTaxableIncome, config) {
  return computePayeFromBands(
    monthlyTaxableIncome,
    config?.bands || DEFAULT_MALAWI_TAX_BANDS,
    config?.monthlyTaxFreeAllowance ?? 0,
  );
}

/**
 * Block payroll if tenant has explicitly deactivated all configs and none exist.
 * When table missing or no row, defaults apply — payroll allowed.
 */
export async function assertPayrollTaxConfigurationReady(tenantId, asOf = new Date(), db = prisma) {
  const config = await loadActivePayrollTaxConfiguration(tenantId, asOf, db);
  if (!config?.bands?.length) {
    throw new Error(
      'Payroll tax configuration is missing. Configure PAYE bands under HR → Payroll → Tax settings before processing payroll.',
    );
  }
  return config;
}

/**
 * Idempotently seed default Malawi config for a tenant (first payroll setup).
 */
export async function ensureDefaultPayrollTaxConfiguration(tenantId, db = prisma) {
  try {
    const existing = await db.payrollTaxConfiguration.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true },
    });
    if (existing) return existing;

    const year = new Date().getFullYear();
    return db.payrollTaxConfiguration.create({
      data: {
        tenantId,
        country: 'MW',
        taxYear: year,
        effectiveFrom: new Date(`${year}-01-01`),
        bands: DEFAULT_MALAWI_TAX_BANDS,
        monthlyTaxFreeAllowance: 0,
        isActive: true,
      },
    });
  } catch (err) {
    if (err?.code === 'P2021') return null;
    throw err;
  }
}
