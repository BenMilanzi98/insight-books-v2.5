import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAX_PERIOD_STATUS,
  TAX_RETURN_STATUS,
  TAX_PAYMENT_STATUS,
  TAX_CREDIT_STATUS,
} from '../lib/taxManagement/periodStatuses.js';
import { buildMonthlyPeriodBounds } from '../lib/taxManagement/taxPeriodService.js';
import { TAX_PURPOSE_LIST } from '../lib/taxManagement/purposes.js';

test('tax period/return/payment statuses are stable', () => {
  assert.equal(TAX_PERIOD_STATUS.OPEN, 'OPEN');
  assert.equal(TAX_PERIOD_STATUS.FILED, 'FILED');
  assert.equal(TAX_RETURN_STATUS.DRAFT, 'DRAFT');
  assert.equal(TAX_RETURN_STATUS.FILED, 'FILED');
  assert.equal(TAX_PAYMENT_STATUS.POSTED, 'POSTED');
  assert.equal(TAX_CREDIT_STATUS.OPEN, 'OPEN');
});

test('monthly period bounds cover full calendar month', () => {
  const { start, end, code } = buildMonthlyPeriodBounds(2026, 6); // July
  assert.equal(code, '2026-07');
  assert.equal(start.getDate(), 1);
  assert.equal(end.getMonth(), 6);
  assert.ok(end.getDate() >= 31);
});

test('import purposes catalogue is non-empty', () => {
  assert.ok(TAX_PURPOSE_LIST.length >= 4);
  assert.ok(TAX_PURPOSE_LIST.includes('VAT_OUTPUT'));
});
