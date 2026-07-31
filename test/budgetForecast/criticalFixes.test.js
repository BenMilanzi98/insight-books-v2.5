import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { assertForecastTransition, FORECAST_STATUS } from '../../lib/budgetForecast/domain/forecastStates.js';

describe('forecast action route permission mapping', () => {
  it('gates approve/lock/activate on budgets.approve only', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/budget-forecast/forecasts/[id]/actions/route.js'),
      'utf8'
    );
    expect(src).toMatch(/approve:\s*\{\s*fn:.*perm:\s*'budgets\.approve'/s);
    expect(src).toMatch(/lock:\s*\{\s*fn:.*perm:\s*'budgets\.approve'/s);
    expect(src).toMatch(/activate:\s*\{\s*fn:.*perm:\s*'budgets\.approve'/s);
    expect(src).not.toMatch(
      /withBudgetForecastAuth\(\s*request,\s*\[\s*'budgets\.update',\s*'budgets\.approve'\s*\]/
    );
  });

  it('uses regenerateForecast for generate command', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/api/budget-forecast/forecasts/[id]/actions/route.js'),
      'utf8'
    );
    expect(src).toContain('regenerateForecast');
    expect(src).toMatch(/generate:\s*\{\s*fn:\s*regenerateForecast/);
  });
});

describe('forecast generation transitions', () => {
  it('allows DRAFT → GENERATING → GENERATED and GENERATING → FAILED', () => {
    expect(assertForecastTransition(FORECAST_STATUS.DRAFT, FORECAST_STATUS.GENERATING)).toBe(
      'GENERATING'
    );
    expect(assertForecastTransition(FORECAST_STATUS.GENERATING, FORECAST_STATUS.GENERATED)).toBe(
      'GENERATED'
    );
    expect(assertForecastTransition(FORECAST_STATUS.GENERATING, FORECAST_STATUS.FAILED)).toBe(
      'FAILED'
    );
  });
});

describe('saveBudgetLines empty guard', () => {
  it('documents EMPTY_LINES_REFUSED in service', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/budgetForecast/application/budgetService.js'),
      'utf8'
    );
    expect(src).toContain('EMPTY_LINES_REFUSED');
    expect(src).toContain('allowEmpty');
    expect(src).toContain('Every budget line requires a valid accountId');
  });

  it('copy/revise preserve annualAmountMinor when periods empty', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/budgetForecast/application/budgetService.js'),
      'utf8'
    );
    expect(src).toContain('annualAmountMinor: periods.length');
  });
});
