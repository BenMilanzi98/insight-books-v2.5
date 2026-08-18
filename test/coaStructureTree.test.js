import { describe, it, expect } from 'vitest';
import {
  buildStructureTreeFromBlueprint,
  SYSTEM_COA_STRUCTURE,
  flattenStructureCodes,
  accountsForCatchAllDropdown,
} from '../lib/coaSystemStructureTree.js';
import { CHART_OF_ACCOUNTS_BLUEPRINT } from '../lib/chartOfAccountsBlueprint.js';

describe('buildStructureTreeFromBlueprint', () => {
  it('includes every blueprint code in the structure tree', () => {
    const flat = flattenStructureCodes(buildStructureTreeFromBlueprint());
    const blueprintCodes = CHART_OF_ACCOUNTS_BLUEPRINT.map((r) => r.code);
    for (const code of blueprintCodes) {
      expect(flat.has(code), `missing structure node for ${code}`).toBe(true);
    }
  });

  it('places Water (5316), Travel (5340), and GRNI (2115) as structure rows not catch-all', () => {
    const flat = flattenStructureCodes(SYSTEM_COA_STRUCTURE);
    expect(flat.has('5316')).toBe(true);
    expect(flat.has('5340')).toBe(true);
    expect(flat.has('2115')).toBe(true);

    const accounts = [
      { accountCode: '5316', accountType: 'Expense' },
      { accountCode: '5340', accountType: 'Expense' },
      { accountCode: '2115', accountType: 'Liability' },
      { accountCode: '5950', accountType: 'Expense' },
    ];
    expect(accountsForCatchAllDropdown(accounts, '5900').map((a) => a.accountCode)).toEqual(['5950']);
    expect(accountsForCatchAllDropdown(accounts, '2999').map((a) => a.accountCode)).toEqual([]);
  });
});
