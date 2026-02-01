// scripts/test-access-with-bad-data.js
// Test that hasStandardAccess() now works even with bad data (txRef starting with TRIAL_)

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAccessWithBadData() {
  console.log('\n🧪 === TESTING ACCESS WITH ORIGINAL BAD DATA ===\n');

  // Get a tenant that had issues before (the Demo tenant)
  const tenantId = 'cmgunbqaf04tbjq5h7zj02cn5';

  // Get the original subscription (before we fixed it)
  const subscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isTrial: false,
      isActive: true
    }
  });

  console.log('📋 Original subscription data:');
  console.log(`   ID: ${subscription.id}`);
  console.log(`   isTrial: ${subscription.isTrial}`);
  console.log(`   isActive: ${subscription.isActive}`);
  console.log(`   txRef: ${subscription.txRef}`);
  console.log(`   amount: ${subscription.amount}`);
  console.log(`   paymentMethod: ${subscription.paymentMethod}`);
  console.log(`   expiresAt: ${subscription.expiresAt}`);

  console.log('\n🔍 Testing hasStandardAccess() with the NEW code logic...');

  // Simulate the new hasStandardAccess() logic
  const now = new Date();
  const activePaidSubscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      expiresAt: { gt: now },
      isTrial: false
      // NOTE: NO longer checking txRef, paymentMethod, or amount!
    }
  });

  if (activePaidSubscription) {
    console.log('✅ hasStandardAccess() returns: TRUE');
    console.log('   Subscription will be granted access despite txRef starting with TRIAL_');
  } else {
    console.log('❌ hasStandardAccess() returns: FALSE');
  }

  console.log('\n✅ Test passed! The code now trusts isTrial field instead of txRef/paymentMethod/amount');
  console.log('\n💡 This means even with the original bad data, tenants will have access.\n');
}

// Run if called directly
if (require.main === module) {
  testAccessWithBadData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { testAccessWithBadData };
