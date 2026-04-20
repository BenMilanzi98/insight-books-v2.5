#!/usr/bin/env node
/**
 * Lists every database path that can affect Asset-type GL / sub-ledgers for a tenant.
 * Usage: node scripts/audit-tenant-asset-data-sources.cjs <tenantId> [out.json]
 *
 * Data sources documented:
 * - Account (Asset rows): stored balance field, codes, merge targets
 * - JournalEntryLine + JournalEntry (posted): debits/credits per account (direct id; see note on merge)
 * - TransactionLine + Transaction (posted): same
 * - Invoice + Payment: unpaid receivables (drives AR sub-ledger when no GL on 1200-style leaf)
 * - Product: stock valuation (drives inventory sub-ledger for non-1300 inventory-named leaves; 1300 uses subtree rules in API)
 * - Asset + AssetCategory + DepreciationSchedule: fixed asset register (GL posts are still the audit trail on CoA)
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function buildMergeMaps(rows) {
  const mergedIntoById = new Map(rows.map((r) => [r.id, r.mergedIntoAccountId || null]));
  const survivorMemo = new Map();
  function survivorOf(accountId) {
    if (!accountId) return null;
    if (survivorMemo.has(accountId)) return survivorMemo.get(accountId);
    if (!mergedIntoById.has(accountId)) {
      survivorMemo.set(accountId, accountId);
      return accountId;
    }
    const seen = new Set();
    let cur = accountId;
    while (mergedIntoById.get(cur)) {
      if (seen.has(cur)) break;
      seen.add(cur);
      cur = mergedIntoById.get(cur);
    }
    survivorMemo.set(accountId, cur);
    return cur;
  }
  function allIdsRollingInto(survivorId) {
    const out = new Set();
    if (survivorId) out.add(survivorId);
    for (const r of rows) {
      if (survivorOf(r.id) === survivorId) out.add(r.id);
    }
    return [...out];
  }
  return { survivorOf, allIdsRollingInto };
}

async function glTotalsForAccountIds(prisma, tenantId, accountIds) {
  if (!accountIds.length) return { dr: 0, cr: 0, jn: 0, tx: 0 };
  const postedJ = { in: ['Posted', 'posted'] };
  const postedT = { in: ['posted', 'Posted'] };
  const [jl, tl] = await Promise.all([
    prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: accountIds },
        journalEntry: { tenantId, status: postedJ },
      },
      select: { debitAmount: true, creditAmount: true },
    }),
    prisma.transactionLine.findMany({
      where: {
        accountId: { in: accountIds },
        transaction: { tenantId, status: postedT },
      },
      select: { debitAmount: true, creditAmount: true },
    }),
  ]);
  const jDr = jl.reduce((s, l) => s + (parseFloat(l.debitAmount) || 0), 0);
  const jCr = jl.reduce((s, l) => s + (parseFloat(l.creditAmount) || 0), 0);
  const tDr = tl.reduce((s, l) => s + (parseFloat(l.debitAmount) || 0), 0);
  const tCr = tl.reduce((s, l) => s + (parseFloat(l.creditAmount) || 0), 0);
  return {
    journalDebit: jDr,
    journalCredit: jCr,
    journalLines: jl.length,
    txnDebit: tDr,
    txnCredit: tCr,
    txnLines: tl.length,
    dr: jDr + tDr,
    cr: jCr + tCr,
  };
}

async function main() {
  const tenantId = process.argv[2];
  const outFile = process.argv[3];
  if (!tenantId) {
    console.error('Usage: node scripts/audit-tenant-asset-data-sources.cjs <tenantId> [output.json]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const mergeRows = await prisma.account.findMany({
      where: { tenantId },
      select: { id: true, mergedIntoAccountId: true },
    });
    const { allIdsRollingInto } = buildMergeMaps(mergeRows);

    const assetAccounts = await prisma.account.findMany({
      where: { tenantId, accountType: 'Asset' },
      orderBy: [{ accountCode: 'asc' }],
    });

    const fixedAssets = await prisma.asset.findMany({
      where: { tenantId },
      include: { category: { select: { name: true } } },
    });

    const productsWithInventoryAccount = await prisma.product.findMany({
      where: { tenantId, isDeleted: false, inventoryAccountId: { not: null } },
      select: {
        id: true,
        name: true,
        sku: true,
        inventoryAccountId: true,
        stockLevel: true,
        totalStockValue: true,
        branchId: true,
      },
    });

    const invoiceAgg = await prisma.invoice.findMany({
      where: { tenantId, voidedAt: null, refundedAt: null },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        payments: { where: { status: 'Completed' }, select: { amount: true } },
      },
    });

    const perAccount = [];
    for (const acc of assetAccounts) {
      const ids = allIdsRollingInto(acc.id);
      const gl = await glTotalsForAccountIds(prisma, tenantId, ids);
      const nb = acc.normalBalance === 'Credit' ? 'Credit' : 'Debit';
      const postedNet = nb === 'Debit' ? gl.dr - gl.cr : gl.cr - gl.dr;
      perAccount.push({
        id: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        mergedIntoAccountId: acc.mergedIntoAccountId,
        legacyStoredBalance: acc.balance,
        mergeSourceAccountIds: ids.length,
        postedGl: {
          journalLines: gl.journalLines,
          transactionLines: gl.txnLines,
          totalDebit: gl.dr,
          totalCredit: gl.cr,
          postedNet,
          normalBalanceUsed: nb,
        },
      });
    }

    const fixedAssetSummary = fixedAssets.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category?.name,
      originalCost: a.originalCost,
      accumulatedDepreciation: a.accumulatedDepreciation,
      netBook: (parseFloat(a.originalCost) || 0) - (parseFloat(a.accumulatedDepreciation) || 0),
      status: a.status,
    }));

    const payload = {
      generatedAt: new Date().toISOString(),
      tenantId,
      summary: {
        assetAccountRows: assetAccounts.length,
        fixedAssetRegisterRows: fixedAssets.length,
        productsWithInventoryGlLink: productsWithInventoryAccount.length,
        invoicesConsideredForArContext: invoiceAgg.length,
      },
      narrative: [
        'CoA Asset balances in the app are primarily: posted JournalEntryLine + posted TransactionLine (with CoA merge rollup).',
        'When a receivables leaf (e.g. 1200) has no posted GL, the chart may show unpaid invoices total until journals post.',
        'When a non-1300 inventory-named asset leaf has no GL, the chart may show product stock aggregate.',
        'Fixed Asset register rows (Asset model) are not added to CoA totals automatically; book value should appear via GL postings.',
      ],
      assetAccountsGlRollup: perAccount,
      fixedAssetRegister: fixedAssetSummary,
      productsLinkedToInventoryCoa: productsWithInventoryAccount,
    };

    const text = JSON.stringify(payload, null, 2);
    if (outFile) {
      fs.writeFileSync(path.resolve(outFile), text, 'utf8');
      console.log('Wrote', path.resolve(outFile));
    } else {
      console.log(text);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
