#!/usr/bin/env node
/**
 * Delete QA-Accounting tenant operational data; keep Chart of Accounts structure.
 *
 * Usage:
 *   npm run delete-test-data
 *   npm run delete-test-data -- --dry-run
 *   node scripts/delete-test-data.js --tenant=QA-Accounting --dry-run
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DEFAULT_TENANT = 'QA-Accounting';
const QA_PREFIX = 'QA-';

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const dryRun = process.argv.includes('--dry-run');
const tenantName = arg('tenant') || DEFAULT_TENANT;

async function countWhere(model, where) {
  return prisma[model].count({ where });
}

async function deleteMany(model, where, label) {
  const n = await countWhere(model, where);
  if (n === 0) {
    console.log(`  ${label}: 0 (skip)`);
    return 0;
  }
  if (dryRun) {
    console.log(`  [dry-run] ${label}: would delete ${n}`);
    return n;
  }
  const result = await prisma[model].deleteMany({ where });
  console.log(`  ${label}: deleted ${result.count}`);
  return result.count;
}

async function clearOperationalData(tenantId) {
  console.log(`\nClearing operational data for tenant ${tenantId}${dryRun ? ' (dry-run)' : ''}…\n`);

  await deleteMany('paymentAllocation', { payment: { tenantId } }, 'PaymentAllocation');
  await deleteMany('payment', { tenantId }, 'Payment');
  await deleteMany('invoiceItem', { invoice: { tenantId } }, 'InvoiceItem');
  await deleteMany('invoiceAttachment', { invoice: { tenantId } }, 'InvoiceAttachment');
  await deleteMany('invoiceRefund', { invoice: { tenantId } }, 'InvoiceRefund');
  await deleteMany('invoice', { tenantId }, 'Invoice');
  await deleteMany('saleItem', { sale: { tenantId } }, 'SaleItem');
  await deleteMany('sale', { tenantId }, 'Sale');
  await deleteMany('expenseAttachment', { expense: { tenantId } }, 'ExpenseAttachment');
  await deleteMany('expense', { tenantId }, 'Expense');
  await deleteMany('supplierPaymentAllocation', { tenantId }, 'SupplierPaymentAllocation');
  await deleteMany('supplierPayment', { tenantId }, 'SupplierPayment');
  await deleteMany('supplierBillItem', { bill: { tenantId } }, 'SupplierBillItem');

  if (!dryRun) {
    await prisma.supplierBill.updateMany({
      where: { tenantId },
      data: { journalEntryId: null },
    });
  } else {
    const bills = await countWhere('supplierBill', { tenantId });
    if (bills) console.log(`  [dry-run] SupplierBill journalEntryId: would null ${bills}`);
  }

  await deleteMany('supplierBill', { tenantId }, 'SupplierBill');
  await deleteMany('journalEntryLine', { journalEntry: { tenantId } }, 'JournalEntryLine');
  await deleteMany('journalEntry', { tenantId }, 'JournalEntry');
  await deleteMany('transactionLine', { transaction: { tenantId } }, 'TransactionLine');
  await deleteMany('transaction', { tenantId }, 'Transaction');
  await deleteMany('accountingPeriod', { tenantId }, 'AccountingPeriod');

  await deleteMany('client', { tenantId, name: { startsWith: QA_PREFIX } }, 'Client (QA-)');
  await deleteMany('supplier', { tenantId, supplierName: { startsWith: QA_PREFIX } }, 'Supplier (QA-)');
  await deleteMany('product', { tenantId, sku: { startsWith: QA_PREFIX } }, 'Product (QA-)');

  const accountCount = await countWhere('account', { tenantId });
  if (dryRun) {
    console.log(`  [dry-run] Account.balance: would zero ${accountCount} accounts`);
  } else {
    const reset = await prisma.account.updateMany({
      where: { tenantId },
      data: { balance: 0 },
    });
    console.log(`  Account.balance: zeroed ${reset.count} accounts (CoA kept)`);
  }

  if (!dryRun) {
    await prisma.tenantSettings.updateMany({
      where: { tenantId },
      data: { ownerContributedCapital: 0 },
    });
  }
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: tenantName.trim() } });
  if (!tenant) {
    console.error(`Tenant "${tenantName}" not found.`);
    process.exit(1);
  }

  await clearOperationalData(tenant.id);

  console.log(`\n✅ ${dryRun ? 'Dry-run complete' : 'QA operational data cleared'} for "${tenantName}"`);
  console.log('Chart of Accounts structure preserved.\n');
}

main()
  .catch((err) => {
    console.error('❌ Delete failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
