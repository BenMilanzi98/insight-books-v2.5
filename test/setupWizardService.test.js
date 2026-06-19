import { describe, it, expect } from 'vitest';
import { effectiveStepStatus } from '../lib/setupWizardService.js';

describe('setup wizard openingStock step', () => {
  const emptyState = { completed: {}, skipped: {} };

  it('is complete when tenant has stocked products', () => {
    expect(
      effectiveStepStatus('openingStock', emptyState, {
        hasOpeningStock: true,
        stockedProductCount: 3,
        stockInMovementCount: 0,
      })
    ).toBe('complete');
  });

  it('is complete when tenant has Stock In movements only', () => {
    expect(
      effectiveStepStatus('openingStock', emptyState, {
        hasOpeningStock: true,
        stockedProductCount: 0,
        stockInMovementCount: 2,
      })
    ).toBe('complete');
  });

  it('stays pending with no inventory activity', () => {
    expect(
      effectiveStepStatus('openingStock', emptyState, {
        hasOpeningStock: false,
        stockedProductCount: 0,
        stockInMovementCount: 0,
      })
    ).toBe('pending');
  });
});
