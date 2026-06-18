import { describe, it, expect } from 'vitest';
import {
  isCashOrBankGlAccount,
  isCashAccountCodeForBalanceSheet,
  isBankMobileGlCode,
} from '../lib/cashAccountCoa.js';

describe('isCashAccountCodeForBalanceSheet', () => {
  it('includes 1110 and Malawi bank codes', () => {
    expect(isCashAccountCodeForBalanceSheet('1110')).toBe(true);
    expect(isCashAccountCodeForBalanceSheet('1131')).toBe(true);
    expect(isCashAccountCodeForBalanceSheet('1540')).toBe(false);
  });
});

describe('isBankMobileGlCode', () => {
  it('identifies bank and mobile wallet codes', () => {
    expect(isBankMobileGlCode('1132')).toBe(true);
    expect(isBankMobileGlCode('1140')).toBe(true);
    expect(isBankMobileGlCode('1130')).toBe(false);
  });
});

describe('isCashOrBankGlAccount', () => {
  it('rejects structural rows', () => {
    expect(isCashOrBankGlAccount({ accountCode: '1000', accountType: 'Asset' })).toBe(false);
    expect(isCashOrBankGlAccount({ accountCode: '1110', accountType: 'Asset' })).toBe(true);
  });
});
