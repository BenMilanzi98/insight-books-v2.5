import { describe, it, expect } from 'vitest';
import { assertBudgetTransition, BUDGET_STATUS } from '../../lib/budgetForecast/domain/budgetStates.js';

describe('budget command security (domain)', () => {
  it('blocks DRAFT → ACTIVE (approve bypass)', () => {
    expect(() => assertBudgetTransition(BUDGET_STATUS.DRAFT, BUDGET_STATUS.ACTIVE)).toThrow(
      /Invalid budget transition/
    );
  });

  it('blocks LOCKED → DRAFT (unlock must go ACTIVE)', () => {
    expect(() => assertBudgetTransition(BUDGET_STATUS.LOCKED, BUDGET_STATUS.DRAFT)).toThrow(
      /Invalid budget transition/
    );
  });

  it('allows LOCKED → ACTIVE unlock path', () => {
    expect(assertBudgetTransition(BUDGET_STATUS.LOCKED, BUDGET_STATUS.ACTIVE)).toBe('ACTIVE');
  });
});
