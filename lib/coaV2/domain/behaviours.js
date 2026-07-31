/**
 * CoA V2 — account behaviours, lifecycle status, and currency policy.
 *
 * Behaviour reuses the Phase 2 enum (`AccountBehaviour`); this module defines the
 * behavioural rules (who may receive postings, who may have children, what protection
 * applies) and the account lifecycle state machine. Pure domain logic.
 */

import { AccountBehaviour, isEnumValue } from '../../accountingV2/domain/enums.js';

export { AccountBehaviour };

/** Account lifecycle status (Phase 3 §18). */
export const AccountLifecycleStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  ARCHIVED: 'ARCHIVED',
});

/** Currency policy per account (Phase 3 §27). */
export const AccountCurrencyPolicy = Object.freeze({
  BASE_CURRENCY_ONLY: 'BASE_CURRENCY_ONLY',
  MULTI_CURRENCY: 'MULTI_CURRENCY',
  SPECIFIC_CURRENCY: 'SPECIFIC_CURRENCY',
});

/** Behavioural capability matrix. */
export const BEHAVIOUR_RULES = Object.freeze({
  [AccountBehaviour.HEADER]: {
    acceptsPostings: false,
    acceptsManualPostings: false,
    mayHaveChildren: true,
    balanceDerivedFromDescendants: true,
    deletable: false,
    description: 'Presentation-only parent; balance derived from descendants; never posted to.',
  },
  [AccountBehaviour.POSTING]: {
    acceptsPostings: true,
    acceptsManualPostings: true,
    mayHaveChildren: false, // unless explicitly configured (allowPostingWithChildren)
    balanceDerivedFromDescendants: false,
    deletable: true, // only when never referenced — enforced at service level
    description: 'Ordinary journal-line target; one category; valid normal balance.',
  },
  [AccountBehaviour.CONTROL]: {
    acceptsPostings: true, // operational postings carrying subledger dimensions
    acceptsManualPostings: false, // manual journals restricted / elevated permission
    mayHaveChildren: false,
    balanceDerivedFromDescendants: false,
    deletable: false,
    description: 'Subledger total (AR/AP). Manual journals restricted; dimensions required.',
  },
  [AccountBehaviour.SYSTEM]: {
    acceptsPostings: true, // according to purpose; engine-driven
    acceptsManualPostings: false,
    mayHaveChildren: false,
    balanceDerivedFromDescendants: false,
    deletable: false,
    description: 'Required by the accounting engine; cannot be deleted; changes audited.',
  },
  [AccountBehaviour.CONTRA]: {
    acceptsPostings: true,
    acceptsManualPostings: true,
    mayHaveChildren: false,
    balanceDerivedFromDescendants: false,
    deletable: true,
    description: 'Offsets a related account; opposing normal balance; must reference its group.',
  },
});

/** @param {string} behaviour */
export function behaviourAcceptsPostings(behaviour) {
  return BEHAVIOUR_RULES[behaviour]?.acceptsPostings === true;
}

/** @param {string} behaviour */
export function behaviourAcceptsManualPostings(behaviour) {
  return BEHAVIOUR_RULES[behaviour]?.acceptsManualPostings === true;
}

/** @param {string} behaviour */
export function behaviourIsProtected(behaviour) {
  return behaviour === AccountBehaviour.SYSTEM || behaviour === AccountBehaviour.CONTROL;
}

/**
 * Validate behaviour-related fields on an account definition.
 * @param {object} def
 * @param {string} def.behaviour
 * @param {boolean} [def.postingAllowed]
 * @param {boolean} [def.manualPostingAllowed]
 * @param {boolean} [def.hasChildren] whether the account currently has active children
 * @param {boolean} [def.allowPostingWithChildren] explicit legacy exception
 * @param {string|null} [def.consolidationGroup] required for CONTRA
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBehaviour(def) {
  const errors = [];
  if (!isEnumValue(AccountBehaviour, def.behaviour)) {
    errors.push(`Unknown account behaviour: ${String(def.behaviour)}`);
    return { valid: false, errors };
  }
  const rules = BEHAVIOUR_RULES[def.behaviour];

  if (def.postingAllowed === true && !rules.acceptsPostings) {
    errors.push(`${def.behaviour} accounts cannot allow postings`);
  }
  if (def.manualPostingAllowed === true && !rules.acceptsManualPostings) {
    errors.push(`${def.behaviour} accounts cannot allow manual postings`);
  }
  if (def.hasChildren === true && !rules.mayHaveChildren && def.allowPostingWithChildren !== true) {
    errors.push(`${def.behaviour} accounts cannot have active child accounts`);
  }
  if (def.behaviour === AccountBehaviour.HEADER && def.postingAllowed !== false && def.postingAllowed !== undefined) {
    errors.push('Header accounts must have postingAllowed=false');
  }
  if (def.behaviour === AccountBehaviour.CONTRA && !def.consolidationGroup) {
    errors.push('Contra accounts must reference their related account via consolidationGroup');
  }
  return { valid: errors.length === 0, errors };
}

/** Allowed lifecycle transitions (from → to). */
const LIFECYCLE_TRANSITIONS = Object.freeze({
  [AccountLifecycleStatus.ACTIVE]: [AccountLifecycleStatus.DEPRECATED, AccountLifecycleStatus.ARCHIVED],
  [AccountLifecycleStatus.DEPRECATED]: [AccountLifecycleStatus.ACTIVE, AccountLifecycleStatus.ARCHIVED],
  [AccountLifecycleStatus.ARCHIVED]: [AccountLifecycleStatus.ACTIVE],
});

/**
 * Validate a lifecycle transition.
 * @param {object} params
 * @param {string} params.from current status
 * @param {string} params.to requested status
 * @param {string} [params.behaviour]
 * @param {boolean} [params.isRequiredSystemAccount] mapped to an active system purpose
 * @param {boolean} [params.hasActivePostingReferences] historical journal/transaction lines
 * @param {string|null} [params.replacementAccountId]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLifecycleTransition(params) {
  const errors = [];
  if (!isEnumValue(AccountLifecycleStatus, params.from) || !isEnumValue(AccountLifecycleStatus, params.to)) {
    errors.push('Unknown lifecycle status');
    return { valid: false, errors };
  }
  if (params.from === params.to) {
    errors.push(`Account is already ${params.to}`);
  } else if (!LIFECYCLE_TRANSITIONS[params.from].includes(params.to)) {
    errors.push(`Cannot transition account from ${params.from} to ${params.to}`);
  }
  if (params.to !== AccountLifecycleStatus.ACTIVE && params.isRequiredSystemAccount) {
    errors.push('Account is mapped to an active system purpose; remap the purpose before deprecating or archiving');
  }
  if (params.to === AccountLifecycleStatus.DEPRECATED && params.hasActivePostingReferences && !params.replacementAccountId) {
    errors.push('Deprecating an account with historical activity requires a replacement account');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Whether an account may receive a NEW posting, combining behaviour + lifecycle.
 * Deprecated and archived accounts never accept new postings (Phase 3 §18).
 * @param {{behaviour?: string|null, status?: string|null, postingAllowed?: boolean|null, isActive?: boolean}} account
 */
export function accountAcceptsNewPostings(account) {
  if (account.status === AccountLifecycleStatus.DEPRECATED) return false;
  if (account.status === AccountLifecycleStatus.ARCHIVED) return false;
  if (account.isActive === false) return false;
  if (account.postingAllowed === false) return false;
  if (account.behaviour && !behaviourAcceptsPostings(account.behaviour)) return false;
  return true;
}

/**
 * Validate an account's currency policy fields.
 * @param {object} def
 * @param {string} [def.currencyPolicy]
 * @param {string|null} [def.specificCurrency]
 * @param {string[]} [def.businessCurrencies] currencies configured for the business
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCurrencyPolicy(def) {
  const errors = [];
  if (def.currencyPolicy == null) return { valid: true, errors };
  if (!isEnumValue(AccountCurrencyPolicy, def.currencyPolicy)) {
    errors.push(`Unknown currency policy: ${String(def.currencyPolicy)}`);
    return { valid: false, errors };
  }
  if (def.currencyPolicy === AccountCurrencyPolicy.SPECIFIC_CURRENCY) {
    if (!def.specificCurrency || !/^[A-Z]{3}$/.test(def.specificCurrency)) {
      errors.push('SPECIFIC_CURRENCY accounts require a valid ISO-4217 specificCurrency');
    } else if (Array.isArray(def.businessCurrencies) && def.businessCurrencies.length > 0 &&
               !def.businessCurrencies.includes(def.specificCurrency)) {
      errors.push(`Currency ${def.specificCurrency} is not configured for this business`);
    }
  } else if (def.specificCurrency) {
    errors.push('specificCurrency is only valid with the SPECIFIC_CURRENCY policy');
  }
  return { valid: errors.length === 0, errors };
}
