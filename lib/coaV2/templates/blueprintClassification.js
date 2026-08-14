/**
 * CoA V2 — classification of the approved InsightBooks blueprint (Phase 3 §16, §36 Stage 2).
 *
 * Derives V2 category/subtype/behaviour/normal-balance/purpose/statement data
 * for each canonical blueprint code. Used by:
 *  - the versioned template builder (templates mirror the approved structure);
 *  - the Stage-2 backfill (classifies existing accounts ONLY where the code
 *    matches the canonical blueprint — anything else goes to manual review).
 *
 * Nothing here invents accounts; it classifies the already-approved structure.
 */

import { AccountCategory, AccountBehaviour, AccountNormalBalance } from '../../accountingV2/domain/enums.js';
import { AccountSubType, expectedNormalBalance, categoryFromLegacyType } from '../domain/categories.js';
import { defaultFinancialStatementSection } from '../domain/financialStatementMapping.js';
import { defaultCashFlowClassification } from '../domain/cashFlowClassification.js';
import { codeNumericPrefix } from '../domain/codeGovernance.js';

/** Blueprint code → system purpose (postable leaves only; headers never map). */
export const BLUEPRINT_PURPOSES = Object.freeze({
  '1110': 'CASH_ON_HAND',
  '1200': 'ACCOUNTS_RECEIVABLE',
  '1216': 'SALARY_ADVANCE',
  '1240': 'VAT_INPUT',
  '1310': 'INVENTORY',
  '2110': 'ACCOUNTS_PAYABLE',
  '2115': 'GRNI',
  '2120': 'VAT_PAYABLE',
  '2150': 'DEFERRED_REVENUE',
  '2130': 'PAYE_PAYABLE',
  '3100': 'OWNER_CAPITAL',
  '3190': 'OPENING_BALANCE_EQUITY',
  '3200': 'RETAINED_EARNINGS',
  '3300': 'CURRENT_YEAR_EARNINGS',
  '3999': 'SUSPENSE_ACCOUNT',
  '4100': 'SALES_REVENUE',
  '4110': 'SALES_RETURNS',
  '4150': 'SERVICE_REVENUE',
  '5100': 'COST_OF_SALES',
  '5200': 'SALARIES_AND_WAGES',
  '5220': 'EMPLOYER_PENSION_EXPENSE',
  '5300': 'RENT_EXPENSE',
  '5310': 'UTILITIES_EXPENSE',
  '5390': 'BAD_DEBT_EXPENSE',
  '5400': 'DEPRECIATION_EXPENSE',
  '5500': 'BANK_CHARGES',
  '5510': 'INTEREST_EXPENSE',
  '1590': 'ACCUMULATED_DEPRECIATION',
  '1510': 'FIXED_ASSET',
});

/** Blueprint codes with CONTROL behaviour. */
const CONTROL_CODES = new Set(['1200', '2110', '2115']);
/** Blueprint codes with SYSTEM behaviour (engine-required, protected). */
const SYSTEM_CODES = new Set(['3190', '3200', '3300', '3999']);
/** Blueprint codes with CONTRA behaviour. */
const CONTRA_CODES = new Set(['1590', '4110', '5120']);

/** Specific subtype refinements per blueprint code. */
const CODE_SUBTYPES = Object.freeze({
  '1590': AccountSubType.CONTRA_ASSET,
  '3100': AccountSubType.OWNER_CAPITAL,
  '3190': AccountSubType.OTHER_EQUITY,
  '3200': AccountSubType.RETAINED_EARNINGS,
  '3300': AccountSubType.CURRENT_YEAR_EARNINGS,
  '3999': AccountSubType.OTHER_EQUITY,
  '4100': AccountSubType.SALES_REVENUE,
  '4110': AccountSubType.CONTRA_REVENUE,
  '4150': AccountSubType.SERVICE_REVENUE,
  '4200': AccountSubType.SERVICE_REVENUE,
  '4300': AccountSubType.INTEREST_INCOME,
  '4900': AccountSubType.OTHER_OPERATING_REVENUE,
  '5110': AccountSubType.INVENTORY_COST,
  '5120': AccountSubType.CONTRA_COST_OF_SALES,
  '5130': AccountSubType.DIRECT_PRODUCTION_COST,
  '5140': AccountSubType.DIRECT_LABOUR,
  '5200': AccountSubType.PAYROLL_EXPENSE,
  '5210': AccountSubType.PAYROLL_EXPENSE,
  '5220': AccountSubType.PAYROLL_EXPENSE,
  '5300': AccountSubType.OCCUPANCY_EXPENSE,
  '5310': AccountSubType.OCCUPANCY_EXPENSE,
  '5400': AccountSubType.DEPRECIATION_EXPENSE,
  '5410': AccountSubType.DEPRECIATION_EXPENSE,
  '5500': AccountSubType.FINANCE_EXPENSE,
  '5510': AccountSubType.FINANCE_EXPENSE,
  '5330': AccountSubType.SELLING_EXPENSE,
  '5580': AccountSubType.TAX_EXPENSE,
});

/** Subtype from the blueprint's descriptive subtype string. */
function subTypeFromBlueprint(row, category) {
  if (CODE_SUBTYPES[row.code]) return CODE_SUBTYPES[row.code];
  switch (row.subtype) {
    case 'Current Asset': return AccountSubType.CURRENT_ASSET;
    case 'Non-current Asset': return AccountSubType.NON_CURRENT_ASSET;
    case 'Current Liability': return AccountSubType.CURRENT_LIABILITY;
    case 'Non-current Liability': return AccountSubType.LONG_TERM_LIABILITY;
    case 'Equity': return AccountSubType.OTHER_EQUITY;
    case 'Operating Income': return AccountSubType.OTHER_OPERATING_REVENUE;
    case 'Cost of Sales': return AccountSubType.INVENTORY_COST;
    case 'Cost of Goods': return AccountSubType.INVENTORY_COST;
    case 'Operating Expense': return AccountSubType.ADMINISTRATIVE_EXPENSE;
    case 'Group':
    default:
      if (category === AccountCategory.ASSET) {
        const prefix = codeNumericPrefix(row.code);
        return prefix != null && prefix >= 1500 && prefix <= 1999
          ? AccountSubType.NON_CURRENT_ASSET
          : AccountSubType.CURRENT_ASSET;
      }
      if (category === AccountCategory.LIABILITY) return AccountSubType.CURRENT_LIABILITY;
      if (category === AccountCategory.EQUITY) return AccountSubType.OTHER_EQUITY;
      if (category === AccountCategory.REVENUE) return AccountSubType.OTHER_OPERATING_REVENUE;
      if (category === AccountCategory.COST_OF_SALES) return AccountSubType.INVENTORY_COST;
      if (category === AccountCategory.EXPENSE) return AccountSubType.ADMINISTRATIVE_EXPENSE;
      return null;
  }
}

/**
 * Classify one canonical blueprint row into the full V2 shape.
 * @param {import('../../chartOfAccountsBlueprint.js').CoaBlueprintRow} row
 */
export function classifyBlueprintRow(row) {
  const prefix = codeNumericPrefix(row.code);
  let category = categoryFromLegacyType(row.type);
  // The approved structure keeps Cost of Sales inside 5100–5199.
  if (category === AccountCategory.EXPENSE && prefix != null && prefix >= 5100 && prefix <= 5199) {
    category = AccountCategory.COST_OF_SALES;
  }
  const isHeader = row.subtype === 'Group' || row.acceptsNewTransactions === false;
  let behaviour;
  if (CONTROL_CODES.has(row.code)) behaviour = AccountBehaviour.CONTROL;
  else if (SYSTEM_CODES.has(row.code)) behaviour = AccountBehaviour.SYSTEM;
  else if (CONTRA_CODES.has(row.code)) behaviour = AccountBehaviour.CONTRA;
  else if (isHeader) behaviour = AccountBehaviour.HEADER;
  else behaviour = AccountBehaviour.POSTING;

  const subType = subTypeFromBlueprint(row, category);
  const normalBalance = row.normalBalance
    ? (row.normalBalance === 'Credit' ? AccountNormalBalance.CREDIT : AccountNormalBalance.DEBIT)
    : expectedNormalBalance(category, subType);

  const systemPurpose = behaviour === AccountBehaviour.HEADER ? null : (BLUEPRINT_PURPOSES[row.code] ?? null);

  return {
    code: row.code,
    name: row.name,
    description: row.description ?? null,
    parentCode: row.parentCode ?? null,
    category,
    subType,
    behaviour,
    normalBalance,
    systemPurpose,
    controlAccountPurpose: CONTROL_CODES.has(row.code) ? BLUEPRINT_PURPOSES[row.code] ?? null : null,
    financialStatementSection: defaultFinancialStatementSection(category, subType),
    cashFlowClassification: defaultCashFlowClassification({ category, subType, systemPurpose }),
    postingAllowed: behaviour !== AccountBehaviour.HEADER,
    manualPostingAllowed: behaviour === AccountBehaviour.POSTING || behaviour === AccountBehaviour.CONTRA,
    consolidationGroup: row.code === '1590' ? '1500' : row.code === '4110' ? '4100' : row.code === '5120' ? '5110' : null,
  };
}
