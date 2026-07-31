/**
 * CoA V2 — Stage-2 classification backfill (Phase 3 §36).
 *
 * Populates ONLY the new nullable V2 columns on `Account`:
 *  - blueprint-matching codes get the full proven classification;
 *  - non-blueprint accounts get category/normal-balance ONLY where the legacy
 *    `type` value is unambiguous; everything else stays NULL for manual review.
 *
 * Never changes: legacy columns, balances, journals, hierarchy, active flags.
 * Rerunnable: rows already carrying a coaV2Category are skipped unless --force.
 */

import prisma from '../../prisma.js';
import { CHART_OF_ACCOUNTS_BLUEPRINT } from '../../chartOfAccountsBlueprint.js';
import { classifyBlueprintRow } from '../templates/blueprintClassification.js';
import { categoryFromLegacyType, expectedNormalBalance, AccountSubType } from '../domain/categories.js';
import { defaultFinancialStatementSection } from '../domain/financialStatementMapping.js';
import { defaultCashFlowClassification } from '../domain/cashFlowClassification.js';
import { normalizeAccountCode, codeNumericPrefix } from '../domain/codeGovernance.js';
import { AccountCategory, AccountBehaviour } from '../../accountingV2/domain/enums.js';
import { buildHierarchyIndex, getDepth, getHierarchyPath } from '../domain/hierarchy.js';

const BLUEPRINT_BY_CODE = new Map(
  CHART_OF_ACCOUNTS_BLUEPRINT.map((row) => [row.code, classifyBlueprintRow(row)])
);

/**
 * Compute the Stage-2 classification for one account (pure decision function).
 * @returns {{classification: object|null, source: string}} null = leave for manual review
 */
export function classifyExistingAccount(account, { hasActiveChildren }) {
  const code = normalizeAccountCode(account.accountCode ?? account.code);
  const blueprint = code ? BLUEPRINT_BY_CODE.get(code) : null;

  if (blueprint) {
    // Proven: the code matches the canonical blueprint. Respect structural reality:
    // an account with children is a header regardless of blueprint leaf status.
    const behaviour = hasActiveChildren && blueprint.behaviour === AccountBehaviour.POSTING
      ? AccountBehaviour.HEADER
      : blueprint.behaviour;
    return {
      source: 'BLUEPRINT',
      classification: {
        coaV2Category: blueprint.category,
        coaV2SubType: blueprint.subType,
        coaV2Behaviour: behaviour,
        coaV2NormalBalance: blueprint.normalBalance,
        postingAllowed: behaviour !== AccountBehaviour.HEADER && account.acceptsNewTransactions !== false,
        manualPostingAllowed: behaviour === AccountBehaviour.POSTING || behaviour === AccountBehaviour.CONTRA,
        financialStatementSection: blueprint.financialStatementSection,
        cashFlowClassification: blueprint.cashFlowClassification,
        systemPurpose: blueprint.systemPurpose,
        controlAccountPurpose: blueprint.controlAccountPurpose,
        consolidationGroup: blueprint.consolidationGroup,
      },
    };
  }

  // Non-blueprint: classify only what the legacy type proves.
  const category = categoryFromLegacyType(account.accountType ?? account.type);
  if (!category) return { source: 'MANUAL_REVIEW', classification: null };

  // Bank/mobile child codes (NNNN-NN) and structural parents
  const behaviour = hasActiveChildren ? AccountBehaviour.HEADER : AccountBehaviour.POSTING;
  const prefix = codeNumericPrefix(code);
  let refinedCategory = category;
  if (category === AccountCategory.EXPENSE && prefix != null && prefix >= 5100 && prefix <= 5199) {
    refinedCategory = AccountCategory.COST_OF_SALES;
  }
  const legacyNb = String(account.normalBalance ?? '').toLowerCase();
  const normalBalance = legacyNb === 'credit' ? 'CREDIT' : legacyNb === 'debit' ? 'DEBIT'
    : expectedNormalBalance(refinedCategory, null);
  // Legacy explicit normal balance that contradicts the category → manual review
  if (normalBalance !== expectedNormalBalance(refinedCategory, null)) {
    const contraSubType = contraSubTypeFor(refinedCategory);
    if (!contraSubType) return { source: 'MANUAL_REVIEW', classification: null };
    return {
      source: 'LEGACY_TYPE_CONTRA',
      classification: {
        coaV2Category: refinedCategory,
        coaV2SubType: contraSubType,
        coaV2Behaviour: AccountBehaviour.CONTRA,
        coaV2NormalBalance: normalBalance,
        postingAllowed: behaviour !== AccountBehaviour.HEADER && account.acceptsNewTransactions !== false,
        manualPostingAllowed: true,
        financialStatementSection: defaultFinancialStatementSection(refinedCategory, contraSubTypeFor(refinedCategory)),
        cashFlowClassification: defaultCashFlowClassification({ category: refinedCategory, subType: contraSubTypeFor(refinedCategory) }),
        systemPurpose: null,
        controlAccountPurpose: null,
        consolidationGroup: null,
      },
    };
  }

  return {
    source: 'LEGACY_TYPE',
    classification: {
      coaV2Category: refinedCategory,
      coaV2SubType: null, // subtype needs human judgement for custom accounts
      coaV2Behaviour: behaviour,
      coaV2NormalBalance: normalBalance,
      postingAllowed: behaviour !== AccountBehaviour.HEADER && account.acceptsNewTransactions !== false,
      manualPostingAllowed: behaviour === AccountBehaviour.POSTING,
      financialStatementSection: defaultFinancialStatementSection(refinedCategory, null),
      cashFlowClassification: defaultCashFlowClassification({ category: refinedCategory, subType: null }),
      systemPurpose: null, // purposes are assigned only through the governed registry
      controlAccountPurpose: null,
      consolidationGroup: null,
    },
  };
}

function contraSubTypeFor(category) {
  switch (category) {
    case AccountCategory.ASSET: return AccountSubType.CONTRA_ASSET;
    case AccountCategory.LIABILITY: return AccountSubType.CONTRA_LIABILITY;
    case AccountCategory.REVENUE: return AccountSubType.CONTRA_REVENUE;
    case AccountCategory.COST_OF_SALES: return AccountSubType.CONTRA_COST_OF_SALES;
    case AccountCategory.EXPENSE: return AccountSubType.CONTRA_EXPENSE;
    default: return null;
  }
}

/**
 * Run the backfill.
 * @param {object} options
 * @param {boolean} [options.apply] false = dry run (default)
 * @param {boolean} [options.force] reclassify rows that already have coaV2Category
 * @param {string|null} [options.tenantId]
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function runClassificationBackfill(options = {}, db = prisma) {
  const accounts = await db.account.findMany({
    where: { ...(options.tenantId ? { tenantId: options.tenantId } : {}) },
    select: {
      id: true, tenantId: true, accountCode: true, code: true, accountName: true, name: true,
      accountType: true, type: true, normalBalance: true, parentAccountId: true,
      isActive: true, acceptsNewTransactions: true, coaV2Category: true,
      systemPurpose: true,
    },
  });

  const byTenant = new Map();
  for (const a of accounts) {
    const key = a.tenantId ?? '__NULL__';
    if (!byTenant.has(key)) byTenant.set(key, []);
    byTenant.get(key).push(a);
  }

  const summary = { scanned: accounts.length, classified: 0, blueprint: 0, legacyType: 0, manualReview: 0, skipped: 0, purposesAssigned: 0, updated: 0 };
  const manualReviewRows = [];

  for (const [tenantKey, list] of byTenant) {
    const index = buildHierarchyIndex(list);
    const activeChildren = new Set(
      list.filter((a) => a.parentAccountId && a.isActive !== false).map((a) => a.parentAccountId)
    );
    const purposesAssigned = new Set(
      list.filter((a) => a.systemPurpose && a.isActive !== false).map((a) => a.systemPurpose)
    );

    for (const account of list) {
      if (account.coaV2Category && !options.force) { summary.skipped += 1; continue; }
      const { classification, source } = classifyExistingAccount(account, {
        hasActiveChildren: activeChildren.has(account.id),
      });
      if (!classification) {
        summary.manualReview += 1;
        manualReviewRows.push({
          tenantId: account.tenantId,
          accountId: account.id,
          code: account.accountCode ?? account.code ?? '',
          name: account.accountName ?? account.name ?? '',
          legacyType: account.accountType ?? account.type ?? '',
          reason: 'Legacy type/normal balance ambiguous — classify manually',
        });
        continue;
      }
      // One purpose per business: first blueprint holder wins, duplicates go to review.
      let systemPurpose = classification.systemPurpose;
      if (systemPurpose) {
        if (purposesAssigned.has(systemPurpose) && account.systemPurpose !== systemPurpose) {
          systemPurpose = null;
        } else {
          purposesAssigned.add(systemPurpose);
          summary.purposesAssigned += 1;
        }
      }
      summary.classified += 1;
      if (source === 'BLUEPRINT') summary.blueprint += 1; else summary.legacyType += 1;

      if (options.apply) {
        await db.account.update({
          where: { id: account.id },
          data: {
            ...classification,
            systemPurpose,
            coaV2Status: account.isActive === false ? 'ARCHIVED' : 'ACTIVE',
            coaDepth: getDepth(account.id, index),
            hierarchyPath: getHierarchyPath(account.id, index),
            coaArchitectureVersion: 'TRANSITION_V2',
          },
        });
        summary.updated += 1;
      }
    }
  }

  return { summary, manualReviewRows };
}
