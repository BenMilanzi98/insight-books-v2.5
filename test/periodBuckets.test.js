import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPeriodBuckets, alignPeriodAmounts } from '../lib/accountingV2/reporting/periodBuckets.js';

test('buildPeriodBuckets months for Jan–Mar', () => {
  const buckets = buildPeriodBuckets(new Date(2025, 0, 1), new Date(2025, 2, 31), 'MONTH');
  assert.equal(buckets.length, 3);
  assert.equal(buckets[0].key, '2025-01');
  assert.equal(buckets[2].key, '2025-03');
  assert.match(buckets[0].label, /Jan/);
});

test('buildPeriodBuckets quarters for full year', () => {
  const buckets = buildPeriodBuckets(new Date(2025, 0, 1), new Date(2025, 11, 31), 'QUARTER');
  assert.equal(buckets.length, 4);
  assert.deepEqual(
    buckets.map((b) => b.key),
    ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4']
  );
});

test('alignPeriodAmounts fills zeros', () => {
  const aligned = alignPeriodAmounts(['a', 'b'], { a: 150 });
  assert.equal(aligned[0].amount.minor, 150);
  assert.equal(aligned[1].amount.minor, 0);
  assert.equal(aligned[0].amount.decimal, '1.50');
});
