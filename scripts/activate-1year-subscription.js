/**
 * Activate a 1-year (paid) subscription for a tenant.
 * Finds tenant by name (fuzzy) or by ID, deactivates existing subscriptions, creates new one.
 *
 * Usage:
 *   node scripts/activate-1year-subscription.js "G & M Boutique & Interiors" 300000 2027-02-19
 *   node scripts/activate-1year-subscription.js <tenantId> 300000 2027-02-19
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const nameOrId = process.argv[2];
  const amount = parseFloat(process.argv[3]);
  const expiryStr = process.argv[4]; // YYYY-MM-DD

  if (!nameOrId || !expiryStr) {
    console.error('Usage: node scripts/activate-1year-subscription.js "<tenant name or id>" <amount> <expiry YYYY-MM-DD>');
    console.error('Example: node scripts/activate-1year-subscription.js "G & M Boutique & Interiors" 300000 2027-02-19');
    process.exit(1);
  }

  const expiryDate = new Date(expiryStr);
  if (Number.isNaN(expiryDate.getTime())) {
    console.error('Invalid expiry date. Use YYYY-MM-DD (e.g. 2027-02-19).');
    process.exit(1);
  }

  const amt = Number.isFinite(amount) ? amount : 300000;

  // Resolve tenant: by ID (cuid) or by name (contains)
  let tenant = null;
  if (nameOrId.length >= 20 && !nameOrId.includes(' ')) {
    tenant = await prisma.tenant.findUnique({ where: { id: nameOrId } });
  }
  if (!tenant) {
    const tenants = await prisma.tenant.findMany({
      where: { name: { contains: nameOrId, mode: 'insensitive' } },
      select: { id: true, name: true }
    });
    if (tenants.length === 0) {
      console.error('No tenant found matching:', nameOrId);
      process.exit(1);
    }
    if (tenants.length > 1) {
      console.log('Multiple tenants found. Using first match.');
      tenants.forEach((t, i) => console.log(`  ${i + 1}. ${t.name} (${t.id})`));
    }
    tenant = tenants[0];
  }

  console.log('Tenant:', tenant.name, '(' + tenant.id + ')');
  console.log('Amount:', amt, 'MWK');
  console.log('Expires:', expiryDate.toISOString().slice(0, 10));

  // Deactivate existing subscriptions
  const updated = await prisma.accountSubscription.updateMany({
    where: { tenantId: tenant.id },
    data: { isActive: false, status: 'Replaced' }
  });
  if (updated.count > 0) {
    console.log('Deactivated', updated.count, 'existing subscription(s).');
  }

  const startDate = new Date();
  const txRef = `1YEAR_${tenant.id}_${Date.now()}`;

  const sub = await prisma.accountSubscription.create({
    data: {
      tenantId: tenant.id,
      plan: '1 Year',
      txRef,
      amount: amt,
      currency: 'MWK',
      status: 'Active',
      paymentMethod: 'manual',
      isActive: true,
      isTrial: false,
      startedAt: startDate,
      expiresAt: expiryDate,
      paymentDate: startDate,
      notes: '1-year subscription activated via script'
    }
  });

  console.log('\n✅ 1-year subscription activated.');
  console.log('  ID:', sub.id);
  console.log('  Expires:', sub.expiresAt.toISOString().slice(0, 10));
  console.log('  Reference:', sub.txRef);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
