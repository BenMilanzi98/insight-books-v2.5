/**
 * CoA V2 — existing-business migration readiness (Phase 3 §37). READ-ONLY.
 *
 * Assesses every business against the V2 requirements and assigns a readiness
 * status. Never applies one business's mappings to another.
 */

import prisma from '../../prisma.js';
import { classifyDuplicateAccounts } from './duplicateClassifier.js';
import { normalizeAccountCode } from '../domain/codeGovernance.js';
import { findCycles } from '../domain/hierarchy.js';
import { LEGACY_SALARY_BUCKET_CODES, CANONICAL_SALARY_ACCOUNT_CODE } from '../../salaryExpenseAccountCodes.js';

export const ReadinessStatus = Object.freeze({
  READY: 'READY',
  READY_WITH_WARNINGS: 'READY_WITH_WARNINGS',
  REQUIRES_MAPPING: 'REQUIRES_MAPPING',
  REQUIRES_CLEANUP: 'REQUIRES_CLEANUP',
  BLOCKED: 'BLOCKED',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
});

const CORE_PURPOSES = ['ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE', 'SALES_REVENUE', 'CASH_ON_HAND', 'SALARIES_AND_WAGES'];

/**
 * @param {import('@prisma/client').PrismaClient} [db]
 * @param {{tenantId?: string|null}} [scope]
 * @returns {Promise<Array<object>>} one row per business
 */
export async function assessBusinessReadiness(db = prisma, scope = {}) {
  const tenants = await db.tenant.findMany({
    where: scope.tenantId ? { id: scope.tenantId } : {},
    select: { id: true, name: true },
  });
  const duplicates = await classifyDuplicateAccounts(db, scope);
  const mappings = await db.coaV2AccountMapping.findMany({ where: { status: 'ACTIVE' } });

  const rows = [];
  for (const tenant of tenants) {
    const accounts = await db.account.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true, tenantId: true, accountCode: true, code: true, accountName: true, name: true,
        accountType: true, type: true, normalBalance: true, parentAccountId: true,
        isActive: true, acceptsNewTransactions: true, systemPurpose: true,
        coaV2Category: true, coaV2NormalBalance: true, coaV2Behaviour: true, coaV2Status: true,
      },
    });
    const accountIds = accounts.map((a) => a.id);
    const activeChildren = new Set(
      accounts.filter((a) => a.parentAccountId && a.isActive !== false).map((a) => a.parentAccountId)
    );

    // Parents with direct posted activity (double-count hazard, both ledgers)
    const parentIds = [...activeChildren];
    const [parentTl, parentJel] = await Promise.all([
      db.transactionLine.groupBy({ by: ['accountId'], where: { accountId: { in: parentIds } }, _count: { _all: true } }),
      db.journalEntryLine.groupBy({ by: ['accountId'], where: { accountId: { in: parentIds } }, _count: { _all: true } }),
    ]);
    const parentsWithPostings = new Set([
      ...parentTl.filter((r) => r._count._all > 0).map((r) => r.accountId),
      ...parentJel.filter((r) => r._count._all > 0).map((r) => r.accountId),
    ]);

    const tenantDuplicates = duplicates.filter((d) => d.tenantId === tenant.id);
    const tenantMappings = mappings.filter((m) => m.tenantId === tenant.id);
    const codes = new Set(accounts.map((a) => normalizeAccountCode(a.accountCode ?? a.code)).filter(Boolean));

    const counts = {
      totalAccounts: accounts.length,
      duplicateCodeGroups: tenantDuplicates.filter((d) => d.duplicateClass === 'CODE_DUPLICATE').length,
      duplicateNameCandidates: tenantDuplicates.filter((d) => d.duplicateClass === 'SEMANTIC_DUPLICATE' || d.duplicateClass === 'UNUSED_DUPLICATE').length,
      accountsWithoutCategory: accounts.filter((a) => !a.coaV2Category && !(a.accountType ?? a.type)).length,
      accountsWithoutNormalBalance: accounts.filter((a) => !a.coaV2NormalBalance && !a.normalBalance).length,
      unclassifiedForV2: accounts.filter((a) => !a.coaV2Category).length,
      parentsWithDirectPostings: parentsWithPostings.size,
      postingAccountsWithChildren: accounts.filter((a) => a.coaV2Behaviour === 'POSTING' && activeChildren.has(a.id)).length,
      hierarchyCycles: findCycles(accounts).length,
      missingCorePurposes: CORE_PURPOSES.filter(
        (p) => !tenantMappings.some((m) => m.purpose === p) &&
               !accounts.some((a) => a.systemPurpose === p && a.isActive !== false)
      ),
      conflictingSystemMappings: tenantDuplicates.filter((d) => d.duplicateClass === 'CONFLICTING_SYSTEM_PURPOSE').length,
      salaryConflicts: accounts.filter((a) => LEGACY_SALARY_BUCKET_CODES.has(normalizeAccountCode(a.accountCode ?? a.code))).length,
      hasCanonicalSalary: codes.has(CANONICAL_SALARY_ACCOUNT_CODE),
      hasArControl: codes.has('1200') || tenantMappings.some((m) => m.purpose === 'ACCOUNTS_RECEIVABLE'),
      hasApControl: codes.has('2110') || tenantMappings.some((m) => m.purpose === 'ACCOUNTS_PAYABLE'),
      hasEquityCore: codes.has('3100') && codes.has('3200'),
      inactiveStillReferenced: 0,
    };

    // Inactive accounts that active mappings or expense categories still reference
    const inactiveIds = accounts.filter((a) => a.isActive === false).map((a) => a.id);
    if (inactiveIds.length > 0) {
      const refs = await db.expenseCategory.count({ where: { accountId: { in: inactiveIds } } });
      const mapRefs = tenantMappings.filter((m) => inactiveIds.includes(m.accountId)).length;
      counts.inactiveStillReferenced = refs + mapRefs;
    }

    let status = ReadinessStatus.READY;
    const blockers = [];
    const warnings = [];

    if (counts.hierarchyCycles > 0) { status = ReadinessStatus.BLOCKED; blockers.push('hierarchy cycles'); }
    if (counts.duplicateCodeGroups > 0) { status = ReadinessStatus.BLOCKED; blockers.push('duplicate account codes'); }
    if (status !== ReadinessStatus.BLOCKED) {
      if (counts.parentsWithDirectPostings > 0 || counts.salaryConflicts > 0 || counts.conflictingSystemMappings > 0) {
        status = ReadinessStatus.REQUIRES_CLEANUP;
        if (counts.parentsWithDirectPostings > 0) blockers.push('parents with direct postings');
        if (counts.salaryConflicts > 0) blockers.push('conflicting salary accounts');
        if (counts.conflictingSystemMappings > 0) blockers.push('conflicting system purposes');
      } else if (counts.missingCorePurposes.length > 0 || !counts.hasCanonicalSalary) {
        status = ReadinessStatus.REQUIRES_MAPPING;
        blockers.push(`missing core purposes: ${counts.missingCorePurposes.join('/')}${counts.hasCanonicalSalary ? '' : ', no 5200'}`);
      } else if (counts.duplicateNameCandidates > 0) {
        status = ReadinessStatus.MANUAL_REVIEW_REQUIRED;
        warnings.push('name-duplicate candidates need review');
      } else if (counts.unclassifiedForV2 > 0 || counts.inactiveStillReferenced > 0) {
        status = ReadinessStatus.READY_WITH_WARNINGS;
        if (counts.unclassifiedForV2 > 0) warnings.push(`${counts.unclassifiedForV2} accounts pending V2 classification`);
        if (counts.inactiveStillReferenced > 0) warnings.push('inactive accounts still referenced');
      }
    }

    rows.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      status,
      blockers: blockers.join('; '),
      warnings: warnings.join('; '),
      ...counts,
      missingCorePurposes: counts.missingCorePurposes.join('/'),
    });
  }
  return rows;
}

/** CSV projection for artifacts/accounting-coa/business-coa-readiness.csv */
export function readinessToCsv(rows) {
  const headers = [
    'tenantId', 'tenantName', 'status', 'blockers', 'warnings', 'totalAccounts',
    'duplicateCodeGroups', 'duplicateNameCandidates', 'accountsWithoutCategory',
    'accountsWithoutNormalBalance', 'unclassifiedForV2', 'parentsWithDirectPostings',
    'postingAccountsWithChildren', 'hierarchyCycles', 'missingCorePurposes',
    'conflictingSystemMappings', 'salaryConflicts', 'hasCanonicalSalary',
    'hasArControl', 'hasApControl', 'hasEquityCore', 'inactiveStillReferenced',
  ];
  const escape = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}
