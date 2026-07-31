import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyPeriodBounds } from '../lib/taxManagement/taxPeriodService.js';
import { TAX_PURPOSE_LIST } from '../lib/taxManagement/purposes.js';
import { REVERSAL_STATUS, SOURCE_TYPES } from '../lib/reversals/constants.js';

test('backfill module exports function', async () => {
  const mod = await import('../lib/taxManagement/taxSubledgerBackfill.js');
  assert.equal(typeof mod.backfillTaxTransactions, 'function');
});

test('supersession module exports function', async () => {
  const mod = await import('../lib/taxManagement/taxCodeSupersession.js');
  assert.equal(typeof mod.supersedeTaxType, 'function');
});

test('reconciliation suite export exists', async () => {
  const mod = await import('../lib/taxManagement/reconciliationEngine.js');
  assert.equal(typeof mod.runTaxReconciliationSuite, 'function');
  assert.equal(typeof mod.reconcileReversalJournalLinkage, 'function');
});

test('reversal source types cover core documents', () => {
  for (const t of ['Invoice', 'Expense', 'Payment', 'Sale']) {
    assert.ok(SOURCE_TYPES.includes(t), t);
  }
  assert.equal(REVERSAL_STATUS.COMPLETED, 'COMPLETED');
});

test('period bounds and purposes still stable', () => {
  const { code } = buildMonthlyPeriodBounds(2026, 0);
  assert.equal(code, '2026-01');
  assert.ok(TAX_PURPOSE_LIST.includes('VAT_INPUT'));
});
