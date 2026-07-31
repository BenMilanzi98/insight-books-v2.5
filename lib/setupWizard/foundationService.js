/**
 * Slice 2 — profile sync, CoA readiness, system mapping checks.
 */

import prisma from '../prisma.js';
import { ensureChartOfAccountsForTenant } from '../chartOfAccountsInitialization.js';
import { resolveOpeningBalanceEquityAccount } from '../openingBalanceEquityAccount.js';
import { MissingSystemAccountMappingError } from './errors.js';
import { SETUP_STEP_STATUS } from './constants.js';

const REQUIRED_PURPOSES = [
  'OPENING_BALANCE_EQUITY',
  'ACCOUNTS_RECEIVABLE_CONTROL',
  'ACCOUNTS_PAYABLE_CONTROL',
  'INVENTORY_ASSET',
];

/**
 * Persist profile fields onto Tenant / TenantSettings where columns exist.
 */
export async function applyProfileToBusiness(tenantId, payload, db = prisma) {
  if (!payload || typeof payload !== 'object') return null;

  const tenantPatch = {};
  if (payload.legalName || payload.tradingName) {
    tenantPatch.name = payload.legalName || payload.tradingName;
  }
  if (Object.keys(tenantPatch).length) {
    await db.tenant.update({ where: { id: tenantId }, data: tenantPatch }).catch(() => null);
  }

  const settingsPatch = {};
  if (payload.businessEmail) settingsPatch.businessEmail = payload.businessEmail;
  if (payload.businessPhone) settingsPatch.businessPhone = payload.businessPhone;
  if (payload.country || payload.address) {
    settingsPatch.businessAddress = [payload.address, payload.country].filter(Boolean).join(', ');
  }
  if (payload.baseCurrency) {
    /* currency may live on tenant — store in metadata via settings if no column */
  }

  if (Object.keys(settingsPatch).length) {
    await db.tenantSettings
      .upsert({
        where: { tenantId },
        create: { tenantId, ...settingsPatch },
        update: settingsPatch,
      })
      .catch(() => null);
  }

  return { tenantPatch, settingsPatch };
}

/**
 * Ensure default CoA exists; return account summary for wizard.
 */
export async function ensureCoaForSetup(tenantId, db = prisma) {
  await ensureChartOfAccountsForTenant(tenantId, db, { preferSystemCoaDefinition: true });
  const count = await db.account.count({ where: { tenantId, isActive: true } });
  const sample = await db.account.findMany({
    where: { tenantId, isActive: true },
    take: 20,
    orderBy: { accountCode: 'asc' },
    select: { id: true, accountCode: true, code: true, accountName: true, name: true, accountType: true },
  });
  return { accountCount: count, sample };
}

/**
 * Resolve critical system accounts for mappings step.
 * Uses registry when present; falls back to code-based OB equity + name heuristics.
 */
export async function resolveSetupSystemMappings(tenantId, payloadMappings = {}, db = prisma) {
  const mappings = { ...payloadMappings };
  const issues = [];

  if (!mappings.OPENING_BALANCE_EQUITY) {
    const ob = await resolveOpeningBalanceEquityAccount(tenantId, db);
    mappings.OPENING_BALANCE_EQUITY = ob.id;
  }

  async function findByCodeOrName(codes, namePattern) {
    const byCode = await db.account.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: codes.map((c) => ({ accountCode: c })),
      },
    });
    if (byCode) return byCode;
    return db.account.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { accountName: { contains: namePattern, mode: 'insensitive' } },
          { name: { contains: namePattern, mode: 'insensitive' } },
        ],
      },
    });
  }

  if (!mappings.ACCOUNTS_RECEIVABLE_CONTROL) {
    const ar = await findByCodeOrName(['1200', '1100'], 'Receivable');
    if (ar) mappings.ACCOUNTS_RECEIVABLE_CONTROL = ar.id;
    else issues.push('ACCOUNTS_RECEIVABLE_CONTROL');
  }
  if (!mappings.ACCOUNTS_PAYABLE_CONTROL) {
    const ap = await findByCodeOrName(['2100', '2000'], 'Payable');
    if (ap) mappings.ACCOUNTS_PAYABLE_CONTROL = ap.id;
    else issues.push('ACCOUNTS_PAYABLE_CONTROL');
  }
  if (!mappings.INVENTORY_ASSET) {
    const inv = await findByCodeOrName(['1300', '1400'], 'Inventor');
    if (inv) mappings.INVENTORY_ASSET = inv.id;
    else issues.push('INVENTORY_ASSET');
  }

  // Validate mapped ids belong to tenant and are active
  for (const purpose of Object.keys(mappings)) {
    const id = mappings[purpose];
    if (!id) continue;
    const acct = await db.account.findFirst({ where: { id, tenantId } });
    if (!acct || acct.isActive === false) {
      issues.push(purpose);
    }
  }

  return { mappings, issues, required: REQUIRED_PURPOSES };
}

export function assertRequiredMappings(mappingResult) {
  const missing = mappingResult.issues || [];
  if (missing.includes('OPENING_BALANCE_EQUITY')) {
    throw new MissingSystemAccountMappingError('OPENING_BALANCE_EQUITY');
  }
}

/**
 * Mark foundation steps complete helpers
 */
export function foundationStepStatus(ok, warnings = []) {
  if (!ok) return SETUP_STEP_STATUS.REQUIRES_REVIEW;
  if (warnings.length) return SETUP_STEP_STATUS.COMPLETED_WITH_WARNINGS;
  return SETUP_STEP_STATUS.COMPLETED;
}
