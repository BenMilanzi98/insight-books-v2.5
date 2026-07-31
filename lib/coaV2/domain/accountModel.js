/**
 * CoA V2 — target account domain model validation (Phase 3 §6, §30, §31).
 *
 * Composes category, behaviour, hierarchy, code, currency, statement, and
 * purpose rules into the create/update workflows. Pure domain: the caller
 * (application/API layer) supplies the business account set and usage facts.
 */

import { validateClassification, forbiddenClassificationError, expectedNormalBalance } from './categories.js';
import { validateBehaviour, validateCurrencyPolicy, AccountLifecycleStatus } from './behaviours.js';
import { validateAccountCode } from './codeGovernance.js';
import { validateParentAssignment } from './hierarchy.js';
import { validateFinancialStatementMapping, defaultFinancialStatementSection } from './financialStatementMapping.js';
import { defaultCashFlowClassification, isCashFlowClassification } from './cashFlowClassification.js';
import { validateAccountForPurpose, isSystemAccountPurpose, ELEVATED_PURPOSES } from './systemPurposes.js';

/** Field-change classification for the update workflow (Phase 3 §31). */
export const FIELD_POLICY = Object.freeze({
  SAFE: ['description', 'displayOrder', 'metadata', 'accountName'],
  RESTRICTED: [
    'accountCode', 'category', 'subType', 'normalBalance', 'behaviour', 'parentAccountId',
    'currencyPolicy', 'specificCurrency', 'systemPurpose', 'controlAccountPurpose',
    'financialStatementSection', 'financialStatementSubsection', 'cashFlowClassification',
    'postingAllowed', 'manualPostingAllowed', 'consolidationGroup',
  ],
  IMMUTABLE_AFTER_HISTORY: ['tenantId', 'id'],
});

/** Classify which policy bucket each changed field falls into. */
export function classifyFieldChanges(changedFields) {
  const buckets = { safe: [], restricted: [], immutable: [], unknown: [] };
  for (const field of changedFields) {
    if (FIELD_POLICY.SAFE.includes(field)) buckets.safe.push(field);
    else if (FIELD_POLICY.RESTRICTED.includes(field)) buckets.restricted.push(field);
    else if (FIELD_POLICY.IMMUTABLE_AFTER_HISTORY.includes(field)) buckets.immutable.push(field);
    else buckets.unknown.push(field);
  }
  return buckets;
}

/**
 * Validate a complete account definition (create workflow, Phase 3 §30).
 *
 * @param {object} def the proposed account
 * @param {object} facts caller-supplied context facts
 * @param {object[]} facts.businessAccounts all accounts of the business (for code/parent checks)
 * @param {string[]} [facts.businessCurrencies]
 * @param {boolean} [facts.userHasElevatedPermission] may create protected system purposes
 * @param {string} facts.businessId
 * @returns {{ valid: boolean, errors: string[], warnings: string[], normalized: object }}
 */
export function validateAccountDefinition(def, facts) {
  const errors = [];
  const warnings = [];

  if (!facts?.businessId) {
    errors.push('Business scope is required');
    return { valid: false, errors, warnings, normalized: def };
  }
  if (def.tenantId && def.tenantId !== facts.businessId) {
    errors.push('Account business does not match the current business scope');
  }
  if (!def.accountName || String(def.accountName).trim().length < 2) {
    errors.push('Account name is required (minimum 2 characters)');
  }

  // Code: format + per-business uniqueness
  const codeResult = validateAccountCode({ code: def.accountCode, category: def.category });
  errors.push(...codeResult.errors);
  warnings.push(...codeResult.warnings);
  const normalizedCode = codeResult.normalized;
  if (normalizedCode) {
    const clash = (facts.businessAccounts ?? []).find(
      (a) => a.id !== def.id && (a.accountCode === normalizedCode || a.code === normalizedCode)
    );
    if (clash) errors.push(`Account code ${normalizedCode} is already used in this business`);
  }

  // Category / subtype / normal balance
  const classification = validateClassification({
    category: def.category,
    subType: def.subType ?? null,
    normalBalance: def.normalBalance ?? null,
  });
  errors.push(...classification.errors);
  const forbidden = forbiddenClassificationError({ category: def.category, subType: def.subType });
  if (forbidden) errors.push(forbidden);

  // Behaviour
  const behaviour = validateBehaviour({
    behaviour: def.behaviour,
    postingAllowed: def.postingAllowed,
    manualPostingAllowed: def.manualPostingAllowed,
    hasChildren: false,
    consolidationGroup: def.consolidationGroup ?? null,
  });
  errors.push(...behaviour.errors);

  // Parent
  const parent = validateParentAssignment({
    account: { id: def.id, tenantId: facts.businessId, category: def.category, behaviour: def.behaviour },
    parentAccountId: def.parentAccountId ?? null,
    businessAccounts: facts.businessAccounts ?? [],
    maxDepth: facts.maxDepth,
  });
  errors.push(...parent.errors);
  warnings.push(...parent.warnings);

  // Currency policy
  const currency = validateCurrencyPolicy({
    currencyPolicy: def.currencyPolicy,
    specificCurrency: def.specificCurrency ?? null,
    businessCurrencies: facts.businessCurrencies,
  });
  errors.push(...currency.errors);

  // Financial statement mapping (explicit or defaulted)
  const section = def.financialStatementSection ?? defaultFinancialStatementSection(def.category, def.subType ?? null);
  if (section) {
    const fs = validateFinancialStatementMapping({
      category: def.category,
      subType: def.subType ?? null,
      section,
      behaviour: def.behaviour,
    });
    errors.push(...fs.errors);
  } else if (def.category) {
    errors.push('Financial-statement section could not be determined for this account');
  }

  // Cash flow classification (explicit or defaulted)
  const cashFlow = def.cashFlowClassification ??
    defaultCashFlowClassification({ category: def.category, subType: def.subType ?? null, systemPurpose: def.systemPurpose ?? null });
  if (def.cashFlowClassification != null && !isCashFlowClassification(def.cashFlowClassification)) {
    errors.push(`Unknown cash-flow classification: ${String(def.cashFlowClassification)}`);
  }

  // System purpose
  if (def.systemPurpose != null) {
    if (!isSystemAccountPurpose(def.systemPurpose)) {
      errors.push(`Unknown system purpose: ${String(def.systemPurpose)}`);
    } else {
      if (ELEVATED_PURPOSES.includes(def.systemPurpose) && facts.userHasElevatedPermission !== true) {
        errors.push(`Creating or assigning the ${def.systemPurpose} purpose requires elevated permission`);
      }
      const purposeCheck = validateAccountForPurpose(def.systemPurpose, {
        tenantId: facts.businessId,
        category: def.category,
        subType: def.subType ?? null,
        behaviour: def.behaviour,
        normalBalance: def.normalBalance ?? expectedNormalBalance(def.category, def.subType ?? null),
        status: def.status ?? AccountLifecycleStatus.ACTIVE,
        isActive: def.isActive !== false,
        hasActiveChildren: false,
      }, { businessId: facts.businessId });
      errors.push(...purposeCheck.errors);
      warnings.push(...purposeCheck.warnings);
      const conflict = (facts.businessAccounts ?? []).find(
        (a) => a.id !== def.id && a.systemPurpose === def.systemPurpose &&
               a.status !== AccountLifecycleStatus.ARCHIVED && a.isActive !== false
      );
      if (conflict) {
        errors.push(`System purpose ${def.systemPurpose} is already assigned to account ${conflict.accountCode ?? conflict.id}`);
      }
    }
  }

  const normalized = {
    ...def,
    tenantId: facts.businessId,
    accountCode: normalizedCode,
    normalBalance: def.normalBalance ?? expectedNormalBalance(def.category, def.subType ?? null),
    financialStatementSection: section,
    cashFlowClassification: cashFlow,
    status: def.status ?? AccountLifecycleStatus.ACTIVE,
  };
  return { valid: errors.length === 0, errors, warnings, normalized };
}

/**
 * Validate a restricted update (Phase 3 §31). The caller supplies usage facts;
 * restricted changes on used accounts demand reason + permission.
 *
 * @param {object} params
 * @param {string[]} params.changedFields
 * @param {boolean} params.hasHistoricalActivity
 * @param {boolean} params.userHasElevatedPermission
 * @param {string|null} [params.reason]
 * @returns {{ allowed: boolean, requiresAudit: boolean, errors: string[], buckets: object }}
 */
export function validateAccountUpdatePolicy(params) {
  const errors = [];
  const buckets = classifyFieldChanges(params.changedFields);

  if (buckets.immutable.length > 0) {
    errors.push(`Fields cannot be changed: ${buckets.immutable.join(', ')}`);
  }
  if (buckets.unknown.length > 0) {
    errors.push(`Unknown fields: ${buckets.unknown.join(', ')}`);
  }
  const requiresAudit = buckets.restricted.length > 0;
  if (requiresAudit) {
    if (!params.reason || String(params.reason).trim().length < 5) {
      errors.push('Restricted account changes require a documented reason');
    }
    if (params.hasHistoricalActivity && params.userHasElevatedPermission !== true) {
      errors.push('Restricted changes on accounts with historical activity require elevated permission');
    }
  }
  return { allowed: errors.length === 0, requiresAudit, errors, buckets };
}
