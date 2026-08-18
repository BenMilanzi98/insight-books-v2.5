import { describe, it, expect } from 'vitest';
import {
  applyCoaParentRollup,
  applyStockLedInventoryCoaSubtree,
  foldCatchAllBucketTotalsIntoPostedDirect,
  apply3100CapitalBucketAncestorPropagation,
  injectSyntheticDirectPostingLeaves,
} from '../lib/coaChartRollup.js';
import {
  structureRowDisplayBalance,
  COA_STRUCTURE_CODES_WITH_SERVER_FOLDED_BUCKETS,
} from '../lib/coaSystemStructureTree.js';
import { sumPhysicalInventoryProductLines, productLineValue } from '../lib/stockValuationAggregate.js';
import {
  accountsForCatchAllDropdown,
  accountsFor1130ExtraDropdown,
  accountsForPaymentChannelDropdown,
  accountsForTaxParentDropdown,
} from '../lib/coaSystemStructureTree.js';

describe('accountsForCatchAllDropdown (1999)', () => {
  it('excludes inventory 1300–1399 from Other Assets catch-all (e.g. 1312 Stock on Hand)', () => {
    const accounts = [
      { id: 'soh', accountCode: '1312', accountType: 'Asset', currentBalance: 12e6, parentAccountId: 'inv' },
      { id: 'orph', accountCode: '1750', accountType: 'Asset', currentBalance: 100, parentAccountId: null },
    ];
    const c1999 = accountsForCatchAllDropdown(accounts, '1999');
    expect(c1999.map((a) => a.accountCode)).toEqual(['1750']);
  });

  it('excludes current-asset / receivable 1100–1299 from 1999 (e.g. legacy 1111 Cash)', () => {
    const accounts = [{ id: 'c', accountCode: '1111', accountType: 'Asset', currentBalance: -1e6 }];
    expect(accountsForCatchAllDropdown(accounts, '1999')).toHaveLength(0);
  });
});

describe('accountsFor1130ExtraDropdown', () => {
  it('omits 1130-xx rows already parented under Bank - Primary 1130 (avoids double-count on fold)', () => {
    const accounts = [
      { id: 'bank', accountCode: '1130', accountType: 'Asset', parentAccountId: 'ca' },
      { id: 'nb', accountCode: '1130-06', accountType: 'Asset', parentAccountId: 'bank', currentBalance: -600_000 },
      { id: 'orph', accountCode: '1130-99', accountType: 'Asset', parentAccountId: null, currentBalance: -50 },
    ];
    const extra = accountsFor1130ExtraDropdown(accounts);
    expect(extra.map((a) => a.accountCode)).toEqual(['1130-99']);
  });

  it('excludes Malawi channel child codes (1131-01) from 1130 extras bucket', () => {
    const accounts = [
      { id: 'nbm', accountCode: '1131', accountType: 'Asset' },
      { id: 'sub', accountCode: '1131-01', accountType: 'Asset', parentAccountId: 'nbm' },
      { id: 'legacy', accountCode: '1130-99', accountType: 'Asset' },
    ];
    expect(accountsFor1130ExtraDropdown(accounts).map((a) => a.accountCode)).toEqual(['1130-99']);
  });
});

describe('accountsForPaymentChannelDropdown', () => {
  it('lists sub-accounts under a bank channel by code or parent link', () => {
    const accounts = [
      { id: 'nbm', accountCode: '1131', accountType: 'Asset' },
      { id: 'ops', accountCode: '1131-01', accountName: 'Operations', parentAccountId: 'nbm', currentBalance: 250000 },
      { id: 'other', accountCode: '1132-01', accountType: 'Asset', parentAccountId: 'std' },
    ];
    const subs = accountsForPaymentChannelDropdown(accounts, '1131');
    expect(subs.map((a) => a.accountCode)).toEqual(['1131-01']);
  });
});

describe('accountsForTaxParentDropdown', () => {
  it('lists tax child GL accounts under 2041 and 2045', () => {
    const accounts = [
      { id: 'in', accountCode: '2041', accountType: 'Liability' },
      { id: 'vat', accountCode: '2041-01', accountName: 'VAT Output', parentAccountId: 'in', currentBalance: 50000 },
      { id: 'out', accountCode: '2045', accountType: 'Liability' },
      { id: 'input', accountCode: '2045-01', accountName: 'Input VAT', parentAccountId: 'out', currentBalance: 12000 },
      { id: 'ap', accountCode: '2110', accountType: 'Liability' },
    ];
    expect(accountsForTaxParentDropdown(accounts, '2041').map((a) => a.accountCode)).toEqual(['2041-01']);
    expect(accountsForTaxParentDropdown(accounts, '2045').map((a) => a.accountCode)).toEqual(['2045-01']);
  });
});

describe('accountsForCatchAllDropdown (2999)', () => {
  it('excludes 2041-xx and 2045-xx tax child accounts from liability catch-all', () => {
    const accounts = [
      { id: 'vat', accountCode: '2041-01', accountType: 'Liability', currentBalance: 1000 },
      { id: 'input', accountCode: '2045-02', accountType: 'Liability', currentBalance: 200 },
      { id: 'misc', accountCode: '2185', accountType: 'Liability', currentBalance: 50 },
    ];
    const c2999 = accountsForCatchAllDropdown(accounts, '2999');
    expect(c2999.map((a) => a.accountCode)).toEqual(['2185']);
  });

  it('excludes blueprint liability codes such as 2115 GRNI and 2180 Credit Card Payable', () => {
    const accounts = [
      { id: 'grni', accountCode: '2115', accountType: 'Liability', currentBalance: 100 },
      { id: 'cc', accountCode: '2180', accountType: 'Liability', currentBalance: 50 },
      { id: 'misc', accountCode: '2185', accountType: 'Liability', currentBalance: 25 },
    ];
    const c2999 = accountsForCatchAllDropdown(accounts, '2999');
    expect(c2999.map((a) => a.accountCode)).toEqual(['2185']);
  });
});

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

  it('rolls direct on 3100 plus children (no zeroing — direct is real GL)', () => {
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
    expect(cap.currentBalance).toBe(1049);
  });

  it('does not reuse an already-rolled parent currentBalance as direct when postedDirectBalance is zero', () => {
    const accounts = [
      {
        id: 'p',
        parentAccountId: null,
        accountCode: '1300',
        postedDirectBalance: 0,
        currentBalance: 11_037_070,
      },
      {
        id: 'c',
        parentAccountId: 'p',
        accountCode: '1310',
        postedDirectBalance: 11_037_070,
        currentBalance: 11_037_070,
      },
    ];
    const rolled = applyCoaParentRollup(accounts);
    expect(rolled.find((a) => a.id === 'p').currentBalance).toBe(11_037_070);
  });

  it('sums multiple child balances and preserves signed debit/credit behavior', () => {
    const accounts = [
      { id: 'p', parentAccountId: null, accountCode: '5000', postedDirectBalance: 10 },
      { id: 'c1', parentAccountId: 'p', accountCode: '5100', postedDirectBalance: 80 },
      { id: 'c2', parentAccountId: 'p', accountCode: '5200', postedDirectBalance: -30 },
      { id: 'c3', parentAccountId: 'p', accountCode: '5300', postedDirectBalance: 0 },
    ];
    const rolled = applyCoaParentRollup(accounts);
    expect(rolled.find((a) => a.id === 'p').currentBalance).toBe(60);
  });

  it('rolls legitimate direct postings once through a synthetic direct child', () => {
    const accounts = [
      { id: 'p', parentAccountId: null, accountCode: '5200', postedDirectBalance: 25 },
      { id: 'c1', parentAccountId: 'p', accountCode: '5201', postedDirectBalance: 40 },
      { id: 'c2', parentAccountId: 'p', accountCode: '5202', postedDirectBalance: 60 },
    ];
    const withSynthetic = injectSyntheticDirectPostingLeaves(accounts);
    const rolled = applyCoaParentRollup(withSynthetic);
    const parent = rolled.find((a) => a.id === 'p');
    const direct = rolled.find((a) => a.parentAccountId === 'p' && a.isSynthetic);
    expect(direct.currentBalance).toBe(25);
    expect(parent.currentBalance).toBe(125);
  });

  it('rolls nested parent child grandchild accounts without multiplying descendant balances', () => {
    const accounts = [
      { id: 'root', parentAccountId: null, accountCode: '1000', postedDirectBalance: 0 },
      { id: 'mid', parentAccountId: 'root', accountCode: '1100', postedDirectBalance: 0 },
      { id: 'leaf', parentAccountId: 'mid', accountCode: '1110', postedDirectBalance: 140 },
    ];
    const rolled = applyCoaParentRollup(accounts);
    expect(rolled.find((a) => a.id === 'mid').currentBalance).toBe(140);
    expect(rolled.find((a) => a.id === 'root').currentBalance).toBe(140);
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

  /**
   * Regression: chart GET always passes stock aggregate even when dateFrom/dateTo are set (month preset).
   * Period filters scope posted GL only; inventory uses point-in-time Stock Management total (this S).
   * QA: if 1310/1320/1330 show "Not set up", create blueprint rows via POST /api/chart-of-accounts/bootstrap.
   */
  it('applies full stock total to 1300 when no 1310 leaf row exists', () => {
    const accounts = [
      {
        id: 'inv',
        parentAccountId: null,
        accountCode: '1300',
        accountType: 'Asset',
        postedDirectBalance: 0,
      },
    ];
    const S = 11_947_245;
    const adj = applyStockLedInventoryCoaSubtree(accounts, S);
    expect(adj.find((a) => a.accountCode === '1300').postedDirectBalance).toBe(S);
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

  it('folds orphan bucket onto 1900 when canonical 1999 row is missing', () => {
    const orphan = {
      id: 'o1',
      parentAccountId: null,
      accountCode: '1750',
      accountType: 'Asset',
      postedDirectBalance: 25,
      currentBalance: 25,
    };
    const p1900 = {
      id: 'p1900',
      parentAccountId: 'p1000',
      accountCode: '1900',
      accountType: 'Asset',
      postedDirectBalance: 0,
      currentBalance: 0,
    };
    const p1000 = {
      id: 'p1000',
      parentAccountId: null,
      accountCode: '1000',
      accountType: 'Asset',
      postedDirectBalance: 0,
      currentBalance: 0,
    };
    const first = applyCoaParentRollup([p1000, p1900, orphan]);
    const folded = foldCatchAllBucketTotalsIntoPostedDirect(first);
    const second = applyCoaParentRollup(folded);
    const r1900 = second.find((a) => a.accountCode === '1900');
    const r1000b = second.find((a) => a.accountCode === '1000');
    expect(r1900.currentBalance).toBeCloseTo(25, 5);
    expect(r1000b.currentBalance).toBeCloseTo(25, 5);
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

  it('adds capital bucket to 3000 when 3100 row is missing', () => {
    const eq = {
      id: 'eq',
      parentAccountId: null,
      accountCode: '3000',
      postedDirectBalance: 10,
      currentBalance: 10,
    };
    const orphan3105 = {
      id: 'o3105',
      parentAccountId: null,
      accountCode: '3105',
      postedDirectBalance: 40,
      currentBalance: 40,
    };
    const rolled = applyCoaParentRollup([eq, orphan3105]);
    const patched = apply3100CapitalBucketAncestorPropagation(rolled);
    const eqRow = patched.find((a) => a.id === 'eq');
    expect(eqRow.currentBalance).toBe(50);
  });

  it('does not double-count 3101 child already parented under 3100', () => {
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
    const cap3101 = {
      id: 'c3101',
      parentAccountId: 'cap',
      accountCode: '3101',
      postedDirectBalance: 1_000_000,
      currentBalance: 1_000_000,
    };
    const rolled = applyCoaParentRollup([eq, cap, cap3101]);
    const patched = apply3100CapitalBucketAncestorPropagation(rolled);
    const capRow = patched.find((a) => a.id === 'cap');
    const eqRow = patched.find((a) => a.id === 'eq');
    expect(capRow.currentBalance).toBe(1_000_000);
    expect(eqRow.currentBalance).toBe(1_000_000);
  });

  it('REG-CAP-002: MK1,000,000 capital child under 3100 never becomes MK2,000,000 after full fold pipeline', () => {
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
    const cap3101 = {
      id: 'c3101',
      parentAccountId: 'cap',
      accountCode: '3101',
      postedDirectBalance: 1_000_000,
      currentBalance: 1_000_000,
    };
    const first = applyCoaParentRollup([eq, cap, cap3101]);
    const folded = foldCatchAllBucketTotalsIntoPostedDirect(first);
    const second = applyCoaParentRollup(folded);
    const patched = apply3100CapitalBucketAncestorPropagation(second);
    const capRow = patched.find((a) => a.id === 'cap');
    const eqRow = patched.find((a) => a.id === 'eq');
    expect(capRow.currentBalance).toBe(1_000_000);
    expect(eqRow.currentBalance).toBe(1_000_000);
    expect(capRow.currentBalance).not.toBe(2_000_000);
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

  it('shows bucket total when folded code has no ledger row', () => {
    const bal = structureRowDisplayBalance([], '1999', {
      c1999: [{ currentBalance: 30 }, { currentBalance: 20 }],
    });
    expect(bal).toBe(50);
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
