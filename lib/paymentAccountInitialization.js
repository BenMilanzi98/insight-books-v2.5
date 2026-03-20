/**
 * Initialize default payment accounts for a tenant
 * This should be called whenever a new tenant is created
 */

import prisma from './prisma';

// Only create Cash as a system account - all other accounts should be created dynamically by users
const DEFAULT_PAYMENT_ACCOUNTS = [
  {
    name: 'Cash',
    accountType: 'Cash',
    isSystem: true,
    isActive: true
  }
];

/**
 * Initialize default payment accounts for a tenant
 * @param {string} tenantId - The tenant ID
 * @param {Object} tx - Optional Prisma transaction client
 * @returns {Promise<void>}
 */
export async function initializeDefaultPaymentAccounts(tenantId, tx = prisma) {
  try {
    for (const account of DEFAULT_PAYMENT_ACCOUNTS) {
      // Check if account already exists
      const existing = await tx.paymentAccount.findUnique({
        where: {
          tenantId_name: {
            tenantId: tenantId,
            name: account.name
          }
        }
      });

      if (existing) {
        // If an older DB/tenant has Cash marked inactive, ensure it's active again.
        if (existing.isActive === false && existing.isSystem === true) {
          await tx.paymentAccount.update({
            where: { id: existing.id },
            data: { isActive: true }
          });
        }
        continue; // Skip if already exists (after possible re-activation)
      }

      // Create the account
      await tx.paymentAccount.create({
        data: {
          tenantId: tenantId,
          name: account.name,
          accountType: account.accountType,
          isSystem: account.isSystem,
          isActive: account.isActive
        }
      });
    }
  } catch (error) {
    console.error('Error initializing default payment accounts:', error);
    // Don't throw - allow tenant creation to continue even if payment accounts fail
    // They can be created manually later
  }
}

