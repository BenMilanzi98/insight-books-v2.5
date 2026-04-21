/**
 * Optional setup wizard: persisted state on TenantSettings.setupWizardState,
 * and derived completion checks aligned with real data (CoA, payments, tax, AR/AP ops).
 */

import { resolvePrimaryCapitalAccount } from '@/lib/resolveCapitalAccount';
import { SETUP_WIZARD_STEP_DEFS } from '@/lib/setupWizardStepsMeta';

export { SETUP_WIZARD_STEP_DEFS };

/** @typedef {'complete' | 'skipped' | 'pending'} SetupStepUiStatus */

const STEP_IDS = new Set(SETUP_WIZARD_STEP_DEFS.map((s) => s.id));

/**
 * @param {unknown} raw
 * @returns {{ completed: Record<string, string>, skipped: Record<string, string> }}
 */
export function parseSetupWizardState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { completed: {}, skipped: {} };
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  const completed =
    o.completed && typeof o.completed === 'object' && !Array.isArray(o.completed)
      ? /** @type {Record<string, string>} */ (o.completed)
      : {};
  const skipped =
    o.skipped && typeof o.skipped === 'object' && !Array.isArray(o.skipped)
      ? /** @type {Record<string, string>} */ (o.skipped)
      : {};
  return { completed, skipped };
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
export async function deriveSetupWizardFacts(db, tenantId) {
  const primaryCapital = await resolvePrimaryCapitalAccount(tenantId, db);

  const [
    openingCount,
    paymentOkCount,
    taxSettings,
    clientCount,
    supplierCount,
    equityLinkedCount,
    transferCount,
  ] = await Promise.all([
    db.transaction.count({
      where: { tenantId, entryType: 'Opening', status: 'posted' },
    }),
    db.paymentAccount.count({
      where: { tenantId, isActive: true, coaAccountId: { not: null } },
    }),
    db.tenantSettings.findUnique({
      where: { tenantId },
      select: { taxInflowAccountId: true, taxOutflowAccountId: true },
    }),
    db.client.count({ where: { tenantId } }),
    db.supplier.count({ where: { tenantId } }),
    db.equityAccount.count({
      where: { tenantId, isActive: true, coaAccountId: { not: null } },
    }),
    primaryCapital?.id
      ? db.payment.count({
          where: {
            tenantId,
            type: 'transfer',
            OR: [{ sourceAccount: primaryCapital.id }, { destinationAccount: primaryCapital.id }],
          },
        })
      : Promise.resolve(0),
  ]);

  const taxOk =
    !!(taxSettings?.taxInflowAccountId && taxSettings?.taxOutflowAccountId);

  return {
    hasOpeningPosted: openingCount > 0,
    hasActivePaymentAccountWithCoa: paymentOkCount > 0,
    taxAccountsConfigured: taxOk,
    hasClients: clientCount > 0,
    hasSuppliers: supplierCount > 0,
    hasCapitalTransfers: transferCount > 0,
    hasPrimaryCapitalCoa: !!primaryCapital?.id,
    hasEquityLinked: equityLinkedCount > 0,
  };
}

/**
 * @param {string} stepId
 * @param {Awaited<ReturnType<typeof deriveSetupWizardFacts>>} facts
 */
function derivedStepComplete(stepId, facts) {
  switch (stepId) {
    case 'openingBalances':
      return facts.hasOpeningPosted;
    case 'fiscalYear':
      // Fiscal month alone is not "activity"; wizard marks done after save on /setup.
      return false;
    case 'paymentAccounts':
      return facts.hasActivePaymentAccountWithCoa;
    case 'capital':
      return facts.hasPrimaryCapitalCoa || facts.hasEquityLinked;
    case 'transfers':
      return facts.hasCapitalTransfers;
    case 'taxAccounts':
      return facts.taxAccountsConfigured;
    case 'clients':
      return facts.hasClients;
    case 'suppliers':
      return facts.hasSuppliers;
    default:
      return false;
  }
}

/**
 * @param {string} stepId
 * @param {{ completed: Record<string, string>, skipped: Record<string, string> }} state
 * @param {Awaited<ReturnType<typeof deriveSetupWizardFacts>>} facts
 * @returns {SetupStepUiStatus}
 */
export function effectiveStepStatus(stepId, state, facts) {
  if (state.skipped[stepId]) return 'skipped';
  if (state.completed[stepId]) return 'complete';
  if (derivedStepComplete(stepId, facts)) return 'complete';
  return 'pending';
}

/**
 * Merge completion or skip timestamp into setupWizardState JSON.
 * @param {unknown} currentRaw
 * @param {'complete' | 'skip'} action
 * @param {string} stepId
 */
export function mergeWizardStep(currentRaw, action, stepId) {
  if (!STEP_IDS.has(stepId)) {
    throw new Error(`Unknown setup wizard step: ${stepId}`);
  }
  const { completed, skipped } = parseSetupWizardState(currentRaw);
  const iso = new Date().toISOString();
  const nextCompleted = { ...completed };
  const nextSkipped = { ...skipped };
  if (action === 'complete') {
    delete nextSkipped[stepId];
    nextCompleted[stepId] = iso;
  } else {
    delete nextCompleted[stepId];
    nextSkipped[stepId] = iso;
  }
  return { completed: nextCompleted, skipped: nextSkipped };
}
