import test from 'node:test';
import assert from 'node:assert/strict';
import { TAX_PURPOSE_LIST, TAX_PURPOSES } from '../lib/taxManagement/purposes.js';

test('tax purposes include VAT output/input and payable', () => {
  assert.equal(TAX_PURPOSES.VAT_OUTPUT, 'VAT_OUTPUT');
  assert.equal(TAX_PURPOSES.VAT_INPUT, 'VAT_INPUT');
  assert.ok(TAX_PURPOSE_LIST.includes('TAX_PAYABLE'));
  assert.ok(TAX_PURPOSE_LIST.includes('PRIMARY_BANK'));
});
