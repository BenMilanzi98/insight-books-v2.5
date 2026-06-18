/**
 * Malawi Revenue Authority (MRA) tax catalog — linked to GL **2041 Tax Inflow** and **2045 Tax Outflow**.
 * @typedef {'inflow'|'outflow'} TaxFlow
 */

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
    taxRate: 16.5,
    flow: 'inflow',
    glCode: '2041-01',
    glAccountName: 'VAT Output (Collected)',
    description: 'Standard VAT collected on taxable supplies (MRA 16.5%). Posts under 2041 Tax Inflow.',
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
    taxRate: 3,
    flow: 'inflow',
    glCode: '2041-03',
    glAccountName: 'Withholding Tax (WHT)',
    description: 'WHT withheld on payments to suppliers/contractors.',
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
    taxRate: 0,
    flow: 'inflow',
    glCode: '2041-08',
    glAccountName: 'Gambling & Lottery Tax',
    isSystem: true,
  },
  {
    taxId: 'MW-MTL',
    taxName: 'Money Transfer Levy',
    taxCode: 'MW-MTL',
    taxRate: 0,
    flow: 'inflow',
    glCode: '2041-09',
    glAccountName: 'Money Transfer Levy',
    description: 'Levy on bank/mobile money transfers.',
    isSystem: true,
  },
  // —— Tax Outflow (2045) — taxes paid / recoverable on inward transactions ——
  {
    taxId: 'MW-VAT-IN',
    taxName: 'VAT Input (Recoverable)',
    taxCode: 'MW-VAT-IN',
    taxRate: 16.5,
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
    taxRate: 30,
    flow: 'outflow',
    glCode: '2045-03',
    glAccountName: 'Corporate Income Tax',
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
    taxRate: 1,
    flow: 'outflow',
    glCode: '2045-05',
    glAccountName: 'TEVET Levy',
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
    taxRate: 0,
    flow: 'outflow',
    glCode: '2045-07',
    glAccountName: 'Minimum Alternative Tax (MAT)',
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
    isSystem: true,
  },
];

export const MALAWI_TAX_INFLOW_PARENT = '2041';
export const MALAWI_TAX_OUTFLOW_PARENT = '2045';

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
