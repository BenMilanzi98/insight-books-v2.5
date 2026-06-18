#!/usr/bin/env node
/**
 * Idempotent accounting QA scenario seeder for tenant QA-Accounting.
 *
 * Usage:
 *   node scripts/accounting-qa-scenarios.cjs "<tenantName>" <email> "<userName>" <password>
 *
 * Requires:
 *   - DATABASE_URL in .env
 *   - Dev server at localhost:3000 for admin tenant bootstrap (first run)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { createJiti } = require('jiti');

const prisma = new PrismaClient();
const APP_URL = process.env.BOOTSTRAP_APP_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@insightbooks.com';
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Password2026';
const QA_REF = 'QA-';
const MANIFEST_PATH = path.join(__dirname, '.qa-scenario-manifest.json');

const SCENARIO_DEFS = [
  { id: 1, key: 'pos-cash-sale', name: 'POS cash sale' },
  { id: 2, key: 'pos-mobile-money', name: 'POS mobile money sale' },
  { id: 3, key: 'pos-sale-reversal', name: 'POS sale reversal' },
  { id: 4, key: 'invoice-create', name: 'Invoice creation' },
  { id: 5, key: 'invoice-payments', name: 'Invoice partial + full payment' },
  { id: 6, key: 'invoice-void', name: 'Invoice void/cancel' },
  { id: 7, key: 'expense-cash', name: 'Expense paid immediately' },
  { id: 8, key: 'expense-ap', name: 'Expense on AP' },
  { id: 9, key: 'supplier-bill', name: 'Supplier bill + payment' },
  { id: 10, key: 'manual-journal', name: 'Manual journal entry' },
  { id: 11, key: 'journal-reversal', name: 'Journal reversal' },
  { id: 12, key: 'capital-contribution', name: 'Capital contribution' },
  { id: 13, key: 'owner-withdrawal', name: 'Owner withdrawal' },
  { id: 14, key: 'bank-transfer', name: 'Bank transfer' },
  { id: 15, key: 'payroll-run', name: 'Payroll run' },
  { id: 16, key: 'open-period', name: 'Open accounting period' },
  { id: 17, key: 'closed-period', name: 'Closed period block test' },
  { id: 18, key: 'ar-mismatch', name: 'Intentional AR mismatch' },
  { id: 19, key: 'legacy-capital', name: 'Legacy capital header-only row' },
];

function loadEngine() {
  const jiti = createJiti(__filename, {
    interopDefault: true,
    alias: { '@': path.join(__dirname, '..') },
  });
  return jiti(path.join(__dirname, '..', 'lib/accountingEngine/index.js'));
}

function loadCapitalHelpers() {
  const jiti = createJiti(__filename, {
    interopDefault: true,
    alias: { '@': path.join(__dirname, '..') },
  });
  return jiti(path.join(__dirname, '..', 'lib/capitalCoaHelpers.js'));
}

function qaRef(scenarioKey, suffix = '') {
  return `${QA_REF}S${String(scenarioKey).padStart(2, '0')}${suffix ? `-${suffix}` : ''}`;
}

function qaSourceId(num, suffix = '') {
  const def = SCENARIO_DEFS.find((s) => s.id === num);
  const key = def ? def.key : `scenario-${num}`;
  return `${QA_REF}${key}${suffix ? `-${suffix}` : ''}`;
}

function asNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function readManifest() {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    }
  } catch (_) {
    /* fresh manifest */
  }
  return { scenarios: {} };
}

function writeManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

async function adminLoginCookie() {
  const res = await fetch(`${APP_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Admin login failed: ${data.error || res.status}`);
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Admin login did not return a session cookie');
  return cookie;
}

async function createTenantViaAdmin(cookie, tenantName) {
  const res = await fetch(`${APP_URL}/api/admin/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: tenantName }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Tenant create failed: ${data.error || res.status}`);
  return data.tenant;
}

async function bootstrapTenant(tenantName, email, userName, password) {
  const normalizedEmail = email.toLowerCase().trim();
  let tenant = await prisma.tenant.findFirst({ where: { name: tenantName.trim() } });

  if (!tenant) {
    console.log('Creating tenant via admin API (CoA + roles + settings)…');
    const cookie = await adminLoginCookie();
    const created = await createTenantViaAdmin(cookie, tenantName.trim());
    tenant = await prisma.tenant.findUnique({ where: { id: created.id } });
    if (!tenant) throw new Error('Tenant not found after API create');
  } else {
    console.log(`Tenant "${tenantName}" already exists (${tenant.id})`);
  }

  let user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: normalizedEmail },
  });

  if (!user) {
    const ownerRole =
      (await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'Owner' } })) ||
      (await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'Admin' } }));
    if (!ownerRole) throw new Error('No Owner/Admin role — tenant bootstrap incomplete');

    user = await prisma.user.create({
      data: {
        name: userName,
        email: normalizedEmail,
        password: await bcrypt.hash(password, 12),
        phone: '',
        roleId: ownerRole.id,
        tenantId: tenant.id,
        isActive: true,
        isEmailVerified: true,
        tenants: { connect: { id: tenant.id } },
      },
    });

    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: { roleId: ownerRole.id, status: 'active' },
      create: { userId: user.id, tenantId: tenant.id, roleId: ownerRole.id, status: 'active' },
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { ownerUserId: user.id },
    });
    console.log('Created owner user');
  }

  const sub = await prisma.accountSubscription.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  });
  if (sub) {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await prisma.accountSubscription.update({
      where: { id: sub.id },
      data: {
        plan: '1year',
        isTrial: false,
        isActive: true,
        status: 'Active',
        expiresAt,
        notes: '1-year plan (QA bootstrap)',
      },
    });
  }

  await prisma.tenantSettings.updateMany({
    where: { tenantId: tenant.id },
    data: {
      businessEmail: normalizedEmail,
      capitalSetupCompletedAt: new Date(),
      paymentAccountsSetupCompletedAt: new Date(),
    },
  });

  return { tenant, user };
}

async function findGlAccount(tenantId, code) {
  const row = await prisma.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      mergedIntoAccountId: null,
      OR: [{ accountCode: code }, { code }],
    },
  });
  if (!row) throw new Error(`GL account ${code} not found for tenant`);
  return row;
}

async function findPostableLeafByPrefix(tenantId, parentPrefix) {
  const leaf = await prisma.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      mergedIntoAccountId: null,
      OR: [
        { accountCode: { startsWith: `${parentPrefix}-` } },
        { code: { startsWith: `${parentPrefix}-` } },
      ],
    },
    orderBy: { accountCode: 'asc' },
  });
  if (leaf) return leaf;

  const parent = await prisma.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [{ accountCode: parentPrefix }, { code: parentPrefix }],
    },
  });
  if (!parent) throw new Error(`Payment parent ${parentPrefix} not found`);

  const childCode = `${parentPrefix}-01`;
  return prisma.account.create({
    data: {
      tenantId,
      parentAccountId: parent.id,
      accountCode: childCode,
      code: childCode,
      accountName: `${QA_REF}${parent.accountName || parentPrefix}`,
      name: `${QA_REF}${parent.accountName || parentPrefix}`,
      accountType: 'Asset',
      type: 'Asset',
      accountSubtype: parent.accountSubtype || 'Bank',
      normalBalance: 'Debit',
      isActive: true,
      acceptsNewTransactions: true,
      balance: 0,
    },
  });
}

async function findMobileMoneyLeaf(tenantId) {
  for (const prefix of ['1140', '1141']) {
    try {
      return await findPostableLeafByPrefix(tenantId, prefix);
    } catch (_) {
      /* try next */
    }
  }
  throw new Error('No mobile money leaf account available');
}

async function findBankLeaf(tenantId) {
  for (const prefix of ['1131', '1132', '1133']) {
    try {
      return await findPostableLeafByPrefix(tenantId, prefix);
    } catch (_) {
      /* try next */
    }
  }
  throw new Error('No bank leaf account available');
}

async function existingSourceTxn(tenantId, sourceType, sourceId) {
  return prisma.transaction.findFirst({
    where: { tenantId, sourceType, sourceId, status: 'posted' },
    select: { id: true },
  });
}

async function postBalanced(ctx, params) {
  const { postGlEntry } = ctx.engine;
  const existing = await existingSourceTxn(ctx.tenantId, params.sourceType, params.sourceId);
  if (existing) return { transaction: existing, skipped: true };

  const transaction = await postGlEntry({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    entryDate: params.entryDate || new Date(),
    description: params.description,
    reference: params.reference,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    lines: params.lines,
    isReversal: params.isReversal || false,
    reversedTransactionId: params.reversedTransactionId || null,
    reversalReason: params.reversalReason || null,
    reversedById: params.reversedById || null,
    allowBlockedAccountForReversal: params.allowBlockedAccountForReversal || false,
  });
  return { transaction, skipped: false };
}

async function ensureMasterData(ctx) {
  let client = await prisma.client.findFirst({
    where: { tenantId: ctx.tenantId, name: `${QA_REF}Client Alpha` },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        tenantId: ctx.tenantId,
        name: `${QA_REF}Client Alpha`,
        email: 'qa-client@test.local',
        phone: '0999000001',
      },
    });
  }

  let supplier = await prisma.supplier.findFirst({
    where: { tenantId: ctx.tenantId, supplierName: `${QA_REF}Supplier Beta` },
  });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        tenantId: ctx.tenantId,
        supplierCode: `${QA_REF}SUP-001`,
        supplierName: `${QA_REF}Supplier Beta`,
        email: 'qa-supplier@test.local',
        phone: '0999000002',
      },
    });
  }

  const revenue = await findGlAccount(ctx.tenantId, '4100');
  let product = await prisma.product.findFirst({
    where: { tenantId: ctx.tenantId, sku: `${QA_REF}PROD-001` },
  });
  if (!product) {
    product = await prisma.product.create({
      data: {
        tenantId: ctx.tenantId,
        name: `${QA_REF}Widget`,
        sku: `${QA_REF}PROD-001`,
        price: 10000,
        cost: 4000,
        stockLevel: 100,
        isService: false,
        incomeAccountId: revenue.id,
        taxRate: 0,
      },
    });
  }

  return { client, supplier, product, revenue };
}

async function ensureOpenPeriod(ctx) {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  let period = await prisma.accountingPeriod.findFirst({
    where: { tenantId: ctx.tenantId, periodType: 'Yearly', startDate: start },
  });
  if (!period) {
    period = await prisma.accountingPeriod.create({
      data: {
        tenantId: ctx.tenantId,
        name: `${QA_REF}FY ${year}`,
        periodType: 'Yearly',
        startDate: start,
        endDate: end,
        status: 'open',
      },
    });
  }
  return period;
}

async function runScenario1(ctx) {
  const cash = await findGlAccount(ctx.tenantId, '1110');
  const revenue = await findGlAccount(ctx.tenantId, '4100');
  const cogs = await findGlAccount(ctx.tenantId, '5110').catch(() =>
    findPostableLeafByPrefix(ctx.tenantId, '5100')
  );
  let inventory;
  try {
    inventory = await findGlAccount(ctx.tenantId, '1310');
  } catch (_) {
    inventory = await findPostableLeafByPrefix(ctx.tenantId, '1300');
  }
  const amount = 25000;
  const sourceId = qaSourceId(1);
  const cogsAmount = asNum(ctx.master?.product?.cost) || 4000;

  let sale = await prisma.sale.findFirst({
    where: { tenantId: ctx.tenantId, saleNumber: qaRef('01', 'SALE') },
  });
  if (!sale) {
    sale = await prisma.sale.create({
      data: {
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        saleNumber: qaRef('01', 'SALE'),
        saleDate: new Date(),
        subtotal: amount,
        taxAmount: 0,
        total: amount,
        status: 'completed',
        paymentMethod: 'cash',
        notes: `${QA_REF}scenario-1`,
      },
    });
  }

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}POS cash sale`,
    reference: qaRef('01', 'GL'),
    sourceType: 'sale',
    sourceId,
    lines: [
      { accountId: cash.id, debitAmount: amount, creditAmount: 0 },
      { accountId: revenue.id, debitAmount: 0, creditAmount: amount },
    ],
  });

  const { transaction: cogsTxn } = await postBalanced(ctx, {
    description: `${QA_REF}POS cash sale COGS`,
    reference: qaRef('01', 'GL-COGS'),
    sourceType: 'Sale-COGS',
    sourceId: sale.id,
    lines: [
      { accountId: cogs.id, debitAmount: cogsAmount, creditAmount: 0 },
      { accountId: inventory.id, debitAmount: 0, creditAmount: cogsAmount },
    ],
  });

  return {
    saleId: sale.id,
    transactionId: transaction.id,
    cogsTransactionId: cogsTxn.id,
    cogsAmount,
  };
}

async function runScenario2(ctx) {
  const mobile = await findMobileMoneyLeaf(ctx.tenantId);
  const revenue = await findGlAccount(ctx.tenantId, '4100');
  const amount = 18500;
  const sourceId = qaSourceId(2);

  const sale = await prisma.sale.findFirst({
    where: { tenantId: ctx.tenantId, saleNumber: qaRef('02', 'SALE') },
  });
  const saleRow =
    sale ||
    (await prisma.sale.create({
      data: {
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        saleNumber: qaRef('02', 'SALE'),
        saleDate: new Date(),
        subtotal: amount,
        taxAmount: 0,
        total: amount,
        status: 'completed',
        paymentMethod: 'mobile_money',
        notes: `${QA_REF}scenario-2`,
      },
    }));

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}POS mobile money sale`,
    reference: qaRef('02', 'GL'),
    sourceType: 'sale',
    sourceId,
    lines: [
      { accountId: mobile.id, debitAmount: amount, creditAmount: 0 },
      { accountId: revenue.id, debitAmount: 0, creditAmount: amount },
    ],
  });

  return { saleId: saleRow.id, transactionId: transaction.id, mobileAccountId: mobile.id };
}

async function runScenario3(ctx) {
  const s1 = ctx.manifest.scenarios?.['1'];
  if (!s1?.transactionId) {
    const r1 = await runScenario1(ctx);
    ctx.manifest.scenarios['1'] = { ...ctx.manifest.scenarios['1'], ...r1 };
  }
  const originalId = ctx.manifest.scenarios['1'].transactionId;
  const sourceId = qaSourceId(3);

  const existing = await prisma.transaction.findFirst({
    where: { tenantId: ctx.tenantId, isReversal: true, reversedTransactionId: originalId },
  });
  if (existing) return { reversalTransactionId: existing.id, skipped: true };

  const { reverseGlEntry } = ctx.engine;
  const reversal = await reverseGlEntry({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    originalTransactionId: originalId,
    reason: `${QA_REF}scenario-3 POS sale reversal test`,
  });

  await prisma.transaction.update({
    where: { id: reversal.id },
    data: { sourceType: 'sale_reversal', sourceId, reference: qaRef('03', 'REV') },
  });

  return { reversalTransactionId: reversal.id };
}

async function runScenario4(ctx) {
  const { client } = ctx.master;
  const ar = await findGlAccount(ctx.tenantId, '1200');
  const revenue = await findGlAccount(ctx.tenantId, '4100');
  const amount = 50000;
  const sourceId = qaSourceId(4);

  let invoice = await prisma.invoice.findFirst({
    where: { tenantId: ctx.tenantId, invoiceNumber: qaRef('04', 'INV') },
  });
  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        clientId: client.id,
        createdById: ctx.userId,
        invoiceNumber: qaRef('04', 'INV'),
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: amount,
        taxAmount: 0,
        total: amount,
        status: 'sent',
        notes: `${QA_REF}scenario-4`,
      },
    });
  }

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}Invoice ${invoice.invoiceNumber}`,
    reference: qaRef('04', 'GL'),
    sourceType: 'invoice',
    sourceId,
    lines: [
      { accountId: ar.id, debitAmount: amount, creditAmount: 0 },
      { accountId: revenue.id, debitAmount: 0, creditAmount: amount },
    ],
  });

  return { invoiceId: invoice.id, transactionId: transaction.id };
}

async function runScenario5(ctx) {
  const { client } = ctx.master;
  const ar = await findGlAccount(ctx.tenantId, '1200');
  const cash = await findGlAccount(ctx.tenantId, '1110');
  const revenue = await findGlAccount(ctx.tenantId, '4100');
  const total = 80000;
  const partial = 30000;
  const sourceInv = qaSourceId(5, 'inv');
  const sourcePay1 = qaSourceId(5, 'pay1');
  const sourcePay2 = qaSourceId(5, 'pay2');

  let invoice = await prisma.invoice.findFirst({
    where: { tenantId: ctx.tenantId, invoiceNumber: qaRef('05', 'INV') },
  });
  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        clientId: client.id,
        createdById: ctx.userId,
        invoiceNumber: qaRef('05', 'INV'),
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: total,
        taxAmount: 0,
        total,
        status: 'partially paid',
        notes: `${QA_REF}scenario-5`,
      },
    });
  }

  await postBalanced(ctx, {
    description: `${QA_REF}Invoice ${invoice.invoiceNumber}`,
    reference: qaRef('05', 'GL-INV'),
    sourceType: 'invoice',
    sourceId: sourceInv,
    lines: [
      { accountId: ar.id, debitAmount: total, creditAmount: 0 },
      { accountId: revenue.id, debitAmount: 0, creditAmount: total },
    ],
  });

  const pay1Existing = await prisma.payment.findFirst({
    where: { tenantId: ctx.tenantId, reference: qaRef('05', 'PAY1') },
  });
  if (!pay1Existing) {
    await prisma.payment.create({
      data: {
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        amount: partial,
        paymentDate: new Date(),
        paymentMethod: 'cash',
        reference: qaRef('05', 'PAY1'),
        status: 'Completed',
      },
    });
  }

  await postBalanced(ctx, {
    description: `${QA_REF}Partial payment ${invoice.invoiceNumber}`,
    reference: qaRef('05', 'GL-PAY1'),
    sourceType: 'invoice_payment',
    sourceId: sourcePay1,
    lines: [
      { accountId: cash.id, debitAmount: partial, creditAmount: 0 },
      { accountId: ar.id, debitAmount: 0, creditAmount: partial },
    ],
  });

  const remainder = total - partial;
  const pay2Existing = await prisma.payment.findFirst({
    where: { tenantId: ctx.tenantId, reference: qaRef('05', 'PAY2') },
  });
  if (!pay2Existing) {
    await prisma.payment.create({
      data: {
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        amount: remainder,
        paymentDate: new Date(),
        paymentMethod: 'cash',
        reference: qaRef('05', 'PAY2'),
        status: 'Completed',
      },
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'paid' },
    });
  }

  const pay2 = await postBalanced(ctx, {
    description: `${QA_REF}Final payment ${invoice.invoiceNumber}`,
    reference: qaRef('05', 'GL-PAY2'),
    sourceType: 'invoice_payment',
    sourceId: sourcePay2,
    lines: [
      { accountId: cash.id, debitAmount: remainder, creditAmount: 0 },
      { accountId: ar.id, debitAmount: 0, creditAmount: remainder },
    ],
  });

  return { invoiceId: invoice.id, finalPaymentTxnId: pay2.transaction?.id };
}

async function runScenario6(ctx) {
  const { client } = ctx.master;
  const ar = await findGlAccount(ctx.tenantId, '1200');
  const revenue = await findGlAccount(ctx.tenantId, '4100');
  const amount = 12000;
  const sourceInv = qaSourceId(6, 'inv');
  const sourceRev = qaSourceId(6, 'rev');

  let invoice = await prisma.invoice.findFirst({
    where: { tenantId: ctx.tenantId, invoiceNumber: qaRef('06', 'INV') },
  });
  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        clientId: client.id,
        createdById: ctx.userId,
        invoiceNumber: qaRef('06', 'INV'),
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
        subtotal: amount,
        taxAmount: 0,
        total: amount,
        status: 'cancelled',
        notes: `${QA_REF}scenario-6 voided`,
      },
    });
  } else if (invoice.status !== 'cancelled') {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'cancelled' } });
  }

  const invTxn = await postBalanced(ctx, {
    description: `${QA_REF}Invoice ${invoice.invoiceNumber}`,
    reference: qaRef('06', 'GL-INV'),
    sourceType: 'invoice',
    sourceId: sourceInv,
    lines: [
      { accountId: ar.id, debitAmount: amount, creditAmount: 0 },
      { accountId: revenue.id, debitAmount: 0, creditAmount: amount },
    ],
  });

  let reversalTxn = await prisma.transaction.findFirst({
    where: {
      tenantId: ctx.tenantId,
      isReversal: true,
      reversedTransactionId: invTxn.transaction.id,
    },
  });
  if (!reversalTxn) {
    const { reverseGlEntry } = ctx.engine;
    reversalTxn = await reverseGlEntry({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      originalTransactionId: invTxn.transaction.id,
      reason: `${QA_REF}scenario-6 void test`,
    });
    await prisma.transaction.update({
      where: { id: reversalTxn.id },
      data: {
        sourceType: 'invoice_reversal',
        sourceId: sourceRev,
        reference: qaRef('06', 'GL-REV'),
      },
    });
  }

  return { invoiceId: invoice.id, reversalTransactionId: reversalTxn.id };
}

async function runScenario7(ctx) {
  const cash = await findGlAccount(ctx.tenantId, '1110');
  const expenseAcct = await findGlAccount(ctx.tenantId, '5310').catch(() =>
    findGlAccount(ctx.tenantId, '5110')
  );
  const amount = 7500;
  const sourceId = qaSourceId(7);

  let expense = await prisma.expense.findFirst({
    where: { tenantId: ctx.tenantId, paymentReference: qaRef('07', 'EXP') },
  });
  if (!expense) {
    expense = await prisma.expense.create({
      data: {
        tenantId: ctx.tenantId,
        submittedById: ctx.userId,
        description: `${QA_REF}Utilities expense (cash)`,
        amount,
        date: new Date(),
        category: expenseAcct.accountName || expenseAcct.name || 'Utilities',
        expenseAccountId: expenseAcct.id,
        status: 'Approved',
        paymentStatus: 'Fully paid',
        paymentMethod: 'cash',
        paymentReference: qaRef('07', 'EXP'),
        notes: `${QA_REF}scenario-7`,
      },
    });
  }

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}Expense paid cash`,
    reference: qaRef('07', 'GL'),
    sourceType: 'expense',
    sourceId,
    lines: [
      { accountId: expenseAcct.id, debitAmount: amount, creditAmount: 0 },
      { accountId: cash.id, debitAmount: 0, creditAmount: amount },
    ],
  });

  return { expenseId: expense.id, transactionId: transaction.id };
}

async function runScenario8(ctx) {
  const ap = await findGlAccount(ctx.tenantId, '2110');
  const expenseAcct = await findGlAccount(ctx.tenantId, '5110').catch(() =>
    findGlAccount(ctx.tenantId, '5310')
  );
  const amount = 22000;
  const sourceId = qaSourceId(8);

  let expense = await prisma.expense.findFirst({
    where: { tenantId: ctx.tenantId, paymentReference: qaRef('08', 'EXP') },
  });
  if (!expense) {
    expense = await prisma.expense.create({
      data: {
        tenantId: ctx.tenantId,
        submittedById: ctx.userId,
        supplierId: ctx.master.supplier.id,
        description: `${QA_REF}Purchases on AP`,
        amount,
        date: new Date(),
        category: expenseAcct.accountName || expenseAcct.name || 'Purchases',
        expenseAccountId: expenseAcct.id,
        status: 'Approved',
        paymentStatus: 'Unpaid',
        paymentReference: qaRef('08', 'EXP'),
        notes: `${QA_REF}scenario-8`,
      },
    });
  }

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}Expense on AP`,
    reference: qaRef('08', 'GL'),
    sourceType: 'expense',
    sourceId,
    lines: [
      { accountId: expenseAcct.id, debitAmount: amount, creditAmount: 0 },
      { accountId: ap.id, debitAmount: 0, creditAmount: amount },
    ],
  });

  return { expenseId: expense.id, transactionId: transaction.id };
}

async function runScenario9(ctx) {
  const { supplier } = ctx.master;
  const ap = await findGlAccount(ctx.tenantId, '2110');
  const expenseAcct = await findGlAccount(ctx.tenantId, '5110').catch(() =>
    findGlAccount(ctx.tenantId, '5310')
  );
  const cash = await findGlAccount(ctx.tenantId, '1110');
  const billTotal = 45000;
  const sourceBill = qaSourceId(9, 'bill');
  const sourcePay = qaSourceId(9, 'pay');

  let bill = await prisma.supplierBill.findFirst({
    where: { tenantId: ctx.tenantId, billNumber: qaRef('09', 'BILL') },
  });
  if (!bill) {
    bill = await prisma.supplierBill.create({
      data: {
        tenantId: ctx.tenantId,
        supplierId: supplier.id,
        billNumber: qaRef('09', 'BILL'),
        billDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: billTotal,
        taxAmount: 0,
        totalAmount: billTotal,
        amountPaid: billTotal,
        status: 'Paid',
        notes: `${QA_REF}scenario-9`,
        createdById: ctx.userId,
        items: {
          create: [
            {
              lineNumber: 1,
              description: `${QA_REF}Office supplies`,
              quantity: 1,
              unitCost: billTotal,
              lineTotal: billTotal,
              expenseAccountId: expenseAcct.id,
            },
          ],
        },
      },
    });
  }

  await postBalanced(ctx, {
    description: `${QA_REF}Supplier bill ${bill.billNumber}`,
    reference: qaRef('09', 'GL-BILL'),
    sourceType: 'supplier_bill',
    sourceId: sourceBill,
    lines: [
      { accountId: expenseAcct.id, debitAmount: billTotal, creditAmount: 0 },
      { accountId: ap.id, debitAmount: 0, creditAmount: billTotal },
    ],
  });

  const payExisting = await prisma.supplierPayment.findFirst({
    where: { tenantId: ctx.tenantId, paymentNumber: qaRef('09', 'PAY') },
  });
  if (!payExisting) {
    await prisma.supplierPayment.create({
      data: {
        tenantId: ctx.tenantId,
        supplierId: supplier.id,
        paymentNumber: qaRef('09', 'PAY'),
        paymentDate: new Date(),
        paymentMethod: 'cash',
        referenceNumber: qaRef('09', 'PAY-REF'),
        totalAmount: billTotal,
        createdById: ctx.userId,
        allocations: {
          create: [{ tenantId: ctx.tenantId, billId: bill.id, amount: billTotal }],
        },
      },
    });
  }

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}Supplier payment ${bill.billNumber}`,
    reference: qaRef('09', 'GL-PAY'),
    sourceType: 'supplier_payment',
    sourceId: sourcePay,
    lines: [
      { accountId: ap.id, debitAmount: billTotal, creditAmount: 0 },
      { accountId: cash.id, debitAmount: 0, creditAmount: billTotal },
    ],
  });

  return { billId: bill.id, transactionId: transaction.id };
}

async function runScenario10(ctx) {
  const jiti = createJiti(__filename, {
    interopDefault: true,
    alias: { '@': path.join(__dirname, '..') },
  });
  const { updateAccountBalanceOnTransaction } = jiti(
    path.join(__dirname, '..', 'lib/accountBalanceService.js')
  );

  const cash = await findGlAccount(ctx.tenantId, '1110');
  const revenue = await findGlAccount(ctx.tenantId, '4100');
  const amount = 5000;
  const ref = qaRef('10', 'JE');

  const existing = await prisma.journalEntry.findFirst({
    where: { tenantId: ctx.tenantId, referenceNumber: ref },
  });
  if (existing?.status === 'Posted') {
    return { journalEntryId: existing.id, skipped: true };
  }

  const entry = await prisma.$transaction(async (tx) => {
    const je = await tx.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        entryDate: new Date(),
        referenceNumber: ref,
        description: `${QA_REF}Manual journal test`,
        sourceType: 'manual_journal',
        sourceId: qaSourceId(10),
        status: 'Posted',
        transactionId: null,
        createdById: ctx.userId,
        postedById: ctx.userId,
        postedDate: new Date(),
        lines: {
          create: [
            {
              lineNumber: 1,
              accountId: cash.id,
              debitAmount: amount,
              creditAmount: 0,
              description: 'Cash received',
            },
            {
              lineNumber: 2,
              accountId: revenue.id,
              debitAmount: 0,
              creditAmount: amount,
              description: 'Service revenue',
            },
          ],
        },
      },
      include: { lines: true },
    });

    for (const line of je.lines) {
      await updateAccountBalanceOnTransaction(
        line.accountId,
        Number(line.debitAmount),
        Number(line.creditAmount),
        tx
      );
    }
    return je;
  });

  return { journalEntryId: entry.id };
}

async function runScenario11(ctx) {
  const s10 = ctx.manifest.scenarios?.['10'];
  if (!s10?.journalEntryId) {
    const r10 = await runScenario10(ctx);
    ctx.manifest.scenarios['10'] = { ...ctx.manifest.scenarios['10'], ...r10 };
  }

  const original = await prisma.journalEntry.findUnique({
    where: { id: ctx.manifest.scenarios['10'].journalEntryId },
    include: { lines: true },
  });
  if (!original) throw new Error('Scenario 10 journal not found for reversal');

  const ref = qaRef('11', 'JE-REV');
  const existing = await prisma.journalEntry.findFirst({
    where: { tenantId: ctx.tenantId, referenceNumber: ref },
  });
  if (existing) return { reversalJournalEntryId: existing.id, skipped: true };

  const jiti = createJiti(__filename, {
    interopDefault: true,
    alias: { '@': path.join(__dirname, '..') },
  });
  const { updateAccountBalanceOnTransaction } = jiti(
    path.join(__dirname, '..', 'lib/accountBalanceService.js')
  );

  const reversal = await prisma.$transaction(async (tx) => {
    const je = await tx.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        entryDate: new Date(),
        referenceNumber: ref,
        description: `${QA_REF}Manual journal reversal`,
        sourceType: 'manual_journal_reversal',
        sourceId: qaSourceId(11),
        status: 'Posted',
        transactionId: null,
        createdById: ctx.userId,
        postedById: ctx.userId,
        postedDate: new Date(),
        notes: `${QA_REF}scenario-11`,
        lines: {
          create: original.lines.map((line, idx) => ({
            lineNumber: idx + 1,
            accountId: line.accountId,
            debitAmount: Number(line.creditAmount),
            creditAmount: Number(line.debitAmount),
            description: `Reversal: ${line.description || ''}`.trim(),
          })),
        },
      },
      include: { lines: true },
    });

    for (const line of je.lines) {
      await updateAccountBalanceOnTransaction(
        line.accountId,
        Number(line.debitAmount),
        Number(line.creditAmount),
        tx
      );
    }
    return je;
  });

  return { reversalJournalEntryId: reversal.id };
}

async function runScenario12(ctx) {
  const capitalHelpers = loadCapitalHelpers();
  const parent = await capitalHelpers.ensureCapitalParentAccount(ctx.tenantId, prisma);
  const equityChild = await capitalHelpers.createContributionSubAccount(
    ctx.tenantId,
    parent,
    prisma,
    `${QA_REF}Owner Cash`
  );
  const cash = await findGlAccount(ctx.tenantId, '1110');
  const amount = 100000;
  const sourceId = qaSourceId(12);

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}Capital contribution`,
    reference: qaRef('12', 'GL'),
    sourceType: 'capital_contribution',
    sourceId,
    lines: [
      { accountId: cash.id, debitAmount: amount, creditAmount: 0 },
      { accountId: equityChild.id, debitAmount: 0, creditAmount: amount },
    ],
  });

  await prisma.tenantSettings.updateMany({
    where: { tenantId: ctx.tenantId },
    data: { ownerContributedCapital: amount },
  });

  return { transactionId: transaction.id, equityAccountId: equityChild.id };
}

async function runScenario13(ctx) {
  const s12 = ctx.manifest.scenarios?.['12'];
  if (!s12?.equityAccountId) {
    const r12 = await runScenario12(ctx);
    ctx.manifest.scenarios['12'] = { ...ctx.manifest.scenarios['12'], ...r12 };
  }
  const equity = await prisma.account.findUnique({
    where: { id: ctx.manifest.scenarios['12'].equityAccountId },
  });
  const cash = await findGlAccount(ctx.tenantId, '1110');
  const amount = 15000;
  const sourceId = qaSourceId(13);

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}Owner withdrawal`,
    reference: qaRef('13', 'GL'),
    sourceType: 'owner_withdrawal',
    sourceId,
    lines: [
      { accountId: equity.id, debitAmount: amount, creditAmount: 0 },
      { accountId: cash.id, debitAmount: 0, creditAmount: amount },
    ],
  });

  return { transactionId: transaction.id };
}

async function runScenario14(ctx) {
  const cash = await findGlAccount(ctx.tenantId, '1110');
  const bank = await findBankLeaf(ctx.tenantId);
  const amount = 20000;
  const sourceId = qaSourceId(14);

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}Bank transfer cash to bank`,
    reference: qaRef('14', 'GL'),
    sourceType: 'bank_transfer',
    sourceId,
    lines: [
      { accountId: bank.id, debitAmount: amount, creditAmount: 0 },
      { accountId: cash.id, debitAmount: 0, creditAmount: amount },
    ],
  });

  return { transactionId: transaction.id, bankAccountId: bank.id };
}

async function runScenario15(ctx) {
  const salary = await findGlAccount(ctx.tenantId, '5200');
  const paye = await findGlAccount(ctx.tenantId, '2130');
  const cash = await findGlAccount(ctx.tenantId, '1110');
  const gross = 120000;
  const payeAmt = 18000;
  const net = gross - payeAmt;
  const sourceId = qaSourceId(15);

  const { transaction } = await postBalanced(ctx, {
    description: `${QA_REF}Payroll run`,
    reference: qaRef('15', 'GL'),
    sourceType: 'payroll',
    sourceId,
    lines: [
      { accountId: salary.id, debitAmount: gross, creditAmount: 0 },
      { accountId: paye.id, debitAmount: 0, creditAmount: payeAmt },
      { accountId: cash.id, debitAmount: 0, creditAmount: net },
    ],
  });

  return { transactionId: transaction.id };
}

async function runScenario16(ctx) {
  const period = await ensureOpenPeriod(ctx);
  return { accountingPeriodId: period.id, status: period.status };
}

async function runScenario17(ctx) {
  const lastYear = new Date().getFullYear() - 1;
  const start = new Date(lastYear, 0, 1);
  const end = new Date(lastYear, 11, 31, 23, 59, 59, 999);

  let period = await prisma.accountingPeriod.findFirst({
    where: { tenantId: ctx.tenantId, periodType: 'Yearly', startDate: start },
  });
  if (!period) {
    period = await prisma.accountingPeriod.create({
      data: {
        tenantId: ctx.tenantId,
        name: `${QA_REF}FY ${lastYear} (closed)`,
        periodType: 'Yearly',
        startDate: start,
        endDate: end,
        status: 'closed',
        closedAt: new Date(),
        closedById: ctx.userId,
      },
    });
  } else if (period.status !== 'closed') {
    period = await prisma.accountingPeriod.update({
      where: { id: period.id },
      data: { status: 'closed', closedAt: new Date(), closedById: ctx.userId },
    });
  }

  return { accountingPeriodId: period.id, status: period.status };
}

async function runScenario18(ctx) {
  const { client } = ctx.master;
  const ar = await findGlAccount(ctx.tenantId, '1200');
  const revenue = await findGlAccount(ctx.tenantId, '4100');
  const invoiceTotal = 35000;
  const postedAr = 20000;
  const sourceInv = qaSourceId(18, 'inv');
  const sourceMismatch = qaSourceId(18, 'mismatch');

  let invoice = await prisma.invoice.findFirst({
    where: { tenantId: ctx.tenantId, invoiceNumber: qaRef('18', 'INV') },
  });
  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        clientId: client.id,
        createdById: ctx.userId,
        invoiceNumber: qaRef('18', 'INV'),
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: invoiceTotal,
        taxAmount: 0,
        total: invoiceTotal,
        status: 'sent',
        notes: `${QA_REF}scenario-18 AR mismatch (subledger > GL)`,
      },
    });
  }

  await postBalanced(ctx, {
    description: `${QA_REF}Partial AR for mismatch invoice`,
    reference: qaRef('18', 'GL-PARTIAL'),
    sourceType: 'invoice',
    sourceId: sourceInv,
    lines: [
      { accountId: ar.id, debitAmount: postedAr, creditAmount: 0 },
      { accountId: revenue.id, debitAmount: 0, creditAmount: postedAr },
    ],
  });

  return {
    invoiceId: invoice.id,
    invoiceTotal,
    postedAr,
    expectedMismatch: invoiceTotal - postedAr,
    note: 'Sub-ledger balance exceeds GL 1200 by design (Phase 4 reconciliation test)',
    sourceId: sourceMismatch,
  };
}

async function runScenario19(ctx) {
  const capitalHelpers = loadCapitalHelpers();
  const parent = await capitalHelpers.ensureCapitalParentAccount(ctx.tenantId, prisma);
  const cash = await findGlAccount(ctx.tenantId, '1110');
  const amount = 5000;
  const ref = qaRef('19', 'LEGACY');

  const existing = await prisma.journalEntry.findFirst({
    where: { tenantId: ctx.tenantId, referenceNumber: ref },
  });
  if (existing) return { legacyJournalIds: [existing.id], skipped: true };

  const equityChild = await capitalHelpers.createContributionSubAccount(
    ctx.tenantId,
    parent,
    prisma,
    `${QA_REF}Legacy`
  );

  const debitRow = await prisma.journalEntry.create({
    data: {
      tenantId: ctx.tenantId,
      createdById: ctx.userId,
      postedById: ctx.userId,
      entryDate: new Date(),
      postedDate: new Date(),
      description: `${QA_REF}Legacy capital debit (header-only)`,
      referenceNumber: ref,
      status: 'Posted',
      sourceType: 'legacy_capital',
      sourceId: qaSourceId(19, 'debit'),
      accountId: cash.id,
      debit: amount,
      credit: 0,
      notes: `${QA_REF}scenario-19 Phase 5 backfill target`,
    },
  });

  const creditRow = await prisma.journalEntry.create({
    data: {
      tenantId: ctx.tenantId,
      createdById: ctx.userId,
      postedById: ctx.userId,
      entryDate: new Date(),
      postedDate: new Date(),
      description: `${QA_REF}Legacy capital credit (header-only)`,
      referenceNumber: `${ref}-CR`,
      status: 'Posted',
      sourceType: 'legacy_capital',
      sourceId: qaSourceId(19, 'credit'),
      accountId: equityChild.id,
      debit: 0,
      credit: amount,
    },
  });

  await prisma.account.update({
    where: { id: cash.id },
    data: { balance: { increment: amount } },
  });
  await prisma.account.update({
    where: { id: equityChild.id },
    data: { balance: { increment: amount } },
  });

  return { legacyJournalIds: [debitRow.id, creditRow.id] };
}

const SCENARIO_RUNNERS = {
  1: runScenario1,
  2: runScenario2,
  3: runScenario3,
  4: runScenario4,
  5: runScenario5,
  6: runScenario6,
  7: runScenario7,
  8: runScenario8,
  9: runScenario9,
  10: runScenario10,
  11: runScenario11,
  12: runScenario12,
  13: runScenario13,
  14: runScenario14,
  15: runScenario15,
  16: runScenario16,
  17: runScenario17,
  18: runScenario18,
  19: runScenario19,
};

async function runAllScenarios(ctx) {
  for (const def of SCENARIO_DEFS) {
    const prev = ctx.manifest.scenarios[String(def.id)];
    const needsCogsBackfill = def.id === 1 && prev?.status === 'ok' && !prev?.cogsTransactionId;
    if (prev?.status === 'ok' && !process.argv.includes('--force') && !needsCogsBackfill) {
      console.log(`  [skip] Scenario ${def.id}: ${def.name} (already seeded)`);
      continue;
    }

    process.stdout.write(`  Scenario ${def.id}: ${def.name}… `);
    try {
      const result = await SCENARIO_RUNNERS[def.id](ctx);
      ctx.manifest.scenarios[String(def.id)] = {
        name: def.name,
        status: 'ok',
        seededAt: new Date().toISOString(),
        ...result,
      };
      console.log('ok');
    } catch (err) {
      ctx.manifest.scenarios[String(def.id)] = {
        name: def.name,
        status: 'error',
        error: err.message || String(err),
      };
      console.log(`FAILED — ${err.message}`);
    }
  }
}

async function main() {
  const tenantName = process.argv[2];
  const email = process.argv[3];
  const userName = process.argv[4];
  const password = process.argv[5];

  if (!tenantName || !email || !userName || !password) {
    console.log(
      'Usage: node scripts/accounting-qa-scenarios.cjs "<tenantName>" <email> "<userName>" <password>'
    );
    process.exit(1);
  }

  console.log('\n🔧 Accounting QA scenario seeder\n');

  const { tenant, user } = await bootstrapTenant(tenantName, email, userName, password);
  const engine = loadEngine();
  const manifest = readManifest();

  manifest.tenantId = tenant.id;
  manifest.tenantName = tenant.name;
  manifest.email = email;
  manifest.updatedAt = new Date().toISOString();
  if (!manifest.scenarios) manifest.scenarios = {};

  const ctx = {
    tenantId: tenant.id,
    userId: user.id,
    engine,
    manifest,
    master: await ensureMasterData({ tenantId: tenant.id, userId: user.id }),
  };

  await ensureOpenPeriod(ctx);
  console.log('Running scenarios 1–19…\n');
  await runAllScenarios(ctx);

  manifest.seededAt = manifest.updatedAt;
  writeManifest(manifest);

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } });
  const wizardState =
    settings?.setupWizardState && typeof settings.setupWizardState === 'object'
      ? settings.setupWizardState
      : {};
  await prisma.tenantSettings.update({
    where: { tenantId: tenant.id },
    data: {
      setupWizardState: {
        ...wizardState,
        qaAccountingManifest: {
          path: '.qa-scenario-manifest.json',
          tenantId: tenant.id,
          scenarioCount: Object.keys(manifest.scenarios).length,
          updatedAt: manifest.updatedAt,
        },
      },
    },
  });

  const ok = Object.values(manifest.scenarios).filter((s) => s.status === 'ok').length;
  const failed = Object.values(manifest.scenarios).filter((s) => s.status === 'error').length;

  console.log('\n✅ QA seed complete\n');
  console.log('Tenant:', tenant.name);
  console.log('Tenant ID:', tenant.id);
  console.log('Login:', `${APP_URL}/auth/login`);
  console.log('Email:', email);
  console.log('Password:', password);
  console.log(`Scenarios: ${ok} ok, ${failed} failed`);
  console.log('Manifest:', MANIFEST_PATH);
  console.log('\nVerify: npm run verify:accounting-scenario\n');

  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error('❌ QA seed failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
