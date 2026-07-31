/**
 * Onboarding accounting boundary — Phase 17 Wave 3.
 * Coordination only: onboarding modules must not create journals / OB / opening stock.
 * Ambient unrelated tenant GL does not fail this assert (side-effect from onboarding path only).
 */

const ONBOARDING_SOURCE_MARKERS = new Set([
  'ONBOARDING',
  'CUSTOMER_ONBOARDING',
  'CS_ONBOARDING',
  'PHASE_17_ONBOARDING',
]);

function isOnboardingAuthored(row) {
  if (!row || typeof row !== 'object') return false;
  const markers = [
    row.sourceDomain,
    row.source,
    row.createdByDomain,
    row.origin,
    row.postingSource,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toUpperCase());
  if (markers.some((m) => ONBOARDING_SOURCE_MARKERS.has(m))) return true;
  if (row.onboardingProjectId || row.customerOnboardingProjectId) return true;
  return false;
}

export function assertNoOnboardingAccountingCreate(args = {}) {
  const type = String(args.type || args.resourceType || '')
    .trim()
    .toUpperCase();
  const forbidden = new Set([
    'JOURNAL',
    'JOURNAL_ENTRY',
    'OPENING_BALANCE',
    'OB',
    'OPENING_STOCK',
    'STOCK',
    'AR',
    'AP',
    'TAX_POSTING',
  ]);
  if (forbidden.has(type)) {
    return {
      ok: false,
      error: 'accounting_boundary_forbidden',
      type,
      createsJournals: false,
      createsOpeningBalances: false,
      createsOpeningStock: false,
    };
  }
  return { ok: true, type: type || null };
}

/**
 * Assert onboarding path has not introduced journal/OB/stock creates.
 * Unrelated ambient tenant journals/balances do not fail.
 */
export async function assertOnboardingAccountingBoundary(prisma, args = {}) {
  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  if (!tenantId) {
    return { ok: false, error: 'tenantId_required' };
  }

  let journalCount = 0;
  let balanceCount = 0;
  let openingBalanceCount = 0;
  let openingStockCount = 0;
  let onboardingAuthoredCount = 0;

  let journals = [];
  if (typeof prisma?.journalEntry?.findMany === 'function') {
    journals = await prisma.journalEntry.findMany({ where: { tenantId } });
    journalCount = journals.length;
  } else if (typeof prisma?.journalEntry?.count === 'function') {
    journalCount = await prisma.journalEntry.count({ where: { tenantId } });
  }

  if (typeof prisma?.accountBalance?.count === 'function') {
    balanceCount = await prisma.accountBalance.count({ where: { tenantId } });
  }

  let openingBalances = [];
  if (typeof prisma?.openingBalance?.findMany === 'function') {
    openingBalances = await prisma.openingBalance.findMany({
      where: { tenantId },
    });
    openingBalanceCount = openingBalances.length;
  } else if (typeof prisma?.openingBalance?.count === 'function') {
    openingBalanceCount = await prisma.openingBalance.count({
      where: { tenantId },
    });
  }

  let openingStocks = [];
  if (typeof prisma?.openingStock?.findMany === 'function') {
    openingStocks = await prisma.openingStock.findMany({
      where: { tenantId },
    });
    openingStockCount = openingStocks.length;
  } else if (typeof prisma?.openingStock?.count === 'function') {
    openingStockCount = await prisma.openingStock.count({
      where: { tenantId },
    });
  }

  const authored = [
    ...journals.filter(isOnboardingAuthored),
    ...openingBalances.filter(isOnboardingAuthored),
    ...openingStocks.filter(isOnboardingAuthored),
  ];
  onboardingAuthoredCount = authored.length;

  // Fail only when onboarding-authored side effects exist — not ambient tenant GL
  const violated = onboardingAuthoredCount > 0;

  return {
    ok: !violated,
    error: violated ? 'onboarding_accounting_side_effect_detected' : undefined,
    journalCount,
    balanceCount,
    openingBalanceCount,
    openingStockCount,
    onboardingAuthoredCount,
    tenantId,
    projectId: args.projectId || null,
    createsJournals: false,
    createsOpeningBalances: false,
    createsOpeningStock: false,
    assertNoCreate: assertNoOnboardingAccountingCreate,
  };
}

/** Explicit refuse helper — onboarding must never expose journal create. */
export async function createOnboardingJournalEntry(_prisma, _args = {}) {
  return {
    ok: false,
    error: 'accounting_boundary_forbidden',
    reason: 'onboarding_must_not_create_journals',
  };
}

const GOVERNED_ACTIONS = new Set([
  'GOVERNED_COA_SERVICE',
  'GOVERNED_PERIOD_SERVICE',
  'GOVERNED_OB_SERVICE',
  'GOVERNED_STOCK_SERVICE',
  'GOVERNED_ACCOUNTING_SERVICE',
]);

const FORBIDDEN_ACTIONS = new Set([
  'BALANCE_EDIT',
  'EDIT_BALANCE',
  'FAKE_JOURNAL',
  'JOURNAL',
  'JOURNAL_ENTRY',
  'SYSTEM_COA_ADMIN',
  'SYSTEM_COA',
  'COA_ADMIN',
  'OPENING_BALANCE',
  'OPENING_STOCK',
]);

/**
 * Phase 21 Wave 2 — accounting via governed services only.
 * No balance edit / fake journal / System CoA admin from onboarding.
 */
export function assertGovernedAccountingOnly(args = {}) {
  const action = String(args.action || args.type || args.resourceType || '')
    .trim()
    .toUpperCase();
  if (!action) {
    return { ok: false, error: 'accounting_action_required' };
  }
  if (FORBIDDEN_ACTIONS.has(action)) {
    return {
      ok: false,
      error: 'accounting_boundary_forbidden',
      action,
      reason: 'onboarding_governed_services_only',
    };
  }
  if (GOVERNED_ACTIONS.has(action)) {
    return { ok: true, action, governed: true };
  }
  return {
    ok: false,
    error: 'accounting_boundary_forbidden',
    action,
    reason: 'ungoverned_accounting_action',
  };
}

/** Explicit refuse — onboarding must never edit Tenant GL balances. */
export async function editOnboardingAccountBalance(_prisma, _args = {}) {
  return {
    ok: false,
    error: 'accounting_boundary_forbidden',
    reason: 'onboarding_must_not_edit_balances',
  };
}

/** Explicit refuse — System CoA admin stays removed from onboarding. */
export async function administerOnboardingSystemCoa(_prisma, _args = {}) {
  return {
    ok: false,
    error: 'accounting_boundary_forbidden',
    reason: 'onboarding_system_coa_admin_forbidden',
  };
}
