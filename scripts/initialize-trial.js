/**
 * Script to initialize trial for a tenant
 * Usage: node scripts/initialize-trial.js <tenantId>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initializeTrial(tenantId) {
  try {
    console.log(`Initializing trial for tenant: ${tenantId}`);
    
    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    
    if (!tenant) {
      console.error('Tenant not found!');
      process.exit(1);
    }
    
    // Check if tenant already has a subscription
    const existingSubscription = await prisma.accountSubscription.findFirst({
      where: { tenantId }
    });
    
    if (existingSubscription) {
      console.log('Tenant already has a subscription:');
      console.log(JSON.stringify(existingSubscription, null, 2));
      return existingSubscription;
    }
    
    // Create new trial subscription
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate);
    trialEndDate.setDate(trialEndDate.getDate() + 3); // 3-day trial
    
    const trialSubscription = await prisma.accountSubscription.create({
      data: {
        tenantId,
        plan: 'trial',
        txRef: `TRIAL_${tenantId}_${Date.now()}`,
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
        notes: '3-day free trial'
      }
    });
    
    console.log('Trial initialized successfully:');
    console.log(JSON.stringify(trialSubscription, null, 2));
    return trialSubscription;
  } catch (error) {
    console.error('Error initializing trial:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get tenantId from command line
const tenantId = process.argv[2];

if (!tenantId) {
  console.log('Usage: node scripts/initialize-trial.js <tenantId>');
  console.log('\nTo find tenant ID, run:');
  console.log('  npx prisma studio');
  console.log('  OR');
  console.log('  psql "$DATABASE_URL" -c "SELECT id, name FROM Tenant;"');
  process.exit(1);
}

initializeTrial(tenantId);
