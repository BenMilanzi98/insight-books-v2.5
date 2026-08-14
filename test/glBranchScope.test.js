import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGlBranchScope } from '../lib/glBranchScope.js';
import { canonicalJournalEntryWhere } from '../lib/accountingV2/ledger/canonicalJournalSource.js';

test('resolveGlBranchScope includes current branch and unassigned null', () => {
  assert.deepEqual(resolveGlBranchScope(null), { branchId: null, where: {} });
  assert.deepEqual(resolveGlBranchScope('  '), { branchId: null, where: {} });
  assert.deepEqual(resolveGlBranchScope('b1'), {
    branchId: 'b1',
    where: { OR: [{ branchId: 'b1' }, { branchId: null }] },
  });
});

test('canonicalJournalEntryWhere includes null branch when scoped', () => {
  const where = canonicalJournalEntryWhere('t1', { branchId: 'b1' });
  assert.equal(where.tenantId, 't1');
  assert.deepEqual(where.AND, [{ OR: [{ branchId: 'b1' }, { branchId: null }] }]);
  assert.equal(where.branchId, undefined);
});
