import { describe, expect, it } from 'vitest';
import {
  BF_PRIMARY_BTN_CLASS,
  BF_PRIMARY_SUCCESS_BTN_CLASS,
  BF_TAB_ACTIVE_CLASS,
  BF_THEAD_CLASS,
  BF_CARD_CLASS,
} from '../components/budget-forecast/bfVisualClasses.js';
import { reportNeedsBudget, reportNeedsForecast } from '../lib/budgetForecast/reportFilterConfig.js';

describe('BF studio visual tokens', () => {
  it('matches P&L chrome instead of POS gradients', () => {
    expect(BF_PRIMARY_BTN_CLASS).toMatch(/bg-emerald-600/);
    expect(BF_PRIMARY_SUCCESS_BTN_CLASS).toMatch(/bg-emerald-600/);
    expect(BF_TAB_ACTIVE_CLASS).toMatch(/bg-blue-600/);
    expect(BF_THEAD_CLASS).toMatch(/border-blue-600/);
    expect(BF_CARD_CLASS).toMatch(/border-slate-200/);
    for (const c of [BF_PRIMARY_BTN_CLASS, BF_TAB_ACTIVE_CLASS, BF_THEAD_CLASS]) {
      expect(c).not.toMatch(/from-blue-600|from-green-600|from-gray-50/);
    }
  });
});

describe('BF report filter requirements', () => {
  it('requires the matching plan document', () => {
    expect(reportNeedsBudget('BVA')).toBe(true);
    expect(reportNeedsBudget('FVA')).toBe(false);
    expect(reportNeedsForecast('CASH_OUTLOOK')).toBe(true);
    expect(reportNeedsForecast('BVA')).toBe(false);
  });
});
