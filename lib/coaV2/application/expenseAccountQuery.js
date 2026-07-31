/**
 * CoA V2 — expense-category account query service (Phase 3 §21).
 *
 * Returns ONLY valid expense posting accounts for the current business:
 * active, non-deprecated, posting-allowed, non-header, under the approved
 * Expenses hierarchy (5000) or classified EXPENSE/COST_OF_SALES, and not a
 * salary-conflicting duplicate. No name matching, ever.
 *
 * Inventory purchases, asset acquisitions, loan repayments, tax payments and
 * owner withdrawals are deliberately excluded — those flows resolve through
 * their own purposes in the mapping registry, not expense categories.
 */

import prisma from '../../prisma.js';
import { AccountCategory } from '../../accountingV2/domain/enums.js';
import { AccountLifecycleStatus, accountAcceptsNewPostings } from '../domain/behaviours.js';
import { codeNumericPrefix, APPROVED_CODE_ANCHORS } from '../domain/codeGovernance.js';
import { buildHierarchyIndex, getAncestors } from '../domain/hierarchy.js';
import { CANONICAL_SALARY_CODE, isConflictingSalaryAccount } from './salaryAccountEnforcement.js';

const EXPENSE_RANGE = { from: 5000, to: 5999 };
const COS_RANGE = { from: 6000, to: 6999 };

/**
 * @param {{businessId: string}} context
 * @param {object} [options]
 * @param {boolean} [options.includeCostOfSales] include COST_OF_SALES accounts (default false —
 *   ordinary expense forms exclude COGS; purchase flows opt in)
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<Array<{id: string, code: string, name: string, category: string|null, subType: string|null, path: string|null}>>}
 */
export async function getValidExpensePostingAccounts(context, options = {}, db = prisma) {
  const all = await db.account.findMany({
    where: { tenantId: context.businessId },
    select: {
      id: true, tenantId: true, accountCode: true, code: true, accountName: true, name: true,
      accountType: true, type: true, isActive: true, acceptsNewTransactions: true,
      parentAccountId: true, mergedIntoAccountId: true,
      coaV2Category: true, coaV2SubType: true, coaV2Behaviour: true, coaV2Status: true,
      postingAllowed: true, systemPurpose: true, hierarchyPath: true,
    },
  });
  const index = buildHierarchyIndex(all);
  const hasActiveChildren = new Set();
  for (const a of all) {
    if (a.parentAccountId && a.isActive !== false) hasActiveChildren.add(a.parentAccountId);
  }

  const results = [];
  for (const account of all) {
    if (account.tenantId !== context.businessId) continue; // defense in depth
    if (account.isActive === false) continue;
    if (account.acceptsNewTransactions === false) continue;
    if (account.mergedIntoAccountId) continue;
    if (account.coaV2Status === AccountLifecycleStatus.DEPRECATED) continue;
    if (account.coaV2Status === AccountLifecycleStatus.ARCHIVED) continue;
    if (account.coaV2Behaviour === 'HEADER' || account.coaV2Behaviour === 'CONTROL') continue;
    if (hasActiveChildren.has(account.id)) continue; // headers/parents by structure
    if (account.postingAllowed === false) continue;
    if (!accountAcceptsNewPostings({
      behaviour: account.coaV2Behaviour,
      status: account.coaV2Status,
      postingAllowed: account.postingAllowed,
      isActive: account.isActive,
    })) continue;

    // Category gate: V2 classification when present, otherwise approved code range + legacy type.
    const code = account.accountCode ?? account.code ?? '';
    const prefix = codeNumericPrefix(code);
    let eligible = false;
    if (account.coaV2Category) {
      eligible = account.coaV2Category === AccountCategory.EXPENSE ||
        (options.includeCostOfSales === true && account.coaV2Category === AccountCategory.COST_OF_SALES);
      if (account.coaV2Category === AccountCategory.COST_OF_SALES && options.includeCostOfSales !== true) {
        eligible = false;
      }
    } else {
      const legacyType = String(account.accountType ?? account.type ?? '').toLowerCase();
      const inExpenseRange = prefix != null &&
        ((prefix >= EXPENSE_RANGE.from && prefix <= EXPENSE_RANGE.to) ||
         (options.includeCostOfSales === true && prefix >= COS_RANGE.from && prefix <= COS_RANGE.to));
      eligible = legacyType === 'expense' && inExpenseRange;
      // COGS subtree (5100-5199) is excluded from ordinary expense selection.
      if (eligible && options.includeCostOfSales !== true && prefix >= 5100 && prefix <= 5199) {
        eligible = false;
      }
    }
    if (!eligible) continue;

    // Must sit under the approved Expenses hierarchy when hierarchy data exists.
    const ancestors = getAncestors(account.id, index);
    if (ancestors.length > 0) {
      const rootCode = ancestors[ancestors.length - 1].accountCode ?? ancestors[ancestors.length - 1].code;
      const underExpenses = rootCode === APPROVED_CODE_ANCHORS.EXPENSES_HEADER ||
        (codeNumericPrefix(rootCode) != null && codeNumericPrefix(rootCode) >= 5000 && codeNumericPrefix(rootCode) <= 6999);
      if (!underExpenses) continue;
    }

    // Salary duplicates: only canonical 5200 may appear as a salary-type expense.
    if (isConflictingSalaryAccount(account) && code !== CANONICAL_SALARY_CODE) continue;

    results.push({
      id: account.id,
      code,
      name: account.accountName ?? account.name ?? '',
      category: account.coaV2Category ?? null,
      subType: account.coaV2SubType ?? null,
      path: account.hierarchyPath ?? null,
    });
  }
  results.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  return results;
}
