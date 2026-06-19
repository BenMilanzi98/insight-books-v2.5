/**
 * Optional setup wizard: persisted state on TenantSettings.setupWizardState,
 * and derived completion checks aligned with real tenant data.
 */

import { resolvePrimaryCapitalAccount } from '@/lib/resolveCapitalAccount';
import { SETUP_WIZARD_STEP_DEFS, SETUP_WIZARD_STEP_IDS } from '@/lib/setupWizardStepsMeta';

export { SETUP_WIZARD_STEP_DEFS };

/** @typedef {'complete' | 'skipped' | 'pending'} SetupStepUiStatus */

const STEP_IDS = new Set(SETUP_WIZARD_STEP_IDS);

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
    paymentOkCount,
    tenantSettingsRow,
    taxTypeCount,
    clientCount,
    supplierCount,
    equityLinkedCount,
    assetCount,
    liabilityCount,
    stockedProductCount,
    stockInMovementCount,
    openingBalanceTxCount,
  ] = await Promise.all([
    db.paymentAccount.count({
      where: { tenantId, isActive: true, coaAccountId: { not: null } },
    }),
    db.tenantSettings.findUnique({
      where: { tenantId },
      select: {
        taxInflowAccountId: true,
        taxOutflowAccountId: true,
        openingBalancesAsOfDate: true,
      },
    }),
    db.taxType.count({ where: { tenantId, status: 'Active' } }),
    db.client.count({ where: { tenantId } }),
    db.supplier.count({ where: { tenantId } }),
    db.equityAccount.count({
      where: { tenantId, isActive: true, coaAccountId: { not: null } },
    }),
    db.asset.count({ where: { tenantId } }),
    db.liability.count({ where: { tenantId } }),
    db.product.count({
      where: { tenantId, isService: false, stockLevel: { gt: 0 } },
    }),
    db.inventoryTransaction.count({
      where: { tenantId, type: 'Stock In' },
    }),
    db.transaction.count({
      where: {
        tenantId,
        status: 'posted',
        isReversal: false,
        OR: [
          { sourceType: 'onboarding' },
          { entryType: 'Opening', sourceType: { in: ['OpeningBalance', 'onboarding'] } },
        ],
      },
    }),
  ]);

  const taxSettings = tenantSettingsRow;
  const taxGlConfigured = !!(
    taxSettings?.taxInflowAccountId && taxSettings?.taxOutflowAccountId
  );
  const capitalConfigured = !!primaryCapital?.id || equityLinkedCount > 0;
  const hasOpeningStock = stockedProductCount > 0 || stockInMovementCount > 0;

  return {
    paymentAccountCount: paymentOkCount,
    assetCount,
    liabilityCount,
    clientCount,
    supplierCount,
    taxTypeCount,
    stockedProductCount,
    stockInMovementCount,
    capitalConfigured,
    taxGlConfigured,
    taxConfigured: taxGlConfigured && taxTypeCount > 0,
    hasActivePaymentAccountWithCoa: paymentOkCount > 0,
    hasAssets: assetCount > 0,
    hasLiabilities: liabilityCount > 0,
    hasClients: clientCount > 0,
    hasSuppliers: supplierCount > 0,
    hasOpeningStock,
    hasStartingDate: !!tenantSettingsRow?.openingBalancesAsOfDate,
    hasOpeningBalancesReview: openingBalanceTxCount > 0,
    openingBalanceTxCount,
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
    case 'startingDate':
      return facts.hasStartingDate;
    case 'capital':
      return facts.capitalConfigured;
    case 'assets':
      return facts.hasAssets;
    case 'liabilities':
      return facts.hasLiabilities;
    case 'paymentAccounts':
      return facts.hasActivePaymentAccountWithCoa;
    case 'taxes':
    case 'taxAccounts':
      return facts.taxConfigured;
    case 'clients':
      return facts.hasClients;
    case 'suppliers':
      return facts.hasSuppliers;
    case 'openingStock':
      return facts.hasOpeningStock;
    case 'openingBalancesReview':
      return facts.hasOpeningBalancesReview;
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

/**
 * Mark every pending step as skipped (owner chose to skip entire wizard).
 * @param {unknown} currentRaw
 * @param {string[]} pendingStepIds
 */
export function mergeSkipAllSteps(currentRaw, pendingStepIds) {
  const { completed, skipped } = parseSetupWizardState(currentRaw);
  const iso = new Date().toISOString();
  const nextCompleted = { ...completed };
  const nextSkipped = { ...skipped };
  for (const stepId of pendingStepIds || []) {
    if (!STEP_IDS.has(stepId)) continue;
    delete nextCompleted[stepId];
    nextSkipped[stepId] = iso;
  }
  return { completed: nextCompleted, skipped: nextSkipped };
}

/**
 * Mark opening-stock wizard step complete when tenant records initial inventory.
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 */
export async function completeOpeningStockWizardStep(tenantId, db) {
  if (!tenantId) return;
  try {
    const existing = await db.tenantSettings.findUnique({
      where: { tenantId },
      select: { setupWizardState: true },
    });
    const nextWizard = mergeWizardStep(existing?.setupWizardState, 'complete', 'openingStock');
    await db.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, setupWizardState: nextWizard },
      update: { setupWizardState: nextWizard },
    });
  } catch (wizErr) {
    console.warn('openingStock: setup wizard state update skipped:', wizErr?.message || wizErr);
  }
}
