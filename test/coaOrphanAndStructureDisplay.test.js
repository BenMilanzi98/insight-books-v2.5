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

  it('keeps legacy unrolled rows compatible by adding visible children', () => {
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
    expect(bd.display).toBe(600);
    expect(bd.leafSelf).toBe(500);
    expect(bd.childrenSum).toBe(100);
  });

  it('does not add children again when the API row is already rolled up', () => {
    const stock = 11_037_070;
    const node1300 = {
      code: '1300',
      children: [
        { code: '1310', children: [] },
        { code: '1320', children: [] },
        { code: '1330', children: [] },
      ],
    };
    const accountsByCode = new Map([
      [
        '1300',
        [
          {
            id: 'inv',
            accountCode: '1300',
            currentBalance: stock,
            postedDirectBalance: 0,
            balanceSource: 'none',
            isActive: true,
          },
        ],
      ],
      [
        '1310',
        [
          {
            id: 'soh',
            accountCode: '1310',
            currentBalance: stock,
            postedDirectBalance: stock,
            balanceSource: 'inventory_subledger',
            isActive: true,
          },
        ],
      ],
      ['1320', [{ id: 'raw', accountCode: '1320', currentBalance: 0, postedDirectBalance: 0, isActive: true }]],
      ['1330', [{ id: 'git', accountCode: '1330', currentBalance: 0, postedDirectBalance: 0, isActive: true }]],
    ]);
    const bd = structureNodeBalanceBreakdown(node1300, accountsByCode, {}, true, new Map());
    expect(bd.display).toBe(stock);
    expect(bd.childrenSum).toBe(stock);
  });

  it('uses rolled parent totals with legitimate direct postings only once', () => {
    const node = {
      code: '5200',
      children: [
        { code: '5201', children: [] },
        { code: '5202', children: [] },
      ],
    };
    const accountsByCode = new Map([
      [
        '5200',
        [
          {
            id: 'wages',
            accountCode: '5200',
            currentBalance: 125,
            postedDirectBalance: 25,
            balanceSource: 'posted_gl',
            isActive: true,
          },
        ],
      ],
      ['5201', [{ id: 'admin', accountCode: '5201', currentBalance: 40, postedDirectBalance: 40, isActive: true }]],
      ['5202', [{ id: 'sales', accountCode: '5202', currentBalance: 60, postedDirectBalance: 60, isActive: true }]],
    ]);
    const bd = structureNodeBalanceBreakdown(node, accountsByCode, {}, true, new Map());
    expect(bd.display).toBe(125);
    expect(bd.childrenSum).toBe(100);
  });

  it('does not multiply nested server rollups across parent, child, and grandchild rows', () => {
    const node = {
      code: '1000',
      children: [
        {
          code: '1100',
          children: [{ code: '1110', children: [] }],
        },
      ],
    };
    const accountsByCode = new Map([
      ['1000', [{ id: 'assets', accountCode: '1000', currentBalance: 140, postedDirectBalance: 0, isActive: true }]],
      ['1100', [{ id: 'current', accountCode: '1100', currentBalance: 140, postedDirectBalance: 0, isActive: true }]],
      ['1110', [{ id: 'cash', accountCode: '1110', currentBalance: 140, postedDirectBalance: 140, isActive: true }]],
    ]);
    const bd = structureNodeBalanceBreakdown(node, accountsByCode, {}, true, new Map());
    expect(bd.display).toBe(140);
    expect(bd.childrenSum).toBe(140);
  });

  it('keeps zero-balance parent and child rows at zero', () => {
    const node = {
      code: '2500',
      children: [{ code: '2510', children: [] }],
    };
    const accountsByCode = new Map([
      ['2500', [{ id: 'lt', accountCode: '2500', currentBalance: 0, postedDirectBalance: 0, isActive: true }]],
      ['2510', [{ id: 'loan', accountCode: '2510', currentBalance: 0, postedDirectBalance: 0, isActive: true }]],
    ]);
    const bd = structureNodeBalanceBreakdown(node, accountsByCode, {}, true, new Map());
    expect(bd.display).toBe(0);
    expect(bd.childrenSum).toBe(0);
  });
});
