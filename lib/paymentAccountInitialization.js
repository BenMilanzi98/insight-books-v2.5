/**
 * Initialize default payment accounts for a tenant
 * This should be called whenever a new tenant is created
 */

import prisma from './prisma';
import { ensurePaymentAccountCoaLink } from './paymentAccountCoaLink';

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
/**
 * Ensures the default Cash payment account stays enabled (e.g. after manual toggles or legacy data).
 */
export async function ensureCashPaymentAccountEnabled(tenantId, tx = prisma) {
  try {
    await tx.paymentAccount.updateMany({
      where: {
        tenantId,
        name: 'Cash',
        accountType: 'Cash',
      },
      data: { isActive: true },
    });
  } catch (e) {
    console.warn('ensureCashPaymentAccountEnabled:', e?.message || e);
  }
}

export async function initializeDefaultPaymentAccounts(tenantId, tx = prisma) {
  try {
    for (const account of DEFAULT_PAYMENT_ACCOUNTS) {
      // Check if account already exists
      const existing = await tx.paymentAccount.findFirst({
        where: {
          tenantId,
          name: account.name,
          isSystem: account.isSystem === true ? true : undefined,
        },
      });

      if (existing) {
        // If an older DB/tenant has Cash marked inactive, ensure it's active again.
        if (existing.isActive === false && existing.isSystem === true) {
          await tx.paymentAccount.update({
            where: { id: existing.id },
            data: { isActive: true }
          });
        }
        await ensurePaymentAccountCoaLink(tenantId, existing, tx);
        continue; // Skip if already exists (after possible re-activation)
      }

      // Create the account
      const created = await tx.paymentAccount.create({
        data: {
          tenantId: tenantId,
          name: account.name,
          accountType: account.accountType,
          isSystem: account.isSystem,
          isActive: account.isActive
        }
      });
      await ensurePaymentAccountCoaLink(tenantId, created, tx);
    }
    await ensureCashPaymentAccountEnabled(tenantId, tx);
  } catch (error) {
    console.error('Error initializing default payment accounts:', error);
    // Don't throw - allow tenant creation to continue even if payment accounts fail
    // They can be created manually later
  }
}

