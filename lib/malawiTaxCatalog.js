/**
 * Malawi Revenue Authority (MRA) tax catalog — linked to GL **2041 Tax Inflow** and **2045 Tax Outflow**.
 * @typedef {'inflow'|'outflow'} TaxFlow
 */

/** Standard VAT rate (MRA mid-year budget 2025/26). Effective 30 Dec 2025. */
export const MALAWI_STANDARD_VAT_RATE = 17.5;

/** MRA 2025/26 mid-year tax measures (PAYE, VAT, MAT, etc.). */
export const MALAWI_TAX_MEASURES_EFFECTIVE_FROM = '2025-12-30';

/** Gambling / lottery winnings WHT (no tax-free thresholds from 2025/26). */
export const MALAWI_GAMBLING_WHT_RATE = 15;

/** Money transfer levy on bank transfers and mobile money > MWK 100,000 (sender). */
export const MALAWI_MONEY_TRANSFER_LEVY_RATE = 0.05;

/** Minimum Alternate Tax — turnover-based floor for large companies. */
export const MALAWI_MAT_RATE = 0.5;

/** Supernormal profit tax applies at 40% on taxable income above MWK 5 billion (standard CIT 30% below). */
export const MALAWI_SUPERNORMAL_PROFIT_THRESHOLD_MWK = 5_000_000_000;

/** Standard corporate income tax rate. */
export const MALAWI_CORPORATE_TAX_RATE = 30;

/** TEVET levy on employer payroll (prior-year basis per TEVET Act). */
export const MALAWI_TEVET_LEVY_RATE = 1;

/** @param {number|string|null|undefined} rate */
export function isMalawiStandardVatRate(rate) {
  return Math.abs(parseFloat(rate) - MALAWI_STANDARD_VAT_RATE) < 0.001;
}

/** MRA EIS tax rate band id for standard VAT. */
export function mraStandardVatTaxRateId() {
  return 'A';
}

/** @typedef {{
 *   taxId: string,
 *   taxName: string,
 *   taxCode: string,
 *   taxRate: number,
 *   calculationType?: string,
 *   flow: TaxFlow,
 *   glCode: string,
 *   glAccountName?: string,
 *   description?: string,
 *   isSystem?: boolean,
 * }} MalawiTaxCatalogEntry */

/** @type {MalawiTaxCatalogEntry[]} */
export const MALAWI_TAX_CATALOG = [
  // —— Tax Inflow (2041) — taxes collected / withheld / owed on outward transactions ——
  {
    taxId: 'MW-VAT',
    taxName: 'Value Added Tax (VAT)',
    taxCode: 'MW-VAT-STD',
    taxRate: MALAWI_STANDARD_VAT_RATE,
    flow: 'inflow',
    glCode: '2041-01',
    glAccountName: 'VAT Output (Collected)',
    description: `Standard VAT collected on taxable supplies (MRA ${MALAWI_STANDARD_VAT_RATE}%). Posts under 2041 Tax Inflow.`,
    isSystem: true,
  },
  {
    taxId: 'PAYE',
    taxName: 'Pay As You Earn (PAYE)',
    taxCode: 'MW-PAYE',
    taxRate: 0,
    flow: 'inflow',
    glCode: '2041-02',
    glAccountName: 'PAYE Withheld',
    description: 'PAYE withheld from employees — remitted to MRA. Rate from payroll brackets.',
    isSystem: true,
  },
  {
    taxId: 'MW-WHT',
    taxName: 'Withholding Tax (WHT)',
    taxCode: 'MW-WHT',
    taxRate: 0,
    flow: 'inflow',
    glCode: '2041-03',
    glAccountName: 'Withholding Tax (WHT)',
    description:
      'WHT on specified payments (Taxation Act 14th Schedule). Common rates: 3% farm/trader supplies, 4% building contractors, 10% haulage, 15% gambling winnings (2025/26), 20% rent/interest/services/commission. Rate varies by payment type.',
    isSystem: true,
  },
  {
    taxId: 'MW-FBT',
    taxName: 'Fringe Benefit Tax (FBT)',
    taxCode: 'MW-FBT',
    taxRate: 0,
    flow: 'inflow',
    glCode: '2041-04',
    glAccountName: 'Fringe Benefit Tax (FBT)',
    isSystem: true,
  },
  {
    taxId: 'MW-TOT',
    taxName: 'Turnover Tax (TOT)',
    taxCode: 'MW-TOT',
    taxRate: 0,
    flow: 'inflow',
    glCode: '2041-05',
    glAccountName: 'Turnover Tax (TOT)',
    isSystem: true,
  },
  {
    taxId: 'MW-EXCISE',
    taxName: 'Domestic Excise Tax',
    taxCode: 'MW-EXCISE',
    taxRate: 0,
    flow: 'inflow',
    glCode: '2041-06',
    glAccountName: 'Domestic Excise Tax',
    isSystem: true,
  },
  {
    taxId: 'MW-CGT',
    taxName: 'Capital Gains Tax',
    taxCode: 'MW-CGT',
    taxRate: 0,
    flow: 'inflow',
    glCode: '2041-07',
    glAccountName: 'Capital Gains Tax',
    isSystem: true,
  },
  {
    taxId: 'MW-GAMBLING',
    taxName: 'Tax on Gambling and Lottery Winnings',
    taxCode: 'MW-GAMBLING',
    taxRate: MALAWI_GAMBLING_WHT_RATE,
    flow: 'inflow',
    glCode: '2041-08',
    glAccountName: 'Gambling & Lottery Tax',
    description:
      '15% WHT on all betting/gambling/lottery winnings (MRA 2025/26 — removed MWK 100k/500k exemptions).',
    isSystem: true,
  },
  {
    taxId: 'MW-MTL',
    taxName: 'Money Transfer Levy',
    taxCode: 'MW-MTL',
    taxRate: MALAWI_MONEY_TRANSFER_LEVY_RATE,
    flow: 'inflow',
    glCode: '2041-09',
    glAccountName: 'Money Transfer Levy',
    description:
      '0.05% levy on bank transfers (sender) and mobile money transfers above MWK 100,000 (MRA 2025/26).',
    isSystem: true,
  },
  // —— Tax Outflow (2045) — taxes paid / recoverable on inward transactions ——
  {
    taxId: 'MW-VAT-IN',
    taxName: 'VAT Input (Recoverable)',
    taxCode: 'MW-VAT-IN',
    taxRate: MALAWI_STANDARD_VAT_RATE,
    flow: 'outflow',
    glCode: '2045-01',
    glAccountName: 'VAT Input (Recoverable)',
    description: 'Input VAT on purchases and expenses — recoverable from MRA. Posts under 2045 Tax Outflow.',
    isSystem: true,
  },
  {
    taxId: 'MW-INC-TAX',
    taxName: 'Income Tax',
    taxCode: 'MW-INC-TAX',
    taxRate: 0,
    flow: 'outflow',
    glCode: '2045-02',
    glAccountName: 'Income Tax',
    isSystem: true,
  },
  {
    taxId: 'MW-CIT',
    taxName: 'Corporate Income Tax',
    taxCode: 'MW-CIT',
    taxRate: MALAWI_CORPORATE_TAX_RATE,
    flow: 'outflow',
    glCode: '2045-03',
    glAccountName: 'Corporate Income Tax',
    description: 'Standard company tax on taxable profits (30%). Supernormal rate 40% above MWK 5bn taxable income.',
    isSystem: true,
  },
  {
    taxId: 'MW-PROV',
    taxName: 'Provisional Tax',
    taxCode: 'MW-PROV',
    taxRate: 0,
    flow: 'outflow',
    glCode: '2045-04',
    glAccountName: 'Provisional Tax',
    isSystem: true,
  },
  {
    taxId: 'MW-TEVET',
    taxName: 'TEVET Levy',
    taxCode: 'MW-TEVET',
    taxRate: MALAWI_TEVET_LEVY_RATE,
    flow: 'outflow',
    glCode: '2045-05',
    glAccountName: 'TEVET Levy',
    description: '1% of employer payroll (prior financial year) per TEVET Act — employer cost, not employee deduction.',
    isSystem: true,
  },
  {
    taxId: 'MW-ROYALTY',
    taxName: 'Mineral Royalty',
    taxCode: 'MW-ROYALTY',
    taxRate: 0,
    flow: 'outflow',
    glCode: '2045-06',
    glAccountName: 'Mineral Royalty',
    isSystem: true,
  },
  {
    taxId: 'MW-MAT',
    taxName: 'Minimum Alternative Tax (MAT)',
    taxCode: 'MW-MAT',
    taxRate: MALAWI_MAT_RATE,
    flow: 'outflow',
    glCode: '2045-07',
    glAccountName: 'Minimum Alternative Tax (MAT)',
    description:
      '0.5% of turnover for companies with turnover above MWK 5bn operating 3+ years (pay higher of MAT or 30% CIT).',
    isSystem: true,
  },
  {
    taxId: 'MW-SPT',
    taxName: 'Supernormal Profit Tax',
    taxCode: 'MW-SPT',
    taxRate: 0,
    flow: 'outflow',
    glCode: '2045-08',
    glAccountName: 'Supernormal Profit Tax',
    description:
      '40% on taxable income above MWK 5 billion (30% standard CIT below threshold). Effective 2025/26 mid-year budget.',
    isSystem: true,
  },
];

export const MALAWI_TAX_INFLOW_PARENT = '2041';
export const MALAWI_TAX_OUTFLOW_PARENT = '2045';

export const TAX_GL_PARENT_CODES = new Set([MALAWI_TAX_INFLOW_PARENT, MALAWI_TAX_OUTFLOW_PARENT]);

const catalogByTaxId = new Map(MALAWI_TAX_CATALOG.map((e) => [e.taxId.toUpperCase(), e]));
const catalogByTaxCode = new Map(
  MALAWI_TAX_CATALOG.filter((e) => e.taxCode).map((e) => [e.taxCode.toUpperCase(), e])
);
const catalogByGlCode = new Map(MALAWI_TAX_CATALOG.map((e) => [e.glCode, e]));

/**
 * @param {string|null|undefined} taxIdOrCode
 * @returns {MalawiTaxCatalogEntry|null}
 */
export function getMalawiTaxCatalogEntry(taxIdOrCode) {
  const key = String(taxIdOrCode || '').trim().toUpperCase();
  if (!key) return null;
  return catalogByTaxId.get(key) || catalogByTaxCode.get(key) || null;
}

/**
 * @param {string|null|undefined} glCode
 */
export function getMalawiTaxCatalogEntryByGlCode(glCode) {
  return catalogByGlCode.get(String(glCode || '').trim()) || null;
}

/**
 * @param {{ taxId?: string|null, taxCode?: string|null }} taxType
 */
export function isMalawiSystemTaxType(taxType) {
  if (!taxType) return false;
  const entry =
    getMalawiTaxCatalogEntry(taxType.taxId) || getMalawiTaxCatalogEntry(taxType.taxCode);
  return Boolean(entry?.isSystem);
}

/**
 * Infer inflow vs outflow for GL fallback when tax type has no linked account.
 * @param {{ taxId?: string, taxCode?: string }|null} taxType
 * @param {string} [sourceType]
 * @returns {TaxFlow}
 */
export function resolveTaxFlowForPosting(taxType, sourceType = '') {
  const entry =
    getMalawiTaxCatalogEntry(taxType?.taxId) || getMalawiTaxCatalogEntry(taxType?.taxCode);
  if (entry?.flow) return entry.flow;

  const src = String(sourceType || '');
  const inflowSources = ['Sale', 'Invoice', 'Payroll'];
  if (inflowSources.some((s) => src === s || src.includes(s))) return 'inflow';

  const outflowSources = ['Expense', 'SupplierPayment', 'Purchase'];
  if (outflowSources.some((s) => src.includes(s))) return 'outflow';

  return 'inflow';
}

export function isTaxGlParentCode(code) {
  const c = String(code || '').trim();
  return c === MALAWI_TAX_INFLOW_PARENT || c === MALAWI_TAX_OUTFLOW_PARENT;
}

export function isTaxGlChildCode(code) {
  return /^204[15]-\d{2}$/.test(String(code || '').trim());
}
