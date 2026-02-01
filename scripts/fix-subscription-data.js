// scripts/fix-subscription-data.js
// Fixes subscription data issues that cause hasStandardAccess() to return false

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixSubscriptionData() {
  console.log('\n🔧 === FIXING SUBSCRIPTION DATA ===\n');

  const tenantId = 'cmgunbqaf04tbjq5h7zj02cn5';
  const subscriptionId = 'cmgunbqb704tljq5hxgzzlf5u';

  // Get the current subscription
  const subscription = await prisma.accountSubscription.findUnique({
    where: { id: subscriptionId }
  });

  if (!subscription) {
    console.log('❌ Subscription not found!');
    return;
  }

  console.log('📋 Current subscription:');
  console.log(`   ID: ${subscription.id}`);
  console.log(`   Plan: ${subscription.plan}`);
  console.log(`   txRef: ${subscription.txRef}`);
  console.log(`   Amount: ${subscription.amount}`);
  console.log(`   Payment Method: ${subscription.paymentMethod}`);
  console.log(`   isTrial: ${subscription.isTrial}`);
  console.log(`   isActive: ${subscription.isActive}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Expires: ${subscription.expiresAt}`);

  console.log('\n⚠️  Issues detected:');
  if (subscription.txRef.startsWith('TRIAL_')) {
    console.log('   ❌ txRef starts with TRIAL_ (should be PAID_)');
  }
  if (subscription.amount === 0) {
    console.log('   ❌ amount is 0 (should be > 0 for paid subscription)');
  }
  if (subscription.paymentMethod === 'trial') {
    console.log('   ❌ paymentMethod is "trial" (should be a valid payment method)');
  }

  // Fix the subscription
  console.log('\n🔄 Fixing subscription...');
  
  const updatedSubscription = await prisma.accountSubscription.update({
    where: { id: subscriptionId },
    data: {
      txRef: `PAID_${tenantId}_${Date.now()}`,
      amount: 100.00, // Set a reasonable amount for the plan
      paymentMethod: 'bank',
      isTrial: false,
      updatedAt: new Date()
    }
  });

  console.log('✅ Subscription fixed!');
  console.log('\n📋 Updated subscription:');
  console.log(`   ID: ${updatedSubscription.id}`);
  console.log(`   Plan: ${updatedSubscription.plan}`);
  console.log(`   txRef: ${updatedSubscription.txRef}`);
  console.log(`   Amount: ${updatedSubscription.amount}`);
  console.log(`   Payment Method: ${updatedSubscription.paymentMethod}`);
  console.log(`   isTrial: ${updatedSubscription.isTrial}`);
  console.log(`   isActive: ${updatedSubscription.isActive}`);
  console.log(`   Status: ${updatedSubscription.status}`);
  console.log(`   Expires: ${updatedSubscription.expiresAt}`);

  // Verify with hasStandardAccess
  console.log('\n🔍 Verifying hasStandardAccess()...');
  const { hasStandardAccess } = await import('../lib/subscriptionService.js');
  const hasAccess = await hasStandardAccess(tenantId);
  console.log(`   ===> hasStandardAccess('${tenantId}') = ${hasAccess ? '✅ TRUE' : '❌ FALSE'}`);

  console.log('\n✅ Subscription data fixed successfully!\n');
}

// Run if called directly
if (require.main === module) {
  fixSubscriptionData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { fixSubscriptionData };
