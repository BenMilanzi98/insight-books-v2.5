import { describe, it, expect } from 'vitest';
import {
  applyCoaParentRollup,
  applyStockLedInventoryCoaSubtree,
  foldCatchAllBucketTotalsIntoPostedDirect,
  apply3100CapitalBucketAncestorPropagation,
} from '../lib/coaChartRollup.js';
import {
  structureRowDisplayBalance,
  COA_STRUCTURE_CODES_WITH_SERVER_FOLDED_BUCKETS,
} from '../lib/coaSystemStructureTree.js';
import { sumPhysicalInventoryProductLines, productLineValue } from '../lib/stockValuationAggregate.js';

describe('applyCoaParentRollup', () => {
  it('sums children plus direct posted balance', () => {
    const accounts = [
      {
        id: 'p',
        parentAccountId: null,
        accountCode: '1000',
        postedDirectBalance: 0,
        currentBalance: 0,
      },
      {
        id: 'c1',
        parentAccountId: 'p',
        accountCode: '1100',
        postedDirectBalance: 40,
        currentBalance: 40,
      },
      {
        id: 'c2',
        parentAccountId: 'p',
        accountCode: '1200',
        postedDirectBalance: 60,
        currentBalance: 60,
      },
    ];
    const rolled = applyCoaParentRollup(accounts);
    const p = rolled.find((a) => a.id === 'p');
    expect(p.currentBalance).toBe(100);
  });

  it('zeros direct on 3100 when children exist', () => {
    const accounts = [
      { id: 'eq', parentAccountId: null, accountCode: '3000', postedDirectBalance: 0 },
      {
        id: 'cap',
        parentAccountId: 'eq',
        accountCode: '3100',
        postedDirectBalance: 999,
      },
      {
        id: 'sub',
        parentAccountId: 'cap',
        accountCode: '3110',
        postedDirectBalance: 50,
      },
    ];
    const rolled = applyCoaParentRollup(accounts);
    const cap = rolled.find((a) => a.id === 'cap');
    expect(cap.currentBalance).toBe(50);
  });
});

describe('applyStockLedInventoryCoaSubtree', () => {
  it('puts stock total on 1310 leaf when present and no leaf GL weights', () => {
    const accounts = [
      {
        id: 'inv',
        parentAccountId: 'ca',
        accountCode: '1300',
        accountType: 'Asset',
        postedDirectBalance: 0,
      },
      {
        id: 'soh',
        parentAccountId: 'inv',
        accountCode: '1310',
        accountType: 'Asset',
        postedDirectBalance: 0,
      },
      {
        id: 'ca',
        parentAccountId: null,
        accountCode: '1100',
        accountType: 'Asset',
        postedDirectBalance: 0,
      },
    ];
    const adj = applyStockLedInventoryCoaSubtree(accounts, 1234.56);
    const inv = adj.find((a) => a.accountCode === '1300');
    const leaf = adj.find((a) => a.accountCode === '1310');
    expect(inv.postedDirectBalance).toBe(0);
    expect(leaf.postedDirectBalance).toBe(1234.56);
    const rolled = applyCoaParentRollup(adj);
    const invR = rolled.find((a) => a.accountCode === '1300');
    expect(invR.currentBalance).toBeCloseTo(1234.56, 5);
  });
});

describe('foldCatchAllBucketTotalsIntoPostedDirect', () => {
  it('folds orphan bucket into 1999 postedDirectBalance for second rollup', () => {
    const orphan = {
      id: 'o1',
      parentAccountId: null,
      accountCode: '1750',
      accountType: 'Asset',
      postedDirectBalance: 25,
      currentBalance: 25,
    };
    const row1999 = {
      id: 'n1999',
      parentAccountId: 'p1900',
      accountCode: '1999',
      accountType: 'Asset',
      postedDirectBalance: 10,
      currentBalance: 10,
    };
    const p1900 = {
      id: 'p1900',
      parentAccountId: 'p1000',
      accountCode: '1900',
      accountType: 'Asset',
      postedDirectBalance: 0,
      currentBalance: 10,
    };
    const p1000 = {
      id: 'p1000',
      parentAccountId: null,
      accountCode: '1000',
      accountType: 'Asset',
      postedDirectBalance: 0,
      currentBalance: 10,
    };
    const first = applyCoaParentRollup([p1000, p1900, row1999, orphan]);
    const folded = foldCatchAllBucketTotalsIntoPostedDirect(first);
    const second = applyCoaParentRollup(folded);
    const r1999 = second.find((a) => a.accountCode === '1999');
    const r1900 = second.find((a) => a.accountCode === '1900');
    expect(r1999.currentBalance).toBeCloseTo(35, 5);
    expect(r1900.currentBalance).toBeCloseTo(35, 5);
    const r1000b = second.find((a) => a.accountCode === '1000');
    expect(r1000b.currentBalance).toBeCloseTo(35, 5);
  });
});

describe('apply3100CapitalBucketAncestorPropagation', () => {
  it('adds 3101–3199 bucket (non-child lines) to 3100 and equity parent', () => {
    const eq = {
      id: 'eq',
      parentAccountId: null,
      accountCode: '3000',
      postedDirectBalance: 0,
      currentBalance: 0,
    };
    const cap = {
      id: 'cap',
      parentAccountId: 'eq',
      accountCode: '3100',
      postedDirectBalance: 0,
      currentBalance: 0,
    };
    const orphan3105 = {
      id: 'o3105',
      parentAccountId: null,
      accountCode: '3105',
      postedDirectBalance: 40,
      currentBalance: 40,
    };
    const rolled = applyCoaParentRollup([eq, cap, orphan3105]);
    const patched = apply3100CapitalBucketAncestorPropagation(rolled);
    const capRow = patched.find((a) => a.id === 'cap');
    const eqRow = patched.find((a) => a.id === 'eq');
    expect(capRow.currentBalance).toBe(40);
    expect(eqRow.currentBalance).toBe(40);
  });
});

describe('structureRowDisplayBalance', () => {
  it('does not double-add bucket for folded structure codes', () => {
    expect(COA_STRUCTURE_CODES_WITH_SERVER_FOLDED_BUCKETS.has('1999')).toBe(true);
    const bal = structureRowDisplayBalance([{ currentBalance: 99 }], '1999', {
      c1999: [{ currentBalance: 50 }],
    });
    expect(bal).toBe(99);
  });
});

describe('stockValuationAggregate productLineValue', () => {
  it('prefers positive stored totalStockValue over computed', () => {
    const v = productLineValue({
      stockLevel: 2,
      cost: 10,
      totalStockValue: 500,
      averageCost: null,
      lastPurchaseCost: null,
    });
    expect(v).toBe(500);
  });
});

describe('sumPhysicalInventoryProductLines', () => {
  it('sums product lines', () => {
    const t = sumPhysicalInventoryProductLines([
      { stockLevel: 1, cost: 10, totalStockValue: null },
      { stockLevel: 2, cost: 5, totalStockValue: null },
    ]);
    expect(t).toBe(20);
  });
});
