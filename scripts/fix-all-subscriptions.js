// scripts/fix-all-subscriptions.js
// Fix all problematic subscriptions that have txRef starting with TRIAL_ but isTrial=false

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixAllProblematicSubscriptions() {
  console.log('\n🔧 === FIXING ALL PROBLEMATIC SUBSCRIPTIONS ===\n');

  // Find all subscriptions that are non-trial but have trial-like txRef or paymentMethod
  const problematicSubscriptions = await prisma.accountSubscription.findMany({
    where: {
      isTrial: false,
      isActive: true,
      OR: [
        { txRef: { startsWith: 'TRIAL_' } },
        { paymentMethod: 'trial' }
      ]
    }
  });

  console.log(`Found ${problematicSubscriptions.length} problematic subscriptions to fix\n`);

  if (problematicSubscriptions.length === 0) {
    console.log('✅ No subscriptions to fix!');
    return;
  }

  let fixedCount = 0;
  let errors = [];

  for (const sub of problematicSubscriptions) {
    try {
      console.log(`Fixing subscription: ${sub.id}`);
      console.log(`   Tenant: ${sub.tenantId}`);
      console.log(`   Plan: ${sub.plan}`);
      console.log(`   Old txRef: ${sub.txRef}`);
      console.log(`   Old amount: ${sub.amount}`);
      console.log(`   Old paymentMethod: ${sub.paymentMethod}`);

      // Update the subscription
      await prisma.accountSubscription.update({
        where: { id: sub.id },
        data: {
          txRef: `PAID_${sub.tenantId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          amount: sub.plan === 'trial' ? 0 : (sub.amount || 100), // Keep 0 for trial plans
          paymentMethod: sub.plan === 'trial' ? 'trial' : 'bank', // Keep trial for trial plans
          isTrial: sub.plan === 'trial',
          updatedAt: new Date()
        }
      });

      console.log(`   ✅ Fixed!\n`);
      fixedCount++;
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
      errors.push({ id: sub.id, error: error.message });
    }
  }

  // Summary
  console.log('=' .repeat(60));
  console.log('📋 SUMMARY:');
  console.log(`   Total fixed: ${fixedCount}`);
  console.log(`   Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\nFailed subscriptions:');
    errors.forEach(e => console.log(`   - ${e.id}: ${e.error}`));
  }
  
  console.log('=' .repeat(60));
  console.log('\n✅ All problematic subscriptions have been fixed!\n');
}

// Run if called directly
if (require.main === module) {
  fixAllProblematicSubscriptions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { fixAllProblematicSubscriptions };
