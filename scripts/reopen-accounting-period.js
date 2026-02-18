/**
 * Reopen one or more closed accounting periods (e.g. after a DB restore).
 * Usage:
 *   node scripts/reopen-accounting-period.js "Feb 2026"
 *   node scripts/reopen-accounting-period.js "Feb 2026" --tenant=cmf29axmg00g9jqsqvxb01tge
 *   node scripts/reopen-accounting-period.js  # reopens all closed periods that contain today's date
 *
 * Requires: dotenv, prisma
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const periodNameFilter = args.find((a) => !a.startsWith('--'));
const tenantArg = args.find((a) => a.startsWith('--tenant='));
const tenantId = tenantArg ? tenantArg.split('=')[1] : null;

async function main() {
  const now = new Date();
  const where = {
    status: 'closed',
  };
  if (tenantId) where.tenantId = tenantId;
  if (periodNameFilter) where.name = { contains: periodNameFilter, mode: 'insensitive' };

  const closed = await prisma.accountingPeriod.findMany({
    where,
    select: { id: true, tenantId: true, name: true, startDate: true, endDate: true },
  });

  if (closed.length === 0) {
    console.log('No closed accounting periods found matching criteria.');
    if (periodNameFilter) console.log('Filter:', periodNameFilter);
    if (tenantId) console.log('Tenant:', tenantId);
    return;
  }

  console.log(`Reopening ${closed.length} period(s):`);
  closed.forEach((p) => console.log(`  - ${p.name} (${p.tenantId}) ${p.startDate.toISOString().slice(0, 10)} → ${p.endDate.toISOString().slice(0, 10)}`));

  const reason = 'Reopened via script (e.g. after DB restore)';
  for (const period of closed) {
    await prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: 'open',
        reopenedAt: now,
        reopenReason: reason,
        reopenedById: null,
      },
    });
    console.log(`  Reopened: ${period.name}`);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
