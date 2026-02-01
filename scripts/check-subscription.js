/**
 * Debug script to check subscription status
 * Usage: node scripts/check-subscription.js <tenantId>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSubscription(tenantId) {
  try {
    console.log(`Checking subscription for tenant: ${tenantId}\n`);

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        accountSubscriptions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!tenant) {
      console.error('❌ Tenant not found!');
      return;
    }

    console.log('Tenant:', { id: tenant.id, name: tenant.name });
    console.log('\nSubscriptions:');
    
    tenant.accountSubscriptions.forEach((sub, index) => {
      console.log(`\n--- Subscription ${index + 1} ---`);
      console.log(JSON.stringify({
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        isActive: sub.isActive,
        isTrial: sub.isTrial,
        amount: sub.amount,
        currency: sub.currency,
        paymentMethod: sub.paymentMethod,
        txRef: sub.txRef,
        trialStartDate: sub.trialStartDate,
        trialEndDate: sub.trialEndDate,
        expiresAt: sub.expiresAt,
        startedAt: sub.startedAt,
        paymentDate: sub.paymentDate
      }, null, 2));
    });

    // Check what hasStandardAccess would return
    const now = new Date();
    console.log(`\n\nCurrent time: ${now.toISOString()}`);
    console.log('\nChecking access conditions:');

    // Check for active paid subscription
    const activePaid = tenant.accountSubscriptions.find(sub => 
      sub.isActive === true &&
      sub.isTrial === false &&
      sub.expiresAt &&
      new Date(sub.expiresAt) > now &&
      sub.amount > 0 &&
      (sub.status === 'Completed' || sub.status === 'Active') &&
      sub.plan !== 'trial' &&
      sub.paymentMethod !== 'trial' &&
      !sub.txRef?.startsWith('TRIAL_')
    );

    console.log('\n1. Active paid subscription:', activePaid ? '✅ YES' : '❌ NO');

    // Check for active trial
    const activeTrial = tenant.accountSubscriptions.find(sub =>
      sub.isTrial === true &&
      sub.isActive === true &&
      sub.trialEndDate &&
      new Date(sub.trialEndDate) > now
    );

    console.log('2. Active trial:', activeTrial ? '✅ YES' : '❌ NO');
    
    if (activeTrial) {
      console.log('   Trial ends at:', activeTrial.trialEndDate);
    }

    // Final result
    const hasAccess = !!activePaid || !!activeTrial;
    console.log(`\n🎯 Would return hasStandardAccess: ${hasAccess ? '✅ TRUE' : '❌ FALSE'}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const tenantId = process.argv[2];

if (!tenantId) {
  console.log('Usage: node scripts/check-subscription.js <tenantId>');
  console.log('\nTo find tenant ID:');
  console.log('  psql "$DATABASE_URL" -c "SELECT id, name FROM Tenant LIMIT 5;"');
  process.exit(1);
}

checkSubscription(tenantId);
