import { describe, it, expect } from 'vitest';
import {
  projectForecastAmount,
  scenarioFactorFor,
  FORECAST_METHODS,
} from '@/lib/budgetForecast/domain/forecastProjection.js';

describe('projectForecastAmount', () => {
  it('run-rate / historical average scales monthly average to horizon', () => {
    expect(
      projectForecastAmount({
        method: FORECAST_METHODS.CURRENT_RUN_RATE,
        historical: 1200,
        actualsMonths: 12,
        periodsCount: 6,
      })
    ).toBe(600);

    expect(
      projectForecastAmount({
        method: FORECAST_METHODS.HISTORICAL_AVERAGE,
        historical: 1200,
        actualsMonths: 12,
        periodsCount: 3,
      })
    ).toBe(300);
  });

  it('budget remainder is max(0, budget - historical)', () => {
    expect(
      projectForecastAmount({
        method: FORECAST_METHODS.BUDGET_REMAINDER,
        historical: 400,
        budgetAmt: 1000,
        periodsCount: 12,
      })
    ).toBe(600);

    expect(
      projectForecastAmount({
        method: FORECAST_METHODS.BUDGET_REMAINDER,
        historical: 1500,
        budgetAmt: 1000,
      })
    ).toBe(0);
  });

  it('recurring uses fixed monthly or last-period average', () => {
    expect(
      projectForecastAmount({
        method: FORECAST_METHODS.RECURRING,
        recurringAmount: 100,
        periodsCount: 12,
      })
    ).toBe(1200);

    expect(
      projectForecastAmount({
        method: FORECAST_METHODS.RECURRING,
        historical: 600,
        actualsMonths: 6,
        periodsCount: 3,
      })
    ).toBe(300);
  });

  it('manual always projects zero before grid edit', () => {
    expect(
      projectForecastAmount({
        method: FORECAST_METHODS.MANUAL,
        historical: 999,
        budgetAmt: 5000,
        periodsCount: 12,
      })
    ).toBe(0);
  });

  it('applies growth and scenario factor', () => {
    expect(
      projectForecastAmount({
        method: FORECAST_METHODS.CURRENT_RUN_RATE,
        historical: 1000,
        actualsMonths: 10,
        periodsCount: 10,
        growthPercent: 10,
        scenarioFactor: 1.1,
      })
    ).toBe(1210);
  });

  it('open receivables/payables use scheduled total', () => {
    expect(
      projectForecastAmount({
        method: FORECAST_METHODS.OPEN_RECEIVABLES,
        openScheduledTotal: 500,
        periodsCount: 6,
      })
    ).toBe(500);
  });
});

describe('scenarioFactorFor', () => {
  it('maps scenario types', () => {
    expect(scenarioFactorFor('BASE_CASE')).toBe(1);
    expect(scenarioFactorFor('BEST_CASE')).toBe(1.1);
    expect(scenarioFactorFor('WORST_CASE')).toBe(0.9);
  });
});
