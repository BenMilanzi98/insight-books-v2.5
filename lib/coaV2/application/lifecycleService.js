/**
 * CoA V2 — account lifecycle and safe consolidation workflow (Phase 3 §18–19, §38).
 *
 * Lifecycle: ACTIVE → DEPRECATED → ARCHIVED (with controlled restore).
 * Consolidation: duplicate → canonical via an approved plan that deprecates and
 * aliases the duplicate for FUTURE postings only.
 *
 * Hard guarantees:
 *  - No account row is ever deleted here.
 *  - No historical journal/transaction line is ever modified here.
 *  - Historical reclassification is recorded as a Phase 6 recommendation on the plan.
 */

import prisma from '../../prisma.js';
import { AccountingValidationError, CrossTenantAccountingError, ApprovalRequiredError } from '../../accountingV2/domain/errors.js';
import { AccountLifecycleStatus, validateLifecycleTransition, behaviourIsProtected } from '../domain/behaviours.js';
import { isProtectedPurpose } from '../domain/systemPurposes.js';
import { createAccountAlias } from './aliasResolver.js';

/**
 * Usage facts for an account — counted, never mutated. Drives impact analysis,
 * deprecation checks, delete rejection, and Phase 6 recommendations.
 * Counts BOTH ledgers (JRN-009: TransactionLine + JournalEntryLine).
 *
 * @param {object} db
 * @param {{businessId: string}} context
 * @param {string} accountId
 */
export async function getAccountUsage(context, accountId, db = prisma) {
  const [transactionLines, journalLines, expenses, mappings, aliases, children, firstTl, lastTl] = await Promise.all([
    db.transactionLine.count({ where: { accountId } }),
    db.journalEntryLine.count({ where: { accountId } }),
    db.expense.count({ where: { expenseAccountId: accountId } }),
    db.coaV2AccountMapping.count({ where: { accountId, status: 'ACTIVE' } }),
    db.coaV2AccountAlias.count({ where: { canonicalAccountId: accountId } }),
    db.account.count({ where: { parentAccountId: accountId, isActive: true } }),
    db.transactionLine.findFirst({ where: { accountId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    db.transactionLine.findFirst({ where: { accountId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);
  const totalLines = transactionLines + journalLines;
  return {
    transactionLines,
    journalLines,
    totalLines,
    expenses,
    activeMappings: mappings,
    aliasesPointingHere: aliases,
    activeChildren: children,
    firstActivityAt: firstTl?.createdAt ?? null,
    lastActivityAt: lastTl?.createdAt ?? null,
    hasHistoricalActivity: totalLines > 0 || expenses > 0,
  };
}

async function loadOwnedAccount(db, context, accountId) {
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const account = await db.account.findFirst({
    where: { id: accountId, tenantId: context.businessId },
  });
  if (!account) {
    throw new CrossTenantAccountingError({ accountId, expected: context.businessId }, ids);
  }
  return account;
}

/**
 * Deprecate an account: future postings blocked, history preserved.
 * @param {object} params { db?, context, accountId, reason, replacementAccountId? }
 */
export async function deprecateAccount(params) {
  const db = params.db ?? prisma;
  const { context } = params;
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const account = await loadOwnedAccount(db, context, params.accountId);
  const usage = await getAccountUsage(context, account.id, db);

  if (!params.reason || String(params.reason).trim().length < 5) {
    throw new AccountingValidationError('Deprecation requires a documented reason', ids);
  }
  if (account.systemPurpose && isProtectedPurpose(account.systemPurpose)) {
    throw new AccountingValidationError(
      `Account holds protected system purpose ${account.systemPurpose}; remap the purpose first`, ids
    );
  }
  if (usage.activeMappings > 0) {
    throw new AccountingValidationError('Account has active purpose mappings; retire or re-point them first', ids);
  }
  const transition = validateLifecycleTransition({
    from: account.coaV2Status ?? AccountLifecycleStatus.ACTIVE,
    to: AccountLifecycleStatus.DEPRECATED,
    behaviour: account.coaV2Behaviour,
    isRequiredSystemAccount: false,
    hasActivePostingReferences: usage.hasHistoricalActivity,
    replacementAccountId: params.replacementAccountId ?? account.replacementAccountId ?? null,
  });
  if (!transition.valid) {
    throw new AccountingValidationError(transition.errors.join('; '), ids);
  }
  if (params.replacementAccountId) {
    await loadOwnedAccount(db, context, params.replacementAccountId);
  }
  const updated = await db.account.update({
    where: { id: account.id },
    data: {
      coaV2Status: AccountLifecycleStatus.DEPRECATED,
      deprecationReason: params.reason,
      replacementAccountId: params.replacementAccountId ?? account.replacementAccountId ?? null,
      acceptsNewTransactions: false,
      postingAllowed: false,
      coaEffectiveTo: new Date(),
      coaV2UpdatedBy: context.userId ?? null,
    },
  });
  return { account: updated, usage };
}

/**
 * Archive an account. Rejected for system/control behaviour, protected purposes,
 * active children, or active mappings. History is never touched.
 */
export async function archiveAccount(params) {
  const db = params.db ?? prisma;
  const { context } = params;
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const account = await loadOwnedAccount(db, context, params.accountId);
  const usage = await getAccountUsage(context, account.id, db);

  if (behaviourIsProtected(account.coaV2Behaviour)) {
    throw new AccountingValidationError(`${account.coaV2Behaviour} accounts cannot be archived`, ids);
  }
  if (account.systemPurpose && isProtectedPurpose(account.systemPurpose)) {
    throw new AccountingValidationError('Required system accounts cannot be archived', ids);
  }
  if (usage.activeMappings > 0) {
    throw new AccountingValidationError('Account has active purpose mappings; retire them first', ids);
  }
  if (usage.activeChildren > 0) {
    throw new AccountingValidationError('Account has active children; move or archive them first', ids);
  }
  const transition = validateLifecycleTransition({
    from: account.coaV2Status ?? AccountLifecycleStatus.ACTIVE,
    to: AccountLifecycleStatus.ARCHIVED,
    hasActivePostingReferences: usage.hasHistoricalActivity,
    replacementAccountId: account.replacementAccountId,
  });
  if (!transition.valid && !(account.coaV2Status === AccountLifecycleStatus.DEPRECATED)) {
    throw new AccountingValidationError(transition.errors.join('; '), ids);
  }
  const updated = await db.account.update({
    where: { id: account.id },
    data: {
      coaV2Status: AccountLifecycleStatus.ARCHIVED,
      isActive: false,
      acceptsNewTransactions: false,
      postingAllowed: false,
      archivedAt: new Date(),
      coaV2UpdatedBy: context.userId ?? null,
    },
  });
  return { account: updated, usage };
}

/** Restore an eligible archived/deprecated account to ACTIVE. */
export async function restoreAccount(params) {
  const db = params.db ?? prisma;
  const { context } = params;
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const account = await loadOwnedAccount(db, context, params.accountId);
  const from = account.coaV2Status ?? AccountLifecycleStatus.ACTIVE;
  if (from === AccountLifecycleStatus.ACTIVE) {
    throw new AccountingValidationError('Account is already active', ids);
  }
  if (!params.reason || String(params.reason).trim().length < 5) {
    throw new AccountingValidationError('Restoration requires a documented reason', ids);
  }
  const updated = await db.account.update({
    where: { id: account.id },
    data: {
      coaV2Status: AccountLifecycleStatus.ACTIVE,
      isActive: true,
      acceptsNewTransactions: true,
      postingAllowed: account.coaV2Behaviour === 'HEADER' ? false : true,
      archivedAt: null,
      deprecationReason: null,
      coaEffectiveTo: null,
      coaV2UpdatedBy: context.userId ?? null,
    },
  });
  return { account: updated };
}

/**
 * Guard for any delete endpoint (Phase 3 §28): referenced, system, control,
 * mapped, or parent accounts must never be hard-deleted. Phase 3 itself
 * performs NO hard deletes; this exists so API layers can uniformly reject.
 */
export async function assertAccountDeletable(context, accountId, db = prisma) {
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const account = await loadOwnedAccount(db, context, accountId);
  const usage = await getAccountUsage(context, accountId, db);
  const reasons = [];
  if (usage.hasHistoricalActivity) reasons.push('account has historical journal or transaction activity');
  if (account.isSystem || account.coaV2Behaviour === 'SYSTEM') reasons.push('system accounts cannot be deleted');
  if (account.coaV2Behaviour === 'CONTROL') reasons.push('control accounts cannot be deleted');
  if (account.systemPurpose) reasons.push('account is assigned a system purpose');
  if (usage.activeMappings > 0) reasons.push('account has active purpose mappings');
  if (usage.activeChildren > 0) reasons.push('account has child accounts');
  if (usage.aliasesPointingHere > 0) reasons.push('account is an alias target');
  if (reasons.length > 0) {
    throw new AccountingValidationError(
      `Account cannot be deleted (${reasons.join('; ')}). Archive it instead.`, ids
    );
  }
  return true;
}

/** Consolidation plan statuses. */
export const ConsolidationPlanStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  EXECUTED: 'EXECUTED',
  REJECTED: 'REJECTED',
});

/**
 * Create a consolidation plan (steps 1–13 of the §19 workflow): full impact
 * analysis is captured on the plan; nothing changes until approval + execution.
 */
export async function createConsolidationPlan(params) {
  const db = params.db ?? prisma;
  const { context } = params;
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const duplicate = await loadOwnedAccount(db, context, params.duplicateAccountId);
  const canonical = await loadOwnedAccount(db, context, params.canonicalAccountId);
  if (duplicate.id === canonical.id) {
    throw new AccountingValidationError('Duplicate and canonical accounts must differ', ids);
  }
  const analysisWarnings = [];
  if ((duplicate.coaV2Category ?? null) !== (canonical.coaV2Category ?? null)) {
    analysisWarnings.push(`Category mismatch: ${duplicate.coaV2Category} vs ${canonical.coaV2Category}`);
  }
  if ((duplicate.coaV2NormalBalance ?? null) !== (canonical.coaV2NormalBalance ?? null)) {
    analysisWarnings.push(`Normal-balance mismatch: ${duplicate.coaV2NormalBalance} vs ${canonical.coaV2NormalBalance}`);
  }
  const duplicateUsage = await getAccountUsage(context, duplicate.id, db);
  const canonicalUsage = await getAccountUsage(context, canonical.id, db);

  return db.coaV2ConsolidationPlan.create({
    data: {
      tenantId: context.businessId,
      duplicateAccountId: duplicate.id,
      canonicalAccountId: canonical.id,
      status: ConsolidationPlanStatus.PENDING_APPROVAL,
      duplicateClass: params.duplicateClass ?? null,
      reason: params.reason ?? null,
      phase6RepairRequired: duplicateUsage.hasHistoricalActivity,
      analysis: {
        duplicate: {
          code: duplicate.accountCode ?? duplicate.code,
          name: duplicate.accountName ?? duplicate.name,
          category: duplicate.coaV2Category,
          normalBalance: duplicate.coaV2NormalBalance,
          usage: JSON.parse(JSON.stringify(duplicateUsage)),
        },
        canonical: {
          code: canonical.accountCode ?? canonical.code,
          name: canonical.accountName ?? canonical.name,
          category: canonical.coaV2Category,
          normalBalance: canonical.coaV2NormalBalance,
          usage: JSON.parse(JSON.stringify(canonicalUsage)),
        },
        warnings: analysisWarnings,
      },
      createdBy: context.userId ?? null,
    },
  });
}

/** Approve a pending plan (separate permission from creation). */
export async function approveConsolidationPlan(params) {
  const db = params.db ?? prisma;
  const { context } = params;
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const plan = await db.coaV2ConsolidationPlan.findFirst({
    where: { id: params.planId, tenantId: context.businessId },
  });
  if (!plan) throw new AccountingValidationError('Consolidation plan not found', ids);
  if (plan.status !== ConsolidationPlanStatus.PENDING_APPROVAL) {
    throw new AccountingValidationError(`Plan is ${plan.status}, not pending approval`, ids);
  }
  if (plan.createdBy && context.userId && plan.createdBy === context.userId) {
    throw new ApprovalRequiredError('Consolidation plans must be approved by a different user', ids);
  }
  return db.coaV2ConsolidationPlan.update({
    where: { id: plan.id },
    data: { status: ConsolidationPlanStatus.APPROVED, approvedBy: context.userId ?? null, approvedAt: new Date() },
  });
}

/**
 * Execute an APPROVED plan (steps 15–20): deprecate the duplicate with the
 * canonical as replacement, create an alias, and record the Phase 6 repair
 * recommendation. Historical journal lines are NOT touched.
 */
export async function executeConsolidationPlan(params) {
  const db = params.db ?? prisma;
  const { context } = params;
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const plan = await db.coaV2ConsolidationPlan.findFirst({
    where: { id: params.planId, tenantId: context.businessId },
  });
  if (!plan) throw new AccountingValidationError('Consolidation plan not found', ids);
  if (plan.status !== ConsolidationPlanStatus.APPROVED) {
    throw new ApprovalRequiredError('Consolidation requires an approved plan', ids);
  }
  const duplicate = await loadOwnedAccount(db, context, plan.duplicateAccountId);

  const { account: deprecated } = await deprecateAccount({
    db,
    context,
    accountId: plan.duplicateAccountId,
    reason: `Consolidated into canonical account (plan ${plan.id})`,
    replacementAccountId: plan.canonicalAccountId,
  });
  const aliasCode = duplicate.accountCode ?? duplicate.code;
  let alias = null;
  if (aliasCode) {
    const existing = await db.coaV2AccountAlias.findFirst({
      where: { tenantId: context.businessId, aliasCode },
    });
    if (!existing) {
      alias = await createAccountAlias({
        db,
        context,
        aliasCode,
        aliasName: duplicate.accountName ?? duplicate.name ?? null,
        legacyAccountId: duplicate.id,
        canonicalAccountId: plan.canonicalAccountId,
        reason: `Consolidation plan ${plan.id}`,
      });
    }
  }
  const executed = await db.coaV2ConsolidationPlan.update({
    where: { id: plan.id },
    data: { status: ConsolidationPlanStatus.EXECUTED, executedAt: new Date() },
  });
  return { plan: executed, deprecatedAccount: deprecated, alias };
}
