/**
 * CoA V2 — versioned Chart of Accounts templates (Phase 3 §15–16).
 *
 * Templates are immutable after publication: updates require a new version.
 * The built-in definitions derive from the approved InsightBooks blueprint
 * (`chartOfAccountsBlueprint.js`) — no invented account structures. Business
 * types share the approved code standard; they differ in which accounts are
 * REQUIRED versus optional.
 *
 * Applying a template NEVER overwrites, reclassifies, or deletes existing
 * business accounts — it only adds approved missing accounts on request.
 */

import prisma from '../../prisma.js';
import { CHART_OF_ACCOUNTS_BLUEPRINT } from '../../chartOfAccountsBlueprint.js';
import { classifyBlueprintRow } from './blueprintClassification.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';
import { normalizeAccountCode } from '../domain/codeGovernance.js';

export const TemplateStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  RETIRED: 'RETIRED',
});

export const BusinessType = Object.freeze({
  GENERAL_SME: 'GENERAL_SME',
  RETAIL: 'RETAIL',
  SERVICE: 'SERVICE',
  SOLE_PROPRIETORSHIP: 'SOLE_PROPRIETORSHIP',
  PARTNERSHIP: 'PARTNERSHIP',
  LIMITED_COMPANY: 'LIMITED_COMPANY',
  CONSTRUCTION: 'CONSTRUCTION',
  PROPERTY_RENTAL: 'PROPERTY_RENTAL',
  NGO: 'NGO',
});

const REQUIRED_CORE = new Set([
  '1000', '1100', '1110', '1200', '2000', '2100', '2110',
  '3000', '3100', '3190', '3200', '3300', '4000', '4100', '5000', '5200',
]);
const RETAIL_EXTRA_REQUIRED = new Set(['1300', '1310', '5100', '5110']);
const SERVICE_OPTIONAL = new Set(['1300', '1310', '1320', '1330', '5110', '5120', '5130', '5140']);

function blueprintAccounts({ requiredSet, optionalSet = null }) {
  return CHART_OF_ACCOUNTS_BLUEPRINT.map((row, i) => {
    const classified = classifyBlueprintRow(row);
    return {
      ...classified,
      required: requiredSet.has(row.code),
      displayOrder: i,
      currencyPolicy: 'BASE_CURRENCY_ONLY',
      optionalForType: optionalSet ? optionalSet.has(row.code) : false,
    };
  });
}

/**
 * Built-in template catalogue (version 1). Derived from the approved blueprint;
 * the framework supports more business types by adding entries + versions.
 */
export const BUILT_IN_TEMPLATES = Object.freeze([
  {
    templateKey: 'GENERAL_SME',
    name: 'InsightBooks General SME',
    version: 1,
    businessType: BusinessType.GENERAL_SME,
    country: 'MW',
    description: 'Approved canonical blueprint (roots 1000–5000, COGS under 5100, salaries 5200).',
    status: TemplateStatus.PUBLISHED,
    baseCodeRanges: { assets: '1000-1999', liabilities: '2000-2999', equity: '3000-3999', revenue: '4000-4999', expenses: '5000-5999' },
    accounts: blueprintAccounts({ requiredSet: REQUIRED_CORE }),
  },
  {
    templateKey: 'RETAIL',
    name: 'InsightBooks Retail Business',
    version: 1,
    businessType: BusinessType.RETAIL,
    country: 'MW',
    description: 'Canonical blueprint with inventory and cost-of-sales accounts required.',
    status: TemplateStatus.PUBLISHED,
    baseCodeRanges: { assets: '1000-1999', liabilities: '2000-2999', equity: '3000-3999', revenue: '4000-4999', expenses: '5000-5999' },
    accounts: blueprintAccounts({ requiredSet: new Set([...REQUIRED_CORE, ...RETAIL_EXTRA_REQUIRED]) }),
  },
  {
    templateKey: 'SERVICE',
    name: 'InsightBooks Service Business',
    version: 1,
    businessType: BusinessType.SERVICE,
    country: 'MW',
    description: 'Canonical blueprint; service revenue (4150) required, inventory accounts optional.',
    status: TemplateStatus.PUBLISHED,
    baseCodeRanges: { assets: '1000-1999', liabilities: '2000-2999', equity: '3000-3999', revenue: '4000-4999', expenses: '5000-5999' },
    accounts: blueprintAccounts({
      requiredSet: new Set([...REQUIRED_CORE, '4150']),
      optionalSet: SERVICE_OPTIONAL,
    }),
  },
]);

/**
 * Persist the built-in templates into the versioned tables (idempotent;
 * existing published versions are never modified — immutability by contract).
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function ensureBuiltInTemplates(db = prisma) {
  const results = [];
  for (const def of BUILT_IN_TEMPLATES) {
    const existing = await db.coaV2Template.findUnique({
      where: { templateKey_version: { templateKey: def.templateKey, version: def.version } },
    });
    if (existing) {
      results.push({ templateKey: def.templateKey, version: def.version, created: false });
      continue;
    }
    const template = await db.coaV2Template.create({
      data: {
        templateKey: def.templateKey,
        name: def.name,
        version: def.version,
        businessType: def.businessType,
        country: def.country ?? null,
        description: def.description ?? null,
        status: def.status,
        baseCodeRanges: def.baseCodeRanges,
        publishedAt: def.status === TemplateStatus.PUBLISHED ? new Date() : null,
      },
    });
    for (const account of def.accounts) {
      await db.coaV2TemplateAccount.create({
        data: {
          templateId: template.id,
          code: account.code,
          name: account.name,
          description: account.description,
          parentCode: account.parentCode,
          category: account.category,
          subType: account.subType,
          behaviour: account.behaviour,
          normalBalance: account.normalBalance,
          systemPurpose: account.systemPurpose,
          controlAccountPurpose: account.controlAccountPurpose,
          financialStatementSection: account.financialStatementSection,
          cashFlowClassification: account.cashFlowClassification,
          currencyPolicy: account.currencyPolicy,
          required: account.required,
          displayOrder: account.displayOrder,
        },
      });
    }
    results.push({ templateKey: def.templateKey, version: def.version, created: true });
  }
  return results;
}

/**
 * Compare a business's accounts against a template version (Phase 3 §15):
 * missing / present / template-deprecated / business-custom. Read-only.
 *
 * @param {{businessId: string}} context
 * @param {{templateKey: string, version?: number}} ref
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function compareTemplateToBusiness(context, ref, db = prisma) {
  const def = BUILT_IN_TEMPLATES.find(
    (t) => t.templateKey === ref.templateKey && (ref.version == null || t.version === ref.version)
  );
  if (!def) {
    throw new AccountingValidationError(`Unknown template ${ref.templateKey} v${ref.version ?? 'latest'}`);
  }
  const businessAccounts = await db.account.findMany({
    where: { tenantId: context.businessId },
    select: { id: true, accountCode: true, code: true, accountName: true, name: true, isActive: true, coaV2Status: true },
  });
  const businessCodes = new Map();
  for (const a of businessAccounts) {
    const c = normalizeAccountCode(a.accountCode ?? a.code);
    if (c) businessCodes.set(c, a);
  }
  const templateCodes = new Set(def.accounts.map((a) => a.code));

  const missingRequired = [];
  const missingOptional = [];
  const present = [];
  for (const tplAccount of def.accounts) {
    const match = businessCodes.get(tplAccount.code);
    if (match) {
      present.push({ code: tplAccount.code, accountId: match.id, name: match.accountName ?? match.name });
    } else if (tplAccount.required) {
      missingRequired.push(tplAccount);
    } else {
      missingOptional.push(tplAccount);
    }
  }
  const businessCustom = businessAccounts
    .filter((a) => {
      const c = normalizeAccountCode(a.accountCode ?? a.code);
      return c && !templateCodes.has(c);
    })
    .map((a) => ({ accountId: a.id, code: normalizeAccountCode(a.accountCode ?? a.code), name: a.accountName ?? a.name }));

  return {
    templateKey: def.templateKey,
    version: def.version,
    counts: {
      templateAccounts: def.accounts.length,
      present: present.length,
      missingRequired: missingRequired.length,
      missingOptional: missingOptional.length,
      businessCustom: businessCustom.length,
    },
    missingRequired,
    missingOptional,
    present,
    businessCustom,
  };
}

/**
 * Apply SELECTED template additions to a business (Phase 3 §15 controlled process).
 * Creates only accounts whose codes are absent; never updates or deletes existing
 * rows; preserves business customizations. Caller authorizes + audits.
 *
 * @param {object} params
 * @param {object} params.db transaction client
 * @param {{businessId: string, userId?: string}} params.context
 * @param {{templateKey: string, version?: number}} params.ref
 * @param {string[]} params.codes template account codes to add
 */
export async function applyTemplateAdditions(params) {
  const { db, context, ref } = params;
  const comparison = await compareTemplateToBusiness(context, ref, db);
  const def = BUILT_IN_TEMPLATES.find(
    (t) => t.templateKey === comparison.templateKey && t.version === comparison.version
  );
  const addable = new Map(
    [...comparison.missingRequired, ...comparison.missingOptional].map((a) => [a.code, a])
  );
  const requested = (params.codes ?? []).map((c) => normalizeAccountCode(c));
  const invalid = requested.filter((c) => !addable.has(c));
  if (invalid.length > 0) {
    throw new AccountingValidationError(
      `Codes not addable from template (already present or unknown): ${invalid.join(', ')}`
    );
  }

  // Parent-first ordering: template rows are stored in blueprint order.
  const ordered = def.accounts.filter((a) => requested.includes(a.code));
  const created = [];
  for (const tpl of ordered) {
    let parentAccountId = null;
    if (tpl.parentCode) {
      const parent = await db.account.findFirst({
        where: {
          tenantId: context.businessId,
          OR: [{ accountCode: tpl.parentCode }, { code: tpl.parentCode }],
        },
        select: { id: true },
      });
      parentAccountId = parent?.id ?? null;
      if (!parentAccountId) {
        throw new AccountingValidationError(
          `Parent ${tpl.parentCode} for ${tpl.code} does not exist; include it in the additions first`
        );
      }
    }
    // Never create a duplicate system-purpose assignment (COA-002).
    let systemPurpose = tpl.systemPurpose;
    if (systemPurpose) {
      const purposeTaken = await db.account.findFirst({
        where: { tenantId: context.businessId, systemPurpose, isActive: true },
        select: { id: true },
      });
      if (purposeTaken) systemPurpose = null;
    }
    const account = await db.account.create({
      data: {
        tenantId: context.businessId,
        accountCode: tpl.code,
        code: tpl.code,
        accountName: tpl.name,
        name: tpl.name,
        description: tpl.description,
        accountType: legacyTypeFor(tpl.category),
        type: legacyTypeFor(tpl.category),
        accountSubtype: tpl.behaviour === 'HEADER' ? 'Group' : undefined,
        normalBalance: tpl.normalBalance === 'CREDIT' ? 'Credit' : 'Debit',
        parentAccountId,
        isActive: true,
        isSystem: true,
        acceptsNewTransactions: tpl.behaviour !== 'HEADER',
        coaV2Category: tpl.category,
        coaV2SubType: tpl.subType,
        coaV2Behaviour: tpl.behaviour,
        coaV2NormalBalance: tpl.normalBalance,
        coaV2Status: 'ACTIVE',
        postingAllowed: tpl.postingAllowed,
        manualPostingAllowed: tpl.manualPostingAllowed,
        systemPurpose,
        controlAccountPurpose: tpl.controlAccountPurpose,
        financialStatementSection: tpl.financialStatementSection,
        cashFlowClassification: tpl.cashFlowClassification,
        currencyPolicy: tpl.currencyPolicy,
        consolidationGroup: tpl.consolidationGroup,
        coaArchitectureVersion: 'TRANSITION_V2',
        coaV2UpdatedBy: context.userId ?? null,
      },
    });
    created.push({ id: account.id, code: tpl.code, name: tpl.name });
  }
  return { created, comparison };
}

function legacyTypeFor(category) {
  switch (category) {
    case 'ASSET': return 'Asset';
    case 'LIABILITY': return 'Liability';
    case 'EQUITY': return 'Equity';
    case 'REVENUE':
    case 'OTHER_INCOME': return 'Income';
    default: return 'Expense';
  }
}
