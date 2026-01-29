/**
 * Migration script to initialize Payment Accounts
 * - Creates Cash account for all tenants (system account)
 * - Optionally creates other default accounts based on existing payment methods
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_ACCOUNTS = [
  {
    name: 'Cash',
    accountType: 'Cash',
    isSystem: true,
    isActive: true
  },
  {
    name: 'Bank Transfer',
    accountType: 'Bank',
    isSystem: false,
    isActive: true
  },
  {
    name: 'Airtel Money',
    accountType: 'Mobile Money',
    isSystem: false,
    isActive: true
  },
  {
    name: 'Mpamba',
    accountType: 'Mobile Money',
    isSystem: false,
    isActive: true
  },
  {
    name: 'PayChangu',
    accountType: 'Wallet',
    isSystem: false,
    isActive: true
  }
];

async function initializePaymentAccounts() {
  try {
    console.log('🚀 Starting Payment Accounts initialization...');

    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true }
    });

    console.log(`Found ${tenants.length} tenants`);

    for (const tenant of tenants) {
      console.log(`\n📋 Processing tenant: ${tenant.name} (${tenant.id})`);

      for (const account of DEFAULT_ACCOUNTS) {
        // Check if account already exists
        const existing = await prisma.paymentAccount.findUnique({
          where: {
            tenantId_name: {
              tenantId: tenant.id,
              name: account.name
            }
          }
        });

        if (existing) {
          console.log(`  ✓ ${account.name} already exists`);
          continue;
        }

        // Create the account
        await prisma.paymentAccount.create({
          data: {
            tenantId: tenant.id,
            name: account.name,
            accountType: account.accountType,
            isSystem: account.isSystem,
            isActive: account.isActive
          }
        });

        console.log(`  ✅ Created ${account.name} (${account.accountType})`);
      }
    }

    console.log('\n✨ Payment Accounts initialization completed!');
  } catch (error) {
    console.error('❌ Error initializing payment accounts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
initializePaymentAccounts()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

