// scripts/check-all-subscriptions.js
// Check all subscriptions for data issues that could cause 403 errors

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAllSubscriptions() {
  console.log('\n🔍 === CHECKING ALL SUBSCRIPTIONS FOR ISSUES ===\n');

  // Get all subscriptions
  const subscriptions = await prisma.accountSubscription.findMany({
    orderBy: { createdAt: 'desc' }
  });

  console.log(`📊 Total subscriptions found: ${subscriptions.length}\n`);

  let problematicSubscriptions = [];

  subscriptions.forEach((sub) => {
    const issues = [];

    // Check if it's a paid subscription but has trial-like data
    if (!sub.isTrial) {
      if (sub.txRef && sub.txRef.startsWith('TRIAL_')) {
        issues.push('txRef starts with TRIAL_');
      }
      if (sub.amount === 0) {
        issues.push('amount is 0');
      }
      if (sub.paymentMethod === 'trial') {
        issues.push('paymentMethod is trial');
      }
    }

    if (issues.length > 0) {
      problematicSubscriptions.push({
        id: sub.id,
        tenantId: sub.tenantId,
        plan: sub.plan,
        isTrial: sub.isTrial,
        isActive: sub.isActive,
        status: sub.status,
        txRef: sub.txRef,
        amount: sub.amount,
        paymentMethod: sub.paymentMethod,
        expiresAt: sub.expiresAt,
        issues
      });
    }
  });

  if (problematicSubscriptions.length === 0) {
    console.log('✅ No problematic subscriptions found!');
    console.log('   All non-trial subscriptions have valid data.');
  } else {
    console.log(`⚠️  Found ${problematicSubscriptions.length} problematic subscriptions:\n`);
    
    problematicSubscriptions.forEach((sub, index) => {
      console.log(`Subscription #${index + 1}:`);
      console.log(`   ID: ${sub.id}`);
      console.log(`   Tenant ID: ${sub.tenantId}`);
      console.log(`   Plan: ${sub.plan}`);
      console.log(`   isTrial: ${sub.isTrial}`);
      console.log(`   isActive: ${sub.isActive}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   txRef: ${sub.txRef}`);
      console.log(`   Amount: ${sub.amount}`);
      console.log(`   Payment Method: ${sub.paymentMethod}`);
      console.log(`   Issues: ${sub.issues.join(', ')}`);
      console.log('');
    });
  }

  // Summary
  console.log('\n📋 SUMMARY:');
  const paidSubscriptions = subscriptions.filter(s => !s.isTrial && s.isActive);
  const activePaidWithIssues = paidSubscriptions.filter(s => 
    s.txRef?.startsWith('TRIAL_') || s.amount === 0 || s.paymentMethod === 'trial'
  );

  console.log(`   Total subscriptions: ${subscriptions.length}`);
  console.log(`   Active paid subscriptions: ${paidSubscriptions.length}`);
  console.log(`   Active paid with issues: ${activePaidWithIssues.length}`);

  if (activePaidWithIssues.length > 0) {
    console.log('\n⚠️  ACTION NEEDED: Fix the problematic subscriptions above');
  } else {
    console.log('\n✅ All active paid subscriptions are valid!');
  }

  console.log('\n');
}

// Run if called directly
if (require.main === module) {
  checkAllSubscriptions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { checkAllSubscriptions };
