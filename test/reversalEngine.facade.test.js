/**
 * Unit tests for Reversal Engine façade helpers / permission dual-run aliases.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { permissionsToCheck } from '../lib/permissionAliases.js';
import { PERIOD_POLICY, REVERSAL_STATUS, SOURCE_TYPES } from '../lib/reversals/constants.js';

test('taxManagement.* aliases to tax.* and reverse', () => {
  assert.deepEqual(permissionsToCheck('taxManagement.view'), [
    'taxManagement.view',
    'tax.view',
  ]);
  assert.deepEqual(permissionsToCheck('tax.settle'), [
    'tax.settle',
    'taxManagement.settle',
  ]);
});

test('reversal engine constants are stable', () => {
  assert.equal(
    PERIOD_POLICY.REVERSE_IN_CURRENT_OPEN_PERIOD,
    'REVERSE_IN_CURRENT_OPEN_PERIOD'
  );
  assert.ok(SOURCE_TYPES.includes('Invoice'));
  assert.ok(SOURCE_TYPES.includes('Sale'));
  assert.equal(REVERSAL_STATUS.COMPLETED, 'COMPLETED');
  assert.equal(REVERSAL_STATUS.REQUESTED, 'REQUESTED');
});
