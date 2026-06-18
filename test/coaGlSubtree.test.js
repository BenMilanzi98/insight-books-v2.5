import { describe, it, expect } from 'vitest';
import {
  matchesFallbackSubtree,
  primaryNumericCode,
  GL_SUBTREE_ROOT_ASSETS,
  GL_SUBTREE_ROOT_LIABILITIES,
} from '../lib/coaGlSubtreeValidation.js';
import { applyCoaParentRollup, applyLiabilityRegisterCoaSubtree } from '../lib/coaChartRollup.js';

describe('coaGlSubtreeValidation fallbacks', () => {
  it('primaryNumericCode parses hierarchical codes', () => {
    expect(primaryNumericCode('1510')).toBe(1510);
    expect(primaryNumericCode('1131')).toBe(1131);
  });

  it('matchesFallbackSubtree for 1500 uses Asset 1500–1599', () => {
    expect(matchesFallbackSubtree(GL_SUBTREE_ROOT_ASSETS, '1510', 'Asset')).toBe(true);
    expect(matchesFallbackSubtree(GL_SUBTREE_ROOT_ASSETS, '1600', 'Asset')).toBe(false);
    expect(matchesFallbackSubtree(GL_SUBTREE_ROOT_ASSETS, '1510', 'Liability')).toBe(false);
  });

  it('matchesFallbackSubtree for 2000 uses Liability 2000–2999', () => {
    expect(matchesFallbackSubtree(GL_SUBTREE_ROOT_LIABILITIES, '2110', 'Liability')).toBe(true);
    expect(matchesFallbackSubtree(GL_SUBTREE_ROOT_LIABILITIES, '3000', 'Liability')).toBe(false);
    expect(matchesFallbackSubtree(GL_SUBTREE_ROOT_LIABILITIES, '2110', 'Asset')).toBe(false);
  });
});

describe('applyLiabilityRegisterCoaSubtree', () => {
  it('adds active liability balance to assigned leaf when postedEntryCount is 0', () => {
    const leafId = 'leaf-liab';
    const accounts = [
      {
        id: 'root',
        parentAccountId: null,
        accountCode: '2000',
        accountType: 'Liability',
        postedDirectBalance: 0,
        postedEntryCount: 0,
        currentBalance: 0,
      },
      {
        id: leafId,
        parentAccountId: 'root',
        accountCode: '2110',
        accountType: 'Liability',
        postedDirectBalance: 0,
        postedEntryCount: 0,
        currentBalance: 0,
      },
    ];
    const liabilities = [
      { glAccountId: leafId, currentBalance: 500, status: 'active' },
    ];
    const merged = applyLiabilityRegisterCoaSubtree(accounts, liabilities);
    const leaf = merged.find((a) => a.id === leafId);
    expect(leaf.postedDirectBalance).toBe(500);
    expect(leaf.balanceSource).toBe('liability_register_overlay');
  });

  it('skips overlay when target account already has posted GL', () => {
    const leafId = 'leaf-busy';
    const accounts = [
      {
        id: leafId,
        parentAccountId: null,
        accountCode: '2110',
        accountType: 'Liability',
        postedDirectBalance: 100,
        postedEntryCount: 3,
        currentBalance: 100,
      },
    ];
    const liabilities = [{ glAccountId: leafId, currentBalance: 500, status: 'active' }];
    const merged = applyLiabilityRegisterCoaSubtree(accounts, liabilities);
    const leaf = merged.find((a) => a.id === leafId);
    expect(leaf.postedDirectBalance).toBe(100);
    expect(leaf.balanceSource).toBeUndefined();
  });

  it('groups multiple liabilities onto same GL leaf', () => {
    const leafId = 'leaf-shared';
    const accounts = [
      {
        id: leafId,
        accountCode: '2110',
        accountType: 'Liability',
        postedDirectBalance: 0,
        postedEntryCount: 0,
        currentBalance: 0,
      },
    ];
    const liabilities = [
      { glAccountId: leafId, currentBalance: 100, status: 'active' },
      { glAccountId: leafId, currentBalance: 250, status: 'active' },
    ];
    const merged = applyLiabilityRegisterCoaSubtree(accounts, liabilities);
    expect(merged.find((a) => a.id === leafId).postedDirectBalance).toBe(350);
  });

  it('rolls null-gl liabilities onto 2000 when root has no GL', () => {
    const rootId = 'l2000';
    const accounts = [
      {
        id: rootId,
        parentAccountId: null,
        accountCode: '2000',
        accountType: 'Liability',
        postedDirectBalance: 0,
        postedEntryCount: 0,
        currentBalance: 0,
      },
    ];
    const liabilities = [{ glAccountId: null, currentBalance: 999, status: 'active' }];
    const merged = applyLiabilityRegisterCoaSubtree(accounts, liabilities);
    const root = merged.find((a) => a.id === rootId);
    expect(root.postedDirectBalance).toBe(999);
    const rolled = applyCoaParentRollup(merged);
    expect(rolled.find((a) => a.id === rootId).currentBalance).toBe(999);
  });
});
