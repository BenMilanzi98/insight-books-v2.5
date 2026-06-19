import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTaxRate } from '../lib/taxRateValidation.js';

test('validateTaxRate accepts percentage rates including fractional', () => {
  assert.deepEqual(validateTaxRate(17.5, 'Percentage'), { ok: true, value: 17.5 });
  assert.deepEqual(validateTaxRate('0.05', 'Percentage'), { ok: true, value: 0.05 });
});

test('validateTaxRate rejects invalid percentage', () => {
  assert.equal(validateTaxRate(101, 'Percentage').ok, false);
  assert.equal(validateTaxRate(-1, 'Percentage').ok, false);
});

test('validateTaxRate accepts large fixed amounts', () => {
  assert.deepEqual(validateTaxRate(50000, 'Fixed'), { ok: true, value: 50000 });
});
