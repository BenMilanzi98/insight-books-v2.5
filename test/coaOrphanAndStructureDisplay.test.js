import { describe, it, expect } from 'vitest';
import { reattachOrphanParentsForCoaRollup } from '../lib/coaOrphanParentAttach.js';
import { structureNodeBalanceBreakdown } from '../lib/coaStructureDisplayBalance.js';

describe('reattachOrphanParentsForCoaRollup', () => {
  it('reattaches child when immediate parent missing from list but ancestor present', () => {
    const accounts = [
      { id: 'r2000', parentAccountId: null, accountCode: '2000' },
      { id: 'leaf', parentAccountId: 'missing2100', accountCode: '2110' },
    ];
    const parentOf = new Map([
      ['missing2100', 'r2000'],
      ['r2000', null],
      ['leaf', 'missing2100'],
    ]);
    const out = reattachOrphanParentsForCoaRollup(accounts, parentOf);
    const leaf = out.find((a) => a.id === 'leaf');
    expect(leaf.parentAccountId).toBe('r2000');
  });

  it('leaves row unchanged when parent is in list', () => {
    const accounts = [
      { id: 'p', parentAccountId: null },
      { id: 'c', parentAccountId: 'p' },
    ];
    const parentOf = new Map([
      ['p', null],
      ['c', 'p'],
    ]);
    const out = reattachOrphanParentsForCoaRollup(accounts, parentOf);
    expect(out.find((a) => a.id === 'c').parentAccountId).toBe('p');
  });

  it('returns same reference row when no fix needed', () => {
    const accounts = [{ id: 'only', parentAccountId: null }];
    const parentOf = new Map([['only', null]]);
    const out = reattachOrphanParentsForCoaRollup(accounts, parentOf);
    expect(out[0]).toBe(accounts[0]);
  });
});

describe('structureNodeBalanceBreakdown', () => {
  it('uses sum of children when no ledger row exists for intermediate code', () => {
    const node2100 = {
      code: '2100',
      children: [
        { code: '2110', children: [] },
        { code: '2120', children: [] },
      ],
    };
    const accountsByCode = new Map([
      ['2110', [{ id: 'a', accountCode: '2110', currentBalance: 40, isActive: true }]],
      ['2120', [{ id: 'b', accountCode: '2120', currentBalance: 60, isActive: true }]],
    ]);
    const memo = new Map();
    const bd = structureNodeBalanceBreakdown(node2100, accountsByCode, {}, true, memo);
    expect(bd.display).toBe(100);
    expect(bd.leafSelf).toBe(0);
    expect(bd.childrenSum).toBe(100);
  });

  it('uses rolled row when ledger matches exist for code', () => {
    const node2000 = {
      code: '2000',
      children: [{ code: '2110', children: [] }],
    };
    const accountsByCode = new Map([
      ['2000', [{ id: 'r', accountCode: '2000', currentBalance: 500, isActive: true }]],
      ['2110', [{ id: 'l', accountCode: '2110', currentBalance: 100, isActive: true }]],
    ]);
    const memo = new Map();
    const bd = structureNodeBalanceBreakdown(node2000, accountsByCode, {}, true, memo);
    expect(bd.display).toBe(500);
    expect(bd.leafSelf).toBe(500);
    expect(bd.childrenSum).toBe(100);
  });
});
