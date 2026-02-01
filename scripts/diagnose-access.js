/**
 * Quick diagnostic - check user session and subscription
 * Run this on your production server to diagnose 403 errors
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseAccess() {
  try {
    // Get all users with their tenant info
    console.log('=== User-Tenant-Subscription Analysis ===\n');
    
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        status: true
      },
      take: 10
    });

    for (const user of users) {
      console.log(`User: ${user.email} (${user.name})`);
      console.log(`  tenantId: ${user.tenantId}`);
      console.log(`  status: ${user.status}`);

      if (user.tenantId) {
        const subscription = await prisma.accountSubscription.findFirst({
          where: {
            tenantId: user.tenantId,
            isActive: true
          },
          orderBy: { createdAt: 'desc' }
        });

        if (subscription) {
          const now = new Date();
          const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
          const trialEnd = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
          
          console.log(`  Subscription:`);
          console.log(`    plan: ${subscription.plan}`);
          console.log(`    isTrial: ${subscription.isTrial}`);
          console.log(`    status: ${subscription.status}`);
          console.log(`    expiresAt: ${expiresAt ? expiresAt.toISOString() : 'N/A'}`);
          console.log(`    trialEndDate: ${trialEnd ? trialEnd.toISOString() : 'N/A'}`);
          console.log(`    isActive: ${subscription.isActive}`);
          
          // Check if expired
          if (subscription.isTrial && trialEnd && trialEnd < now) {
            console.log(`    ⚠️  TRIAL EXPIRED!`);
          } else if (!subscription.isTrial && expiresAt && expiresAt < now) {
            console.log(`    ⚠️  SUBSCRIPTION EXPIRED!`);
          } else {
            console.log(`    ✅ Active`);
          }
        } else {
          console.log(`  ⚠️  NO SUBSCRIPTION FOUND!`);
        }
      }
      console.log('');
    }

    console.log('=== Quick Fix Commands ===');
    console.log('If you see "NO SUBSCRIPTION FOUND" or "EXPIRED", run:');
    console.log('  node scripts/initialize-trial.js <tenantId>');
    console.log('');
    console.log('To extend an expired subscription:');
    console.log('  psql "$DATABASE_URL" -c "UPDATE \\"AccountSubscription\" SET \\"trialEndDate\\" = now() + interval \\'7 days\\', status = \\'Active\\', \\"isActive\\" = true WHERE \\"tenantId\\" = \\'your-tenant-id\\';"');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseAccess();
