/**
 * Script to activate a 5-day trial subscription for a BRANCH
 * Usage: node scripts/activate-branch-subscription.js <tenantId> <branchId>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function activateBranchTrial(tenantId, branchId) {
  try {
    console.log(`\n🔍 Activating 5-day trial for branch: ${branchId}`);
    console.log(`   Tenant ID: ${tenantId}`);
    
    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    
    if (!tenant) {
      console.error('❌ Tenant not found!');
      process.exit(1);
    }
    
    console.log(`✅ Tenant found: ${tenant.name}`);
    
    // Check if branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId }
    });
    
    if (!branch) {
      console.error('❌ Branch not found!');
      process.exit(1);
    }
    
    console.log(`✅ Branch found: ${branch.name}`);
    
    // Deactivate any existing branch subscriptions
    const existingSubs = await prisma.branchSubscription.findMany({
      where: { branchId }
    });
    
    if (existingSubs.length > 0) {
      console.log(`📋 Found ${existingSubs.length} existing branch subscriptions - deactivating...`);
      await prisma.branchSubscription.updateMany({
        where: { branchId },
        data: { isActive: false, status: 'Replaced' }
      });
    }
    
    // Create new 5-day trial for branch
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5); // 5-day trial
    
    const branchSubscription = await prisma.branchSubscription.create({
      data: {
        tenantId,
        branchId,
        plan: 'trial', // Must be 'trial' for trial subscriptions
        txRef: `BRANCH_TRIAL_${branchId}_${Date.now()}`,
        amount: 0,
        currency: 'MWK',
        status: 'Active', // Must be 'Active' for active subscriptions
        paymentMethod: 'trial',
        isActive: true,
        startedAt: startDate,
        expiresAt: endDate,
        paymentDate: startDate,
        notes: '5-day free trial (test 2)'
      }
    });
    
    console.log(`\n✅ 5-Day Branch Trial activated successfully!`);
    console.log(`\n📋 Trial Details:`);
    console.log(`   - Branch: ${branch.name}`);
    console.log(`   - Plan: ${branchSubscription.plan}`);
    console.log(`   - Start: ${branchSubscription.startedAt}`);
    console.log(`   - Expires: ${branchSubscription.expiresAt}`);
    console.log(`   - Status: ${branchSubscription.status}`);
    console.log(`   - Active: ${branchSubscription.isActive}`);
    console.log(`   - Amount: ${branchSubscription.amount}`);
    console.log(`   - Reference: ${branchSubscription.txRef}`);
    
    // Calculate days remaining
    const now = new Date();
    const expires = new Date(branchSubscription.expiresAt);
    const daysRemaining = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
    console.log(`   - Days Remaining: ${daysRemaining}`);
    
    // Verify the subscription is active
    console.log(`\n🔍 Verifying subscription...`);
    const verifySub = await prisma.branchSubscription.findFirst({
      where: {
        branchId,
        isActive: true,
        expiresAt: { gt: now },
        plan: 'trial',
        status: 'Active'
      }
    });
    
    if (verifySub) {
      console.log(`✅ Subscription verified - branch can now be activated!`);
    } else {
      console.log(`⚠️  Warning: Subscription verification failed`);
    }
    
    return branchSubscription;
  } catch (error) {
    console.error('❌ Error activating branch trial:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get tenantId and branchId from command line
const tenantId = process.argv[2];
const branchId = process.argv[3];

if (!tenantId || !branchId) {
  console.log('\n📝 Usage: node scripts/activate-branch-subscription.js <tenantId> <branchId>');
  console.log('\nExample:');
  console.log('   node scripts/activate-branch-subscription.js cmfckh1vi00z7jq2g66ixw3rd cml9dnr090007cp5vo2oks5kj');
  console.log('\nTo find branch IDs, run:');
  console.log('   npx prisma studio');
  process.exit(1);
}

activateBranchTrial(tenantId, branchId);
