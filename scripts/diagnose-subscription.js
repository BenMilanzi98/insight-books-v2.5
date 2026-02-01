// scripts/diagnose-subscription.js
// Usage: node scripts/diagnose-subscription.js [tenantId]

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function diagnoseSubscription(tenantId) {
  console.log('\n🔍 === SUBSCRIPTION DIAGNOSTIC ===\n');

  if (!tenantId) {
    console.log('❌ No tenant ID provided. Usage: node scripts/diagnose-subscription.js [tenantId]');
    return;
  }

  console.log(`📋 Checking subscription for tenant: ${tenantId}\n`);

  // 1. Check if tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      accountSubscriptions: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!tenant) {
    console.log('❌ Tenant not found!');
    return;
  }

  console.log(`✅ Tenant found: ${tenant.name}`);
  console.log(`   Status: ${tenant.status}`);
  console.log(`   Created: ${tenant.createdAt}\n`);

  // 2. Check all subscriptions for this tenant
  console.log('📊 All subscriptions for this tenant:');
  console.log('=' .repeat(80));

  if (tenant.accountSubscriptions.length === 0) {
    console.log('   No subscriptions found!\n');
  } else {
    tenant.accountSubscriptions.forEach((sub, index) => {
      const now = new Date();
      const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
      const trialEndDate = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
      
      const isActive = sub.isActive;
      const isTrial = sub.isTrial;
      const expiresInFuture = expiresAt ? expiresAt > now : false;
      const trialActive = trialEndDate ? trialEndDate > now : false;
      
      console.log(`\n   Subscription #${index + 1}:`);
      console.log(`   ├─ ID: ${sub.id}`);
      console.log(`   ├─ Plan: ${sub.plan}`);
      console.log(`   ├─ Status: ${sub.status}`);
      console.log(`   ├─ isActive: ${isActive}`);
      console.log(`   ├─ isTrial: ${isTrial}`);
      console.log(`   ├─ Amount: ${sub.amount}`);
      console.log(`   ├─ Payment Method: ${sub.paymentMethod}`);
      console.log(`   ├─ txRef: ${sub.txRef}`);
      console.log(`   ├─ expiresAt: ${expiresAt ? expiresAt.toISOString() : 'N/A'}`);
      console.log(`   ├─ expiresInFuture: ${expiresInFuture}`);
      console.log(`   ├─ trialEndDate: ${trialEndDate ? trialEndDate.toISOString() : 'N/A'}`);
      console.log(`   └─ trialActive: ${trialActive}`);
    });
  }

  console.log('\n' + '=' .repeat八十);

  // 3. Check for active PAID subscription (what hasStandardAccess looks for)
  console.log('\n🔍 Checking for ACTIVE PAID subscription...');
  
  const now = new Date();
  const activePaidSubscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      expiresAt: { gt: now },
      isTrial: false,
      NOT: [
        { plan: 'trial' },
        { paymentMethod: 'trial' },
        { txRef: { startsWith: 'TRIAL_' } }
      ],
      amount: { gt: 0 },
      status: { in: ['Completed', 'Active'] }
    }
  });

  if (activePaidSubscription) {
    console.log('✅ FOUND active paid subscription:');
    console.log(`   Plan: ${activePaidSubscription.plan}`);
    console.log(`   Expires: ${new Date(activePaidSubscription.expiresAt).toISOString()}`);
    console.log(`   Days remaining: ${Math.ceil((new Date(activePaidSubscription.expiresAt) - now) / (1000 * 60 * 60 * 24))}`);
  } else {
    console.log('❌ NO active paid subscription found');
    
    // Check why paid subscription might not be found
    console.log('\n📋 Checking potential issues:');
    
    const anyActive = await prisma.accountSubscription.findFirst({
      where: { tenantId, isActive: true }
    });
    console.log(`   Any active subscription: ${anyActive ? 'Yes' : 'No'}`);
    
    const expiredPaid = await prisma.accountSubscription.findFirst({
      where: {
        tenantId,
        isActive: true,
        isTrial: false,
        expiresAt: { lte: now }
      }
    });
    console.log(`   Active but expired paid subscription: ${expiredPaid ? 'Yes' : 'No'}`);
    
    const zeroAmount = await prisma.accountSubscription.findFirst({
      where: { tenantId, isActive: true, amount: 0 }
    });
    console.log(`   Active subscription with amount=0: ${zeroAmount ? 'Yes' : 'No'}`);
    
    const wrongStatus = await prisma.accountSubscription.findFirst({
      where: {
        tenantId,
        isActive: true,
        isTrial: false,
        status: { notIn: ['Completed', 'Active'] }
      }
    });
    console.log(`   Active paid with wrong status: ${wrongStatus ? 'Yes' : 'No'}`);
  }

  // 4. Check for active trial
  console.log('\n🔍 Checking for ACTIVE trial...');
  
  const activeTrial = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isTrial: true,
      isActive: true,
      trialEndDate: { gt: now }
    }
  });

  if (activeTrial) {
    console.log('✅ FOUND active trial:');
    console.log(`   Trial End: ${new Date(activeTrial.trialEndDate).toISOString()}`);
    console.log(`   Days remaining: ${Math.ceil((new Date(activeTrial.trialEndDate) - now) / (1000 * 60 * 60 * 24))}`);
  } else {
    console.log('❌ NO active trial found');
  }

  // 5. Summary
  console.log('\n' + '=' .repeat(80));
  console.log('📋 SUMMARY:');
  console.log(`   Tenant: ${tenant.name} (${tenantId})`);
  console.log(`   Has Active Paid Subscription: ${activePaidSubscription ? '✅ YES' : '❌ NO'}`);
  console.log(`   Has Active Trial: ${activeTrial ? '✅ YES' : '❌ NO'}`);
  
  const hasStandardAccess = !!(activePaidSubscription || activeTrial);
  console.log(`   ===> hasStandardAccess() will return: ${hasStandardAccess ? '✅ TRUE' : '❌ FALSE'}`);
  console.log('=' .repeat(80) + '\n');
}

// Run if called directly
if (require.main === module) {
  const tenantId = process.argv[2];
  diagnoseSubscription(tenantId)
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { diagnoseSubscription };
