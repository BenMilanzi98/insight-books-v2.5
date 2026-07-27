/**
 * Phase 19 — Migration hook isolation.
 * Migration writes must not trigger Sale finalization, accounting, Inventory,
 * MRA transmission, offline upload, or receipt generation.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { MigrationErrors } from './migrationErrors.js';

const migrationContext = new AsyncLocalStorage();

export const FORBIDDEN_HOOKS = Object.freeze([
  'SALE_FINALIZATION',
  'INVOICE_ISSUANCE',
  'ACCOUNTING_POSTING',
  'INVENTORY_POSTING',
  'FISCAL_NUMBER_ALLOCATION',
  'MRA_TRANSMISSION',
  'OFFLINE_UPLOAD',
  'RECEIPT_GENERATION',
  'CUSTOMER_EMAIL',
  'EXTERNAL_WEBHOOK',
  'PAYMENT_PROCESSING',
]);

export function runInMigrationContext(fn, meta = {}) {
  return migrationContext.run(
    {
      migration: true,
      forbidHooks: true,
      forbidOutboxTransmission: true,
      forbidJournal: true,
      forbidStockMovement: true,
      ...meta,
    },
    fn
  );
}

export function isMigrationContext() {
  return Boolean(migrationContext.getStore()?.migration);
}

export function assertHookAllowed(hookName) {
  const store = migrationContext.getStore();
  if (store?.forbidHooks && FORBIDDEN_HOOKS.includes(hookName)) {
    throw MigrationErrors.hookIsolation({
      message: `Hook ${hookName} is forbidden inside migration context.`,
    });
  }
}

export function assertNoJournalFromMigration() {
  if (isMigrationContext()) {
    throw MigrationErrors.hookIsolation({ message: 'Migration must not create Journals.' });
  }
}

export function assertNoStockMovementFromMigration() {
  if (isMigrationContext()) {
    throw MigrationErrors.hookIsolation({ message: 'Migration must not create Stock Movements.' });
  }
}

export function assertNoTransmissionFromMigration() {
  if (isMigrationContext()) {
    throw MigrationErrors.historicalTransmissionBlocked();
  }
}
