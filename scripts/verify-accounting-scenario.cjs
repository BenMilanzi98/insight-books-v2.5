#!/usr/bin/env node
/**
 * Verify accounting QA scenarios (read-only GL integrity checks).
 *
 * Scenarios:
 *   pos-sale-gl          — Posted Sale + Sale-COGS source types exist
 *   invoice-accrual-gl   — Posted Invoice accrual GL exists
 *   expense-approved-gl  — Posted Expense GL exists
 *   trial-balance        — Trial balance debits = credits
 *   txn-balance          — Every posted transaction debits = credits
 *   source-idempotency   — No duplicate sourceType + sourceId on posted txns
 *   ar-subledger         — AR 1200 vs invoice sub-ledger (manifest-aware)
 *
 * Usage:
 *   npm run verify:accounting-scenario
 *   node scripts/verify-accounting-scenario.cjs --tenant=QA-Accounting
 *   node scripts/verify-accounting-scenario.cjs --tenant-id=<uuid>
 *
 * Pass/fail output:
 *   - Per-scenario line: ✅/❌ <key>  <message>
 *   - JSON report on stdout (scenarios[].ok, scenarios[].status)
 *   - Exit 0 when all scenarios pass; exit 1 on any failure
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createJiti } = require('jiti');

const prisma = new PrismaClient();
const MANIFEST_PATH = path.join(__dirname, '.qa-scenario-manifest.json');
const EPS = 0.01;

const POSTED_STATUSES = ['posted', 'Posted', 'POSTED'];

const SOURCE_TYPES = {
  saleRevenue: ['Sale', 'sale'],
  saleCogs: ['Sale-COGS', 'sale-cogs', 'sale_cogs'],
  invoice: ['Invoice', 'invoice'],
  expense: ['Expense', 'expense'],
};

const SCENARIO_DEFS = [
  { key: 'pos-sale-gl', name: 'POS sale GL (Sale + Sale-COGS)' },
  { key: 'invoice-accrual-gl', name: 'Invoice accrual GL' },
  { key: 'expense-approved-gl', name: 'Expense approved GL' },
  { key: 'trial-balance', name: 'Trial balance debits = credits' },
  { key: 'txn-balance', name: 'Per-transaction debits = credits' },
  { key: 'source-idempotency', name: 'No duplicate sourceType + sourceId' },
  { key: 'ar-subledger', name: 'AR 1200 vs invoice sub-ledger' },
];

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function asNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function scenarioLine(ok, key, message) {
  return `${ok ? '✅' : '❌'} ${key.padEnd(22)} ${message}`;
}

async function resolveTenantId() {
  const byId = arg('tenant-id');
  if (byId) return byId;

  const byName = arg('tenant') || 'QA-Accounting';
  const tenant = await prisma.tenant.findFirst({ where: { name: byName.trim() } });
  if (!tenant) throw new Error(`Tenant "${byName}" not found`);
  return tenant.id;
}

async function countPostedBySourceTypes(tenantId, types) {
  return prisma.transaction.count({
    where: {
      tenantId,
      status: { in: POSTED_STATUSES },
      sourceType: { in: types },
    },
  });
}

async function samplePostedBySourceTypes(tenantId, types, take = 3) {
  return prisma.transaction.findMany({
    where: {
      tenantId,
      status: { in: POSTED_STATUSES },
      sourceType: { in: types },
    },
    select: { id: true, sourceType: true, sourceId: true, reference: true },
    take,
    orderBy: { createdAt: 'desc' },
  });
}

async function verifyManifestTransaction(tenantId, transactionId) {
  if (!transactionId) return { ok: false, reason: 'manifest missing transactionId' };
  const txn = await prisma.transaction.findFirst({
    where: { id: transactionId, tenantId, status: { in: POSTED_STATUSES } },
    select: { id: true, sourceType: true, sourceId: true, reference: true },
  });
  if (!txn) return { ok: false, reason: `transaction ${transactionId} not posted` };
  return { ok: true, transaction: txn };
}

async function computeArSubledgerTotal(tenantId) {
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      status: { notIn: ['draft', 'cancelled', 'void', 'paid'] },
    },
    include: { payments: true },
  });

  let total = 0;
  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + asNum(p.amount), 0);
    const remaining = Math.max(0, asNum(inv.total) - paid);
    total += remaining;
  }
  return total;
}

async function computeArGlBalance(tenantId) {
  const ar = await prisma.account.findFirst({
    where: { tenantId, accountCode: '1200', isActive: true, mergedIntoAccountId: null },
  });
  if (!ar) return { balance: 0, accountId: null };

  const [txnLines, jeLines] = await Promise.all([
    prisma.transactionLine.findMany({
      where: {
        accountId: ar.id,
        transaction: { tenantId, status: { in: POSTED_STATUSES } },
      },
      select: { debitAmount: true, creditAmount: true },
    }),
    prisma.journalEntryLine.findMany({
      where: {
        accountId: ar.id,
        journalEntry: {
          tenantId,
          status: { in: ['Posted', 'posted'] },
          transactionId: null,
        },
      },
      select: { debitAmount: true, creditAmount: true },
    }),
  ]);

  let deb = 0;
  let cre = 0;
  for (const l of [...txnLines, ...jeLines]) {
    deb += asNum(l.debitAmount);
    cre += asNum(l.creditAmount);
  }
  return { balance: deb - cre, accountId: ar.id, debits: deb, credits: cre };
}

async function findDuplicateSources(tenantId) {
  const rows = await prisma.transaction.groupBy({
    by: ['sourceType', 'sourceId'],
    where: {
      tenantId,
      status: { in: POSTED_STATUSES },
      sourceType: { not: null },
      sourceId: { not: null },
    },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  return rows.map((r) => ({
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    count: r._count.id,
  }));
}

async function findUnbalancedTransactions(tenantId) {
  const txns = await prisma.transaction.findMany({
    where: { tenantId, status: { in: POSTED_STATUSES } },
    select: {
      id: true,
      reference: true,
      sourceType: true,
      sourceId: true,
      lines: { select: { debitAmount: true, creditAmount: true } },
    },
  });

  const out = [];
  for (const t of txns) {
    let deb = 0;
    let cre = 0;
    for (const l of t.lines) {
      deb += asNum(l.debitAmount);
      cre += asNum(l.creditAmount);
    }
    if (Math.abs(deb - cre) > EPS) {
      out.push({
        transactionId: t.id,
        reference: t.reference,
        sourceType: t.sourceType,
        sourceId: t.sourceId,
        debits: deb,
        credits: cre,
        difference: deb - cre,
      });
    }
  }
  return out;
}

async function runTrialBalanceCheck(tenantId) {
  const jiti = createJiti(__filename, {
    interopDefault: true,
    alias: { '@': path.join(__dirname, '..') },
  });
  const { runGlReconciliation } = jiti(path.join(__dirname, '..', 'lib/glReconciliation.js'));

  const year = new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  return runGlReconciliation({
    tenantId,
    branchId: null,
    startDate,
    endDate,
    prisma,
  });
}

async function checkPosSaleGl(tenantId, manifest) {
  const [saleCount, cogsCount, saleSamples, cogsSamples] = await Promise.all([
    countPostedBySourceTypes(tenantId, SOURCE_TYPES.saleRevenue),
    countPostedBySourceTypes(tenantId, SOURCE_TYPES.saleCogs),
    samplePostedBySourceTypes(tenantId, SOURCE_TYPES.saleRevenue),
    samplePostedBySourceTypes(tenantId, SOURCE_TYPES.saleCogs),
  ]);

  const manifestTxn = await verifyManifestTransaction(
    tenantId,
    manifest?.scenarios?.['1']?.transactionId
  );

  const revenueOk = saleCount > 0;
  const cogsOk = cogsCount > 0;
  const ok = revenueOk && cogsOk;

  const parts = [];
  if (revenueOk) parts.push(`Sale=${saleCount}`);
  else parts.push('Sale=0');
  if (cogsOk) parts.push(`Sale-COGS=${cogsCount}`);
  else parts.push('Sale-COGS=0');
  if (manifestTxn.ok) parts.push(`manifest scenario-1 txn ${manifestTxn.transaction.id}`);

  return {
    key: 'pos-sale-gl',
    name: 'POS sale GL (Sale + Sale-COGS)',
    ok,
    status: ok ? 'pass' : 'fail',
    saleCount,
    saleCogsCount: cogsCount,
    samples: { sale: saleSamples, saleCogs: cogsSamples },
    manifestScenario1: manifestTxn,
    message: parts.join(', '),
  };
}

async function checkInvoiceAccrualGl(tenantId, manifest) {
  const [count, samples] = await Promise.all([
    countPostedBySourceTypes(tenantId, SOURCE_TYPES.invoice),
    samplePostedBySourceTypes(tenantId, SOURCE_TYPES.invoice),
  ]);

  const manifestTxn = await verifyManifestTransaction(
    tenantId,
    manifest?.scenarios?.['4']?.transactionId
  );

  const ok = count > 0;
  const msg = ok
    ? `Invoice accrual posted (${count} txn${count === 1 ? '' : 's'})`
    : 'No posted Invoice sourceType transactions';

  return {
    key: 'invoice-accrual-gl',
    name: 'Invoice accrual GL',
    ok,
    status: ok ? 'pass' : 'fail',
    count,
    samples,
    manifestScenario4: manifestTxn,
    message: manifestTxn.ok ? `${msg}; manifest scenario-4 ok` : msg,
  };
}

async function checkExpenseApprovedGl(tenantId, manifest) {
  const [count, samples, approvedExpenseCount] = await Promise.all([
    countPostedBySourceTypes(tenantId, SOURCE_TYPES.expense),
    samplePostedBySourceTypes(tenantId, SOURCE_TYPES.expense),
    prisma.expense.count({
      where: { tenantId, status: 'Approved' },
    }),
  ]);

  const manifestTxn = await verifyManifestTransaction(
    tenantId,
    manifest?.scenarios?.['7']?.transactionId
  );

  const ok = count > 0;
  const msg = ok
    ? `Expense GL posted (${count} txn${count === 1 ? '' : 's'}, ${approvedExpenseCount} approved expenses)`
    : 'No posted Expense sourceType transactions';

  return {
    key: 'expense-approved-gl',
    name: 'Expense approved GL',
    ok,
    status: ok ? 'pass' : 'fail',
    count,
    approvedExpenseCount,
    samples,
    manifestScenario7: manifestTxn,
    message: manifestTxn.ok ? `${msg}; manifest scenario-7 ok` : msg,
  };
}

function checkTrialBalance(tbReport) {
  const summary = tbReport.trialBalanceSummary;
  const deb = asNum(summary?.totalDebits);
  const cre = asNum(summary?.totalCredits);
  const diff = asNum(summary?.difference);
  const ok = tbReport.allOk && tbReport.trialBalanced;

  return {
    key: 'trial-balance',
    name: 'Trial balance debits = credits',
    ok,
    status: ok ? 'pass' : 'fail',
    balanced: tbReport.trialBalanced,
    engineConsistencyOk: tbReport.engineConsistencyOk,
    summary,
    message: ok
      ? `TB balanced (${deb.toLocaleString()} debits = ${cre.toLocaleString()} credits)`
      : `TB imbalance: debits=${deb}, credits=${cre}, diff=${diff}`,
  };
}

function checkTxnBalance(unbalanced) {
  const ok = unbalanced.length === 0;
  return {
    key: 'txn-balance',
    name: 'Per-transaction debits = credits',
    ok,
    status: ok ? 'pass' : 'fail',
    unbalancedCount: unbalanced.length,
    unbalanced,
    message: ok
      ? 'All posted transactions balanced'
      : `${unbalanced.length} unbalanced transaction(s)`,
  };
}

function checkSourceIdempotency(duplicates) {
  const ok = duplicates.length === 0;
  return {
    key: 'source-idempotency',
    name: 'No duplicate sourceType + sourceId',
    ok,
    status: ok ? 'pass' : 'fail',
    duplicateSourceCount: duplicates.length,
    duplicates,
    message: ok
      ? 'No duplicate sourceType+sourceId pairs'
      : `${duplicates.length} duplicate source pair(s)`,
  };
}

function checkArSubledger(arGl, arSub, manifest) {
  const arDelta = Math.abs(arSub - arGl.balance);
  const arMismatchExpected =
    manifest?.scenarios?.['18']?.expectedMismatch != null &&
    Math.abs(arDelta - asNum(manifest.scenarios['18'].expectedMismatch)) < EPS;
  const ok = arMismatchExpected || arDelta <= EPS;

  return {
    key: 'ar-subledger',
    name: 'AR 1200 vs invoice sub-ledger',
    ok,
    status: ok ? 'pass' : 'fail',
    gl1200Balance: arGl.balance,
    invoiceSubledgerTotal: arSub,
    delta: arSub - arGl.balance,
    arMismatchExpected,
    scenario18ExpectedMismatch: manifest?.scenarios?.['18']?.expectedMismatch ?? null,
    message: arMismatchExpected
      ? `Expected AR mismatch (${arDelta.toLocaleString()} delta, scenario 18)`
      : ok
        ? `AR aligned (delta ${arDelta.toLocaleString()})`
        : `AR mismatch: GL=${arGl.balance}, sub-ledger=${arSub}, delta=${arSub - arGl.balance}`,
  };
}

async function main() {
  const tenantId = await resolveTenantId();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  let manifest = null;
  if (fs.existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  }

  console.log('\n📋 Accounting scenario verification\n');
  console.log('Tenant:', tenant?.name || tenantId);
  console.log('Tenant ID:', tenantId);

  if (manifest) {
    const ok = Object.values(manifest.scenarios || {}).filter((s) => s.status === 'ok').length;
    console.log('Manifest scenarios ok:', ok);
  } else {
    console.log('Manifest: not found (run accounting-qa-scenarios.cjs first for manifest-linked checks)');
  }

  const [tbReport, unbalanced, duplicates, arGl, arSub] = await Promise.all([
    runTrialBalanceCheck(tenantId),
    findUnbalancedTransactions(tenantId),
    findDuplicateSources(tenantId),
    computeArGlBalance(tenantId),
    computeArSubledgerTotal(tenantId),
  ]);

  const [posSale, invoiceAccrual, expenseApproved] = await Promise.all([
    checkPosSaleGl(tenantId, manifest),
    checkInvoiceAccrualGl(tenantId, manifest),
    checkExpenseApprovedGl(tenantId, manifest),
  ]);

  const scenarios = [
    posSale,
    invoiceAccrual,
    expenseApproved,
    checkTrialBalance(tbReport),
    checkTxnBalance(unbalanced),
    checkSourceIdempotency(duplicates),
    checkArSubledger(arGl, arSub, manifest),
  ];

  console.log('\nScenarios:');
  for (const s of scenarios) {
    console.log('  ' + scenarioLine(s.ok, s.key, s.message));
  }

  const passCount = scenarios.filter((s) => s.ok).length;
  const allOk = passCount === scenarios.length;

  const report = {
    tenantId,
    tenantName: tenant?.name,
    verifiedAt: new Date().toISOString(),
    scenarioNames: SCENARIO_DEFS.map((d) => d.key),
    scenarios: scenarios.map(({ key, name, ok, status, message, ...rest }) => ({
      key,
      name,
      ok,
      status,
      message,
      ...rest,
    })),
    summary: {
      total: scenarios.length,
      passed: passCount,
      failed: scenarios.length - passCount,
      allOk,
    },
    trialBalance: {
      balanced: tbReport.trialBalanced,
      summary: tbReport.trialBalanceSummary,
      engineConsistencyOk: tbReport.engineConsistencyOk,
      perAccountDeltaCount: tbReport.perAccountDelta?.length || 0,
      journalImbalanceCount: tbReport.journalImbalances?.length || 0,
      allOk: tbReport.allOk,
    },
    transactions: {
      unbalancedCount: unbalanced.length,
      unbalanced,
    },
    idempotency: {
      duplicateSourceCount: duplicates.length,
      duplicates,
    },
    accountsReceivable: {
      gl1200Balance: arGl.balance,
      invoiceSubledgerTotal: arSub,
      delta: arSub - arGl.balance,
      arMismatchExpected: scenarios.find((s) => s.key === 'ar-subledger')?.arMismatchExpected,
      scenario18ExpectedMismatch: manifest?.scenarios?.['18']?.expectedMismatch ?? null,
    },
    allOk,
  };

  console.log('\n' + JSON.stringify(report, null, 2));

  if (!allOk) {
    console.error(`\n❌ Verification failed (${passCount}/${scenarios.length} scenarios passed)\n`);
    process.exit(1);
  }

  console.log(`\n✅ All verification checks passed (${passCount}/${scenarios.length})\n`);
}

main()
  .catch((err) => {
    console.error('❌ Verification error:', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
