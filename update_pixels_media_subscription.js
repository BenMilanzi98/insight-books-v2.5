const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updatePixelsMediaSubscription() {
  try {
    // Find the tenant "Pixels Media"
    const tenant = await prisma.tenant.findFirst({
      where: {
        name: 'Pixels Media'
      }
    });

    if (!tenant) {
      console.log('Tenant "Pixels Media" not found');
      return;
    }

    console.log('Found tenant:', tenant);

    // Find the subscription for this tenant
    const subscription = await prisma.accountSubscription.findFirst({
      where: {
        tenantId: tenant.id
      }
    });

    if (!subscription) {
      console.log('No subscription found for tenant "Pixels Media"');
      return;
    }

    console.log('Current subscription expiresAt:', subscription.expiresAt);

    // Calculate new expiry date: current time + 8 days
    const newExpiryDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

    console.log('New expiry date:', newExpiryDate);

    // Update the subscription
    const updatedSubscription = await prisma.accountSubscription.update({
      where: {
        id: subscription.id
      },
      data: {
        expiresAt: newExpiryDate
      }
    });

    console.log('Subscription updated successfully. New expiresAt:', updatedSubscription.expiresAt);

  } catch (error) {
    console.error('Error updating subscription:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePixelsMediaSubscription();