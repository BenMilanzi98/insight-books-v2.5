import { describe, it, expect } from 'vitest';
import {
  percentToMinor,
  minorToPercentString,
  assertOwnershipTotalWithinLimit,
  shareCapitalAndPremium,
  ONE_HUNDRED_PERCENT_MINOR,
} from '../lib/equityManagement/domain/ownershipPercent.js';
import { EquityTransactionType, LegalStructure } from '../lib/equityManagement/domain/enums.js';
import { EQUITY_PERMISSIONS } from '../lib/equityManagement/permissions.js';

describe('ownership percentages (exact)', () => {
  it('round-trips percentages without float drift', () => {
    expect(percentToMinor('33.33333333')).toBe(3333333333);
    expect(minorToPercentString(3333333333)).toBe('33.33333333');
  });

  it('rejects totals above 100%', () => {
    expect(() =>
      assertOwnershipTotalWithinLimit([
        percentToMinor('60'),
        percentToMinor('50'),
      ])
    ).toThrow(/exceeds 100/);
  });

  it('allows exact 100%', () => {
    const total = assertOwnershipTotalWithinLimit([
      percentToMinor('40'),
      percentToMinor('60'),
    ]);
    expect(total).toBe(ONE_HUNDRED_PERCENT_MINOR);
  });
});

describe('share capital / premium split', () => {
  it('separates nominal and premium', () => {
    const split = shareCapitalAndPremium({
      quantity: 1000,
      nominalValue: 100,
      issuePrice: 150,
    });
    expect(split.shareCapital).toBe('100000.00');
    expect(split.premium).toBe('50000.00');
    expect(split.totalConsideration).toBe('150000.00');
  });

  it('rejects issue below nominal', () => {
    expect(() =>
      shareCapitalAndPremium({ quantity: 10, nominalValue: 100, issuePrice: 90 })
    ).toThrow(/below nominal/);
  });
});

describe('equity catalogue', () => {
  it('exposes contribution and drawing types', () => {
    expect(EquityTransactionType.CAPITAL_CONTRIBUTION).toBeTruthy();
    expect(EquityTransactionType.OWNER_DRAWING).toBeTruthy();
    expect(EquityTransactionType.OWNER_LOAN_ADVANCE).toBeTruthy();
    expect(LegalStructure.SOLE_PROPRIETORSHIP).toBeTruthy();
  });

  it('exposes RBAC keys', () => {
    expect(EQUITY_PERMISSIONS.POST_CONTRIBUTION).toBe('equity.postContribution');
    expect(EQUITY_PERMISSIONS.DECLARE_DIVIDEND).toBe('equity.declareDividend');
  });
});
