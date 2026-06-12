/**
 * Reparent an existing 1310–1399 inventory detail account under the canonical 1300 Inventory row.
 * Use when goods receipts fail with "Could not allocate an inventory detail account (codes 1310–1399)".
 *
 * Usage:
 *   node scripts/repair-inventory-coa-children.cjs --tenantId=<cuid> [--execute]
 *   node scripts/repair-inventory-coa-children.cjs --subdomain=<subdomain> [--execute]
 */
require('dotenv').config();
const prisma = require('../lib/prisma').default || require('../lib/prisma');

function isClearlyNotInventory(account) {
  if (!account) return true;
  const code = String(account.accountCode ?? account.code ?? '').trim();
  if (code === '1200') return true;
  const name = String(account.accountName ?? account.name ?? '').toLowerCase();
  if (name.includes('receivable') && !name.includes('inventory') && !name.includes('stock')) {
    return true;
  }
  if (code === '1300' && name.includes('receivable') && !name.includes('inventory') && !name.includes('stock')) {
    return true;
  }
  return false;
}

async function reuseExistingInventoryDetailAccount(tenantId, parentInventoryId, tx) {
  for (let n = 1310; n <= 1399; n += 1) {
    const codeStr = String(n);
    const existing = await tx.account.findFirst({
      where: {
        tenantId,
        accountCode: codeStr,
        isActive: true,
        mergedIntoAccountId: null,
      },
    });
    if (!existing || isClearlyNotInventory(existing)) continue;
    if (existing.parentAccountId === parentInventoryId) return existing;

    const patch = {
      parentAccountId: parentInventoryId,
      acceptsNewTransactions: true,
    };
    if (!existing.accountType) patch.accountType = 'Asset';
    const subtype = String(existing.accountSubtype || '').trim();
    if (!subtype || subtype.toLowerCase() === 'group') {
      patch.accountSubtype = 'Current Asset';
    }
    if (!existing.normalBalance) patch.normalBalance = 'Debit';

    return tx.account.update({
      where: { id: existing.id },
      data: patch,
    });
  }
  return null;
}

async function pickInventory1300(tenantId, tx) {
  const rows = await tx.account.findMany({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Asset',
      accountCode: '1300',
      NOT: {
        OR: [
          { accountCode: '1200' },
          { accountName: { contains: 'Receivable', mode: 'insensitive' } },
        ],
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 25,
  });

  const usable = rows.filter((r) => !isClearlyNotInventory(r));
  if (!usable.length) return null;

  const stock1310 = await tx.account.findFirst({
    where: { tenantId, accountCode: '1310', isActive: true, mergedIntoAccountId: null },
    select: { parentAccountId: true },
  });
  if (stock1310?.parentAccountId) {
    const match = usable.find((r) => r.id === stock1310.parentAccountId);
    if (match) return match;
  }

  const withParent = usable.find((r) => r.parentAccountId);
  return withParent || usable[0];
}

async function parseArgs() {
  const args = process.argv.slice(2);
  let tenantId = null;
  let subdomain = null;
  let execute = false;
  for (const a of args) {
    if (a === '--execute') execute = true;
    const idMatch = /^--tenantId=(.+)$/.exec(a);
    if (idMatch) tenantId = idMatch[1];
    const subMatch = /^--subdomain=(.+)$/.exec(a);
    if (subMatch) subdomain = subMatch[1];
  }
  return { tenantId, subdomain, execute };
}

async function resolveTenantId({ tenantId, subdomain }) {
  if (tenantId) return tenantId;
  if (subdomain) {
    const tenant = await prisma.tenant.findFirst({
      where: { subdomain },
      select: { id: true, name: true, subdomain: true },
    });
    if (!tenant) throw new Error(`Tenant not found for subdomain: ${subdomain}`);
    return tenant.id;
  }
  throw new Error('Provide --tenantId=<cuid> or --subdomain=<subdomain>');
}

async function main() {
  const { tenantId: tenantIdArg, subdomain, execute } = await parseArgs();
  const tenantId = await resolveTenantId({ tenantId: tenantIdArg, subdomain });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, subdomain: true },
  });

  const detailCount = await prisma.account.count({
    where: { tenantId, accountCode: { gte: '1310', lte: '1399' } },
  });

  const inv1300 = await pickInventory1300(tenantId, prisma);

  console.log(JSON.stringify({ tenant, detailAccounts1310to1399: detailCount, inventory1300: inv1300 }, null, 2));

  if (!inv1300) {
    throw new Error('No usable 1300 Inventory account found for this tenant.');
  }

  if (!execute) {
    console.log('\nDry run only. Re-run with --execute to reparent 1310 (or next free detail) under 1300.');
    return;
  }

  const leaf = await prisma.$transaction((tx) =>
    reuseExistingInventoryDetailAccount(tenantId, inv1300.id, tx)
  );

  if (!leaf) {
    throw new Error('No reusable 1310–1399 account found to reparent under 1300.');
  }

  console.log('\nRepaired posting leaf:', {
    id: leaf.id,
    accountCode: leaf.accountCode,
    accountName: leaf.accountName,
    parentAccountId: leaf.parentAccountId,
    accountSubtype: leaf.accountSubtype,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
