import { describe, it, expect } from 'vitest';
import {
  BUDGET_STATUS,
  assertBudgetTransition,
  assertTransition,
  canEditBudget,
  allowedBudgetTransitions,
} from '../../lib/budgetForecast/domain/budgetStates.js';
import {
  FORECAST_STATUS,
  assertForecastTransition,
} from '../../lib/budgetForecast/domain/forecastStates.js';

describe('budget state machine', () => {
  it('allows the happy path', () => {
    expect(assertBudgetTransition(BUDGET_STATUS.DRAFT, BUDGET_STATUS.IN_PREPARATION)).toBe(
      BUDGET_STATUS.IN_PREPARATION
    );
    expect(assertTransition(BUDGET_STATUS.IN_PREPARATION, BUDGET_STATUS.READY_FOR_REVIEW)).toBe(
      BUDGET_STATUS.READY_FOR_REVIEW
    );
    assertBudgetTransition(BUDGET_STATUS.READY_FOR_REVIEW, BUDGET_STATUS.IN_REVIEW);
    assertBudgetTransition(BUDGET_STATUS.IN_REVIEW, BUDGET_STATUS.APPROVED);
    assertBudgetTransition(BUDGET_STATUS.APPROVED, BUDGET_STATUS.ACTIVE);
    assertBudgetTransition(BUDGET_STATUS.ACTIVE, BUDGET_STATUS.LOCKED);
  });

  it('rejects illegal transitions', () => {
    expect(() => assertBudgetTransition(BUDGET_STATUS.DRAFT, BUDGET_STATUS.ACTIVE)).toThrow(
      /Invalid budget transition/
    );
    expect(() => assertBudgetTransition(BUDGET_STATUS.LOCKED, BUDGET_STATUS.DRAFT)).toThrow(
      /Invalid budget transition/
    );
  });

  it('marks only draft-like statuses editable', () => {
    expect(canEditBudget(BUDGET_STATUS.DRAFT)).toBe(true);
    expect(canEditBudget(BUDGET_STATUS.IN_PREPARATION)).toBe(true);
    expect(canEditBudget(BUDGET_STATUS.CHANGES_REQUESTED)).toBe(true);
    expect(canEditBudget(BUDGET_STATUS.ACTIVE)).toBe(false);
    expect(canEditBudget(BUDGET_STATUS.LOCKED)).toBe(false);
  });

  it('lists allowed transitions', () => {
    expect(allowedBudgetTransitions(BUDGET_STATUS.IN_REVIEW)).toContain(BUDGET_STATUS.APPROVED);
    expect(allowedBudgetTransitions(BUDGET_STATUS.ARCHIVED)).toEqual([]);
  });
});

describe('forecast state machine', () => {
  it('allows generate → review → approve', () => {
    assertForecastTransition(FORECAST_STATUS.DRAFT, FORECAST_STATUS.GENERATING);
    assertForecastTransition(FORECAST_STATUS.GENERATING, FORECAST_STATUS.GENERATED);
    assertForecastTransition(FORECAST_STATUS.GENERATED, FORECAST_STATUS.IN_REVIEW);
    assertForecastTransition(FORECAST_STATUS.IN_REVIEW, FORECAST_STATUS.APPROVED);
  });

  it('rejects approve from draft', () => {
    expect(() =>
      assertForecastTransition(FORECAST_STATUS.DRAFT, FORECAST_STATUS.APPROVED)
    ).toThrow(/Invalid forecast transition/);
  });
});
