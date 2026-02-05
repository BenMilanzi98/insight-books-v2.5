/**
 * Script to activate a 5-day trial subscription for a tenant
 * Usage: node scripts/activate-5day-trial.js <tenantId>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function activate5DayTrial(tenantId) {
  try {
    console.log(`Activating 5-day trial for tenant: ${tenantId}`);
    
    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    
    if (!tenant) {
      console.error('Tenant not found!');
      process.exit(1);
    }
    
    console.log(`Tenant found: ${tenant.name}`);
    
    // Check for existing subscription
    const existingSubscription = await prisma.accountSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Deactivate any existing subscriptions
    if (existingSubscription) {
      console.log('Deactivating existing subscription...');
      await prisma.accountSubscription.updateMany({
        where: { tenantId },
        data: { isActive: false, status: 'Replaced' }
      });
    }
    
    // Create new 5-day trial subscription
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate);
    trialEndDate.setDate(trialEndDate.getDate() + 5); // 5-day trial
    
    const trialSubscription = await prisma.accountSubscription.create({
      data: {
        tenantId,
        plan: 'trial',
        txRef: `TRIAL_5DAY_${tenantId}_${Date.now()}`,
        amount: 0,
        currency: 'MWK',
        status: 'Active',
        paymentMethod: 'trial',
        isActive: true,
        isTrial: true,
        trialStartDate,
        trialEndDate,
        startedAt: trialStartDate,
        paymentDate: trialStartDate,
        notes: '5-day free trial (test 2)'
      }
    });
    
    console.log('\n✅ 5-Day Trial activated successfully!');
    console.log(`\nTrial Details:`);
    console.log(`  - Plan: ${trialSubscription.plan}`);
    console.log(`  - Start Date: ${trialSubscription.trialStartDate}`);
    console.log(`  - End Date: ${trialSubscription.trialEndDate}`);
    console.log(`  - Status: ${trialSubscription.status}`);
    console.log(`  - Active: ${trialSubscription.isActive}`);
    console.log(`  - Reference: ${trialSubscription.txRef}`);
    
    // Calculate remaining days
    const now = new Date();
    const endDate = new Date(trialSubscription.trialEndDate);
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    console.log(`  - Days Remaining: ${daysRemaining}`);
    
    return trialSubscription;
  } catch (error) {
    console.error('Error activating trial:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get tenantId from command line
const tenantId = process.argv[2];

if (!tenantId) {
  console.log('Usage: node scripts/activate-5day-trial.js <tenantId>');
  console.log('\nExample:');
  console.log('  node scripts/activate-5day-trial.js cmfckh1vi00z7jq2g66ixw3rd');
  process.exit(1);
}

activate5DayTrial(tenantId);
