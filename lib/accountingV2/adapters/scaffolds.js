/**
 * Phase 9 — remaining scaffolds.
 *
 * Stages 1–6 live adapters are in this folder / remainingAdapters.js.
 * Only events with no operational entry point yet stay here as ready hooks.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { AccountingConfigurationError } from '../domain/errors.js';

function notReady(moduleKey, eventType) {
  return async () => {
    throw new AccountingConfigurationError(
      `Phase 9 adapter for ${moduleKey}/${eventType} is scaffolded but not yet ACTIVE. ` +
        'Keep posting mode LEGACY/SHADOW until an operational entry point calls the real adapter.',
      { diagnostic: { moduleKey, eventType } }
    );
  };
}

/** Ready helpers exist in remainingAdapters — these keys document missing UI/API only. */
export const SCAFFOLDED_ADAPTERS = Object.freeze({
  DIVIDEND_DECLARED: {
    moduleKey: AccountingSourceModule.EQUITY,
    eventType: AccountingEventType.DIVIDEND_DECLARED,
    submit: notReady(AccountingSourceModule.EQUITY, AccountingEventType.DIVIDEND_DECLARED),
    note: 'Template ACTIVE; wire when dividend declaration UI exists',
  },
  DIVIDEND_PAID: {
    moduleKey: AccountingSourceModule.EQUITY,
    eventType: AccountingEventType.DIVIDEND_PAID,
    submit: notReady(AccountingSourceModule.EQUITY, AccountingEventType.DIVIDEND_PAID),
    note: 'Template ACTIVE; wire when dividend payment UI exists',
  },
  ASSET_DISPOSED: {
    moduleKey: AccountingSourceModule.FIXED_ASSETS,
    eventType: AccountingEventType.ASSET_DISPOSED,
    submit: notReady(AccountingSourceModule.FIXED_ASSETS, AccountingEventType.ASSET_DISPOSED),
    note: 'Template ACTIVE; wire when disposal API posts GL',
  },
  OWNER_DRAWING: {
    moduleKey: AccountingSourceModule.EQUITY,
    eventType: AccountingEventType.OWNER_DRAWING_POSTED,
    submit: notReady(AccountingSourceModule.EQUITY, AccountingEventType.OWNER_DRAWING_POSTED),
    note: 'postOwnerDrawingAccounting ready in remainingAdapters.js',
  },
});
