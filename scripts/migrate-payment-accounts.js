/**
 * Migration script to initialize default Payment Accounts for all tenants
 * 
 * This script:
 * - Creates default payment accounts (Cash, Bank Transfer, Airtel Money, Mpamba, PayChangu) for all existing tenants
 * - Only creates accounts that don't already exist (idempotent)
 * - Can be run multiple times safely
 * 
 * Usage:
 *   node scripts/migrate-payment-accounts.js
 * 
 * Or with Node.js from project root:
 *   node --loader ts-node/esm scripts/migrate-payment-accounts.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Default payment accounts to create for all tenants
const DEFAULT_PAYMENT_ACCOUNTS = [
  {
    name: 'Cash',
    accountType: 'Cash',
    isSystem: true,  // System account - cannot be deleted
    isActive: true,
    description: 'Default cash payment account'
  },
  {
    name: 'Bank Transfer',
    accountType: 'Bank',
    isSystem: false,  // User can delete/modify
    isActive: true,
    description: 'Bank transfer payment account'
  },
  {
    name: 'Airtel Money',
    accountType: 'Mobile Money',
    isSystem: false,
    isActive: true,
    description: 'Airtel Money mobile payment account'
  },
  {
    name: 'Mpamba',
    accountType: 'Mobile Money',
    isSystem: false,
    isActive: true,
    description: 'Mpamba mobile payment account'
  },
  {
    name: 'PayChangu',
    accountType: 'Wallet',
    isSystem: false,
    isActive: true,
    description: 'PayChangu wallet payment account'
  }
];

/**
 * Initialize default payment accounts for a single tenant
 */
async function initializeTenantPaymentAccounts(tenantId, tenantName) {
  const results = {
    tenantId,
    tenantName,
    created: [],
    skipped: [],
    errors: []
  };

  for (const account of DEFAULT_PAYMENT_ACCOUNTS) {
    try {
      // Check if account already exists
      const existing = await prisma.paymentAccount.findFirst({
        where: {
          tenantId: tenantId,
          name: account.name,
        }
      });

      if (existing) {
        results.skipped.push({
          name: account.name,
          reason: 'Already exists'
        });
        continue;
      }

      // Create the account
      await prisma.paymentAccount.create({
        data: {
          tenantId: tenantId,
          name: account.name,
          accountType: account.accountType,
          isSystem: account.isSystem,
          isActive: account.isActive,
          reference: account.reference || null
        }
      });

      results.created.push({
        name: account.name,
        accountType: account.accountType,
        isSystem: account.isSystem
      });
    } catch (error) {
      results.errors.push({
        name: account.name,
        error: error.message
      });
      console.error(`  ❌ Error creating ${account.name}:`, error.message);
    }
  }

  return results;
}

/**
 * Main migration function
 */
async function migratePaymentAccounts() {
  try {
    console.log('🚀 Starting Payment Accounts Migration...\n');

    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: { 
        id: true, 
        name: true,
        subdomain: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (tenants.length === 0) {
      console.log('⚠️  No tenants found. Nothing to migrate.');
      return;
    }

    console.log(`📊 Found ${tenants.length} tenant(s) to process\n`);

    const summary = {
      totalTenants: tenants.length,
      totalCreated: 0,
      totalSkipped: 0,
      totalErrors: 0,
      tenantResults: []
    };

    // Process each tenant
    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      console.log(`[${i + 1}/${tenants.length}] Processing tenant: ${tenant.name} (${tenant.subdomain || 'N/A'})`);

      const result = await initializeTenantPaymentAccounts(tenant.id, tenant.name);
      summary.tenantResults.push(result);

      // Update summary counts
      summary.totalCreated += result.created.length;
      summary.totalSkipped += result.skipped.length;
      summary.totalErrors += result.errors.length;

      // Print results for this tenant
      if (result.created.length > 0) {
        console.log(`  ✅ Created ${result.created.length} account(s):`);
        result.created.forEach(acc => {
          console.log(`     - ${acc.name} (${acc.accountType})${acc.isSystem ? ' [System]' : ''}`);
        });
      }

      if (result.skipped.length > 0) {
        console.log(`  ⏭️  Skipped ${result.skipped.length} account(s) (already exist)`);
      }

      if (result.errors.length > 0) {
        console.log(`  ❌ Errors: ${result.errors.length}`);
      }

      console.log(''); // Empty line for readability
    }

    // Print final summary
    console.log('═'.repeat(60));
    console.log('📈 Migration Summary');
    console.log('═'.repeat(60));
    console.log(`Total Tenants Processed: ${summary.totalTenants}`);
    console.log(`Total Accounts Created: ${summary.totalCreated}`);
    console.log(`Total Accounts Skipped: ${summary.totalSkipped}`);
    console.log(`Total Errors: ${summary.totalErrors}`);
    console.log('═'.repeat(60));

    if (summary.totalErrors > 0) {
      console.log('\n⚠️  Some errors occurred during migration. Please review the output above.');
    } else {
      console.log('\n✨ Migration completed successfully!');
    }

    // Print detailed results for tenants with errors
    const tenantsWithErrors = summary.tenantResults.filter(r => r.errors.length > 0);
    if (tenantsWithErrors.length > 0) {
      console.log('\n⚠️  Tenants with errors:');
      tenantsWithErrors.forEach(result => {
        console.log(`\n  ${result.tenantName} (${result.tenantId}):`);
        result.errors.forEach(err => {
          console.log(`    - ${err.name}: ${err.error}`);
        });
      });
    }

  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migratePaymentAccounts()
    .then(() => {
      console.log('\n✅ Script execution completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script execution failed:', error);
      process.exit(1);
    });
}

// Export for use in other scripts
module.exports = { migratePaymentAccounts, initializeTenantPaymentAccounts };

