import { describe, it, expect } from 'vitest';
import { accountsFor3100CapitalDropdown } from '../lib/coaSystemStructureTree.js';

describe('reportGlAccountLines helpers', () => {
  it('accountsFor3100CapitalDropdown excludes children already under 3100', () => {
    const accounts = [
      { id: 'cap', accountCode: '3100', parentAccountId: null },
      { id: 'c3101', accountCode: '3101', parentAccountId: 'cap', currentBalance: 1000 },
      { id: 'orphan', accountCode: '3105', parentAccountId: null, currentBalance: 500 },
    ];
    const bucket = accountsFor3100CapitalDropdown(accounts);
    expect(bucket.map((a) => a.id)).toEqual(['orphan']);
  });
});
