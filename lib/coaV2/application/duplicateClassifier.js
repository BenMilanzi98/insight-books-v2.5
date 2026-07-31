/**
 * CoA V2 — duplicate account classification (Phase 3 §17). READ-ONLY.
 *
 * Produces the duplicate-account register rows: candidates grouped and classed,
 * with activity counts from BOTH ledgers. Matching names alone never conclude
 * duplication — name matches produce review candidates, not automatic actions.
 */

import prisma from '../../prisma.js';
import { normalizeAccountCode } from '../domain/codeGovernance.js';
import { LEGACY_SALARY_BUCKET_CODES, CANONICAL_SALARY_ACCOUNT_CODE } from '../../salaryExpenseAccountCodes.js';

export const DuplicateClass = Object.freeze({
  EXACT_DUPLICATE: 'EXACT_DUPLICATE',
  SEMANTIC_DUPLICATE: 'SEMANTIC_DUPLICATE',
  SIMILAR_DISTINCT: 'SIMILAR_DISTINCT',
  HISTORICAL_DUPLICATE: 'HISTORICAL_DUPLICATE',
  IMPORT_DUPLICATE: 'IMPORT_DUPLICATE',
  TEMPLATE_DUPLICATE: 'TEMPLATE_DUPLICATE',
  WRONGLY_CLASSIFIED: 'WRONGLY_CLASSIFIED',
  CONFLICTING_SYSTEM_PURPOSE: 'CONFLICTING_SYSTEM_PURPOSE',
  UNUSED_DUPLICATE: 'UNUSED_DUPLICATE',
  NAME_DUPLICATE_DIFFERENT_MEANING: 'NAME_DUPLICATE_DIFFERENT_MEANING',
  CODE_DUPLICATE: 'CODE_DUPLICATE',
  PARENT_CHILD_DUPLICATE: 'PARENT_CHILD_DUPLICATE',
  REPORT_ONLY_DUPLICATION: 'REPORT_ONLY_DUPLICATION',
});

const normalizeName = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Classify duplicate candidates for one or all businesses.
 * @param {import('@prisma/client').PrismaClient} db
 * @param {{tenantId?: string|null}} [scope]
 * @returns {Promise<Array<object>>} register rows
 */
export async function classifyDuplicateAccounts(db = prisma, scope = {}) {
  const accounts = await db.account.findMany({
    where: { ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) },
    select: {
      id: true, tenantId: true, accountCode: true, code: true, accountName: true, name: true,
      accountType: true, type: true, accountSubtype: true, parentAccountId: true,
      isActive: true, isSystem: true, acceptsNewTransactions: true,
      mergedIntoAccountId: true, replacementAccountId: true,
      coaV2Category: true, coaV2Behaviour: true, coaV2Status: true, systemPurpose: true,
      createdAt: true,
    },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  // Activity per account, both ledgers, single grouped queries (no N+1)
  const [tlAgg, jelAgg] = await Promise.all([
    db.transactionLine.groupBy({
      by: ['accountId'],
      _count: { _all: true },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    db.journalEntryLine.groupBy({
      by: ['accountId'],
      _count: { _all: true },
      _sum: { debitAmount: true, creditAmount: true },
    }),
  ]);
  const activity = new Map();
  for (const row of tlAgg) {
    activity.set(row.accountId, {
      tl: row._count._all, jel: 0,
      debit: Number(row._sum.debitAmount ?? 0), credit: Number(row._sum.creditAmount ?? 0),
    });
  }
  for (const row of jelAgg) {
    const cur = activity.get(row.accountId) ?? { tl: 0, jel: 0, debit: 0, credit: 0 };
    cur.jel = row._count._all;
    cur.debit += Number(row._sum.debitAmount ?? 0);
    cur.credit += Number(row._sum.creditAmount ?? 0);
    activity.set(row.accountId, cur);
  }
  const usageOf = (id) => activity.get(id) ?? { tl: 0, jel: 0, debit: 0, credit: 0 };

  const rows = [];
  const pushRow = (account, duplicateClass, groupKey, proposedCanonical, note) => {
    const usage = usageOf(account.id);
    const totalLines = usage.tl + usage.jel;
    rows.push({
      tenantId: account.tenantId,
      accountId: account.id,
      code: account.accountCode ?? account.code ?? '',
      name: account.accountName ?? account.name ?? '',
      legacyType: account.accountType ?? account.type ?? '',
      v2Category: account.coaV2Category ?? '',
      behaviour: account.coaV2Behaviour ?? '',
      parentAccountId: account.parentAccountId ?? '',
      systemPurpose: account.systemPurpose ?? '',
      isActive: account.isActive !== false,
      status: account.coaV2Status ?? 'ACTIVE',
      duplicateClass,
      groupKey,
      journalLineCount: totalLines,
      transactionLineCount: usage.tl,
      journalEntryLineCount: usage.jel,
      totalDebitActivity: usage.debit,
      totalCreditActivity: usage.credit,
      proposedCanonicalAccountId: proposedCanonical ?? '',
      proposedAction: totalLines > 0
        ? (duplicateClass === DuplicateClass.SIMILAR_DISTINCT || duplicateClass === DuplicateClass.NAME_DUPLICATE_DIFFERENT_MEANING
          ? 'MANUAL_REVIEW'
          : 'CONSOLIDATE_WITH_PHASE6_REPAIR')
        : (duplicateClass === DuplicateClass.SIMILAR_DISTINCT ? 'MANUAL_REVIEW' : 'DEPRECATE_UNUSED'),
      historicalRepairRequired: totalLines > 0,
      approvalStatus: 'PENDING_REVIEW',
      note: note ?? '',
    });
  };

  const byTenant = new Map();
  for (const a of accounts) {
    const key = a.tenantId ?? '__NULL__';
    if (!byTenant.has(key)) byTenant.set(key, []);
    byTenant.get(key).push(a);
  }

  for (const [, list] of byTenant) {
    // 1. Code duplicates (legacy `code` column collisions the unique constraint misses)
    const byCode = new Map();
    for (const a of list) {
      const c = normalizeAccountCode(a.accountCode ?? a.code);
      if (!c) continue;
      if (!byCode.has(c)) byCode.set(c, []);
      byCode.get(c).push(a);
    }
    for (const [c, group] of byCode) {
      if (group.length > 1) {
        const canonical = group.find((g) => g.isSystem) ?? group[0];
        for (const a of group) {
          if (a.id === canonical.id) continue;
          pushRow(a, DuplicateClass.CODE_DUPLICATE, `code:${a.tenantId}:${c}`, canonical.id,
            'Two rows share one code inside the business');
        }
      }
    }

    // 2. Name duplicates within the same category (semantic candidates)
    const byName = new Map();
    for (const a of list) {
      if (a.mergedIntoAccountId) continue;
      const n = normalizeName(a.accountName ?? a.name);
      if (!n) continue;
      const cat = String(a.accountType ?? a.type ?? '').toLowerCase();
      const key = `${n}::${cat}`;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(a);
    }
    for (const [key, group] of byName) {
      if (group.length < 2) continue;
      const codes = new Set(group.map((g) => normalizeAccountCode(g.accountCode ?? g.code)));
      if (codes.size < 2) continue; // already covered as code duplicates
      const withActivity = group.filter((g) => usageOf(g.id).tl + usageOf(g.id).jel > 0);
      const canonical = group.find((g) => g.isSystem) ?? withActivity[0] ?? group[0];
      for (const a of group) {
        if (a.id === canonical.id) continue;
        const usage = usageOf(a.id);
        const cls = usage.tl + usage.jel === 0
          ? DuplicateClass.UNUSED_DUPLICATE
          : DuplicateClass.SEMANTIC_DUPLICATE;
        pushRow(a, cls, `name:${a.tenantId}:${key}`, canonical.id,
          'Same normalized name and category, different codes — review before consolidation');
      }
    }

    // 3. Salary family duplicates (known legacy codes)
    const canonicalSalary = list.find(
      (a) => normalizeAccountCode(a.accountCode ?? a.code) === CANONICAL_SALARY_ACCOUNT_CODE
    );
    for (const a of list) {
      const c = normalizeAccountCode(a.accountCode ?? a.code);
      if (LEGACY_SALARY_BUCKET_CODES.has(c)) {
        pushRow(a, DuplicateClass.CONFLICTING_SYSTEM_PURPOSE, `salary:${a.tenantId}`,
          canonicalSalary?.id ?? null, 'Known legacy salary duplicate code family (canonical 5200)');
      }
    }

    // 4. Duplicate system purposes
    const byPurpose = new Map();
    for (const a of list) {
      if (!a.systemPurpose || a.isActive === false) continue;
      if (!byPurpose.has(a.systemPurpose)) byPurpose.set(a.systemPurpose, []);
      byPurpose.get(a.systemPurpose).push(a);
    }
    for (const [purpose, group] of byPurpose) {
      if (group.length < 2) continue;
      const canonical = group.find((g) => g.isSystem) ?? group[0];
      for (const a of group) {
        if (a.id === canonical.id) continue;
        pushRow(a, DuplicateClass.CONFLICTING_SYSTEM_PURPOSE, `purpose:${a.tenantId}:${purpose}`,
          canonical.id, `Duplicate assignment of system purpose ${purpose}`);
      }
    }

    // 5. Parent-child duplicates (child repeats the parent's name)
    const byIdLocal = new Map(list.map((a) => [a.id, a]));
    for (const a of list) {
      if (!a.parentAccountId) continue;
      const parent = byIdLocal.get(a.parentAccountId);
      if (!parent) continue;
      if (normalizeName(a.accountName ?? a.name) === normalizeName(parent.accountName ?? parent.name)) {
        pushRow(a, DuplicateClass.PARENT_CHILD_DUPLICATE, `parentchild:${a.tenantId}:${parent.id}`,
          parent.id, 'Child repeats its parent name — likely rollup duplication');
      }
    }

    // 6. Merged (report-only) duplicates already handled by logical merge
    for (const a of list) {
      if (a.mergedIntoAccountId) {
        pushRow(a, DuplicateClass.REPORT_ONLY_DUPLICATION, `merged:${a.tenantId}:${a.mergedIntoAccountId}`,
          a.mergedIntoAccountId, 'Logical merge already redirects reporting; formalize as alias');
      }
    }
  }

  return rows;
}

/** CSV projection for artifacts/accounting-coa/duplicate-account-register.csv */
export function duplicateRegisterToCsv(rows) {
  const headers = [
    'tenantId', 'accountId', 'code', 'name', 'legacyType', 'v2Category', 'behaviour',
    'parentAccountId', 'systemPurpose', 'isActive', 'status', 'duplicateClass', 'groupKey',
    'journalLineCount', 'transactionLineCount', 'journalEntryLineCount',
    'totalDebitActivity', 'totalCreditActivity', 'proposedCanonicalAccountId',
    'proposedAction', 'historicalRepairRequired', 'approvalStatus', 'note',
  ];
  const escape = (v) => {
    let s = String(v ?? '');
    // Formula-injection guard for spreadsheet consumers
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}
