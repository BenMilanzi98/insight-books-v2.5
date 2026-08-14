import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BF_PRIMARY_BTN_CLASS,
  BF_PRIMARY_SUCCESS_BTN_CLASS,
  BF_TAB_ACTIVE_CLASS,
  BF_THEAD_CLASS,
} from '../components/budget-forecast/bfVisualClasses.js';

test('BF primary classes use POS gradients, not slate-900', () => {
  assert.match(BF_PRIMARY_BTN_CLASS, /from-blue-600/);
  assert.match(BF_PRIMARY_SUCCESS_BTN_CLASS, /from-green-600/);
  assert.match(BF_TAB_ACTIVE_CLASS, /from-blue-600/);
  assert.match(BF_THEAD_CLASS, /from-gray-50/);
  for (const c of [BF_PRIMARY_BTN_CLASS, BF_PRIMARY_SUCCESS_BTN_CLASS, BF_TAB_ACTIVE_CLASS]) {
    assert.doesNotMatch(c, /slate-900/);
  }
});
