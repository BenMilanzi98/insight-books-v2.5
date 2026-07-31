/**
 * Accounting V2 — dimension policy framework.
 *
 * Declares which dimensions are required, optional, or prohibited per event type.
 * Final posting templates arrive in Phase 4; this framework and the initial policies
 * for well-understood events are established now.
 */

import { AccountingEventType } from './enums.js';
import { AccountingValidationError } from './errors.js';

export const Dimension = Object.freeze({
  BRANCH: 'branchId',
  DEPARTMENT: 'departmentId',
  PROJECT: 'projectId',
  COST_CENTRE: 'costCentreId',
  CUSTOMER: 'customerId',
  SUPPLIER: 'supplierId',
  EMPLOYEE: 'employeeId',
  OWNER: 'ownerId',
  SHAREHOLDER: 'shareholderId',
  BANK_ACCOUNT: 'bankAccountId',
  LOAN: 'loanId',
  ASSET: 'assetId',
  INVENTORY_LOCATION: 'inventoryLocationId',
  TAX_CODE: 'taxCodeId',
});

/**
 * @typedef {object} DimensionPolicy
 * @property {string[]} required
 * @property {string[]} prohibited
 * @property {string[]} requireOneOf groups where at least one member must be present
 */

/** @type {Record<string, DimensionPolicy>} */
const POLICIES = {
  [AccountingEventType.INVOICE_POSTED]: {
    required: [Dimension.CUSTOMER],
    prohibited: [Dimension.SUPPLIER],
    requireOneOf: [],
  },
  [AccountingEventType.CUSTOMER_PAYMENT_POSTED]: {
    required: [Dimension.CUSTOMER],
    prohibited: [Dimension.SUPPLIER],
    requireOneOf: [],
  },
  [AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED]: {
    required: [Dimension.CUSTOMER],
    prohibited: [Dimension.SUPPLIER],
    requireOneOf: [],
  },
  [AccountingEventType.CUSTOMER_REFUND_POSTED]: {
    required: [Dimension.CUSTOMER],
    prohibited: [Dimension.SUPPLIER],
    requireOneOf: [],
  },
  [AccountingEventType.SUPPLIER_BILL_POSTED]: {
    required: [Dimension.SUPPLIER],
    prohibited: [Dimension.CUSTOMER],
    requireOneOf: [],
  },
  [AccountingEventType.SUPPLIER_PAYMENT_POSTED]: {
    required: [Dimension.SUPPLIER],
    prohibited: [Dimension.CUSTOMER],
    requireOneOf: [],
  },
  [AccountingEventType.SUPPLIER_CREDIT_POSTED]: {
    required: [Dimension.SUPPLIER],
    prohibited: [Dimension.CUSTOMER],
    requireOneOf: [],
  },
  [AccountingEventType.PAYROLL_POSTED]: {
    required: [],
    prohibited: [Dimension.CUSTOMER, Dimension.SUPPLIER],
    requireOneOf: [],
  },
  [AccountingEventType.SALARY_ADVANCE_DISBURSED]: {
    required: [],
    prohibited: [Dimension.CUSTOMER, Dimension.SUPPLIER],
    requireOneOf: [],
  },
  [AccountingEventType.RENTAL_CUSTOMER_DEPOSIT]: {
    required: [],
    prohibited: [Dimension.SUPPLIER],
    requireOneOf: [],
  },
  [AccountingEventType.HIRE_SUPPLIER_DEPOSIT]: {
    required: [],
    prohibited: [Dimension.CUSTOMER],
    requireOneOf: [],
  },
  [AccountingEventType.HIRE_COST_ACCRUAL]: {
    required: [],
    prohibited: [Dimension.CUSTOMER],
    requireOneOf: [],
  },
  [AccountingEventType.HIRE_ACCRUAL_CLEARED]: {
    required: [],
    prohibited: [Dimension.CUSTOMER],
    requireOneOf: [],
  },
  [AccountingEventType.CAPITAL_CONTRIBUTION_POSTED]: {
    required: [],
    prohibited: [Dimension.CUSTOMER, Dimension.SUPPLIER],
    // Owner/shareholder recommended; not hard-required until equity UI supplies them.
    requireOneOf: [],
  },
  [AccountingEventType.OWNER_DRAWING_POSTED]: {
    required: [],
    prohibited: [Dimension.CUSTOMER, Dimension.SUPPLIER],
    requireOneOf: [],
  },
  [AccountingEventType.DIVIDEND_DECLARED]: {
    required: [],
    prohibited: [],
    requireOneOf: [],
  },
  [AccountingEventType.LOAN_RECEIVED]: {
    required: [],
    prohibited: [],
    requireOneOf: [],
  },
  [AccountingEventType.LOAN_REPAYMENT_POSTED]: {
    required: [],
    prohibited: [],
    requireOneOf: [],
  },
  [AccountingEventType.ASSET_ACQUIRED]: {
    required: [],
    prohibited: [],
    requireOneOf: [],
  },
  [AccountingEventType.DEPRECIATION_POSTED]: {
    required: [],
    prohibited: [],
    requireOneOf: [],
  },
  [AccountingEventType.ASSET_DISPOSED]: {
    required: [],
    prohibited: [],
    requireOneOf: [],
  },
};

/** Default for event types without a specific policy yet (Phase 4 completes the catalogue). */
const DEFAULT_POLICY = Object.freeze({ required: [], prohibited: [], requireOneOf: [] });

/** @param {string} eventType @returns {DimensionPolicy} */
export function getDimensionPolicy(eventType) {
  return POLICIES[eventType] ?? DEFAULT_POLICY;
}

/**
 * Validate an event's dimensions against its policy. Business is implicit
 * (carried by the accounting context, always required).
 * @param {string} eventType
 * @param {Record<string, string|null|undefined>} dimensions
 */
export function validateDimensions(eventType, dimensions = {}) {
  const policy = getDimensionPolicy(eventType);
  const issues = [];
  for (const dim of policy.required) {
    if (!dimensions[dim]) issues.push({ path: dim, message: `required for ${eventType}` });
  }
  for (const dim of policy.prohibited) {
    if (dimensions[dim]) issues.push({ path: dim, message: `prohibited for ${eventType}` });
  }
  for (const group of policy.requireOneOf) {
    if (!group.some((dim) => dimensions[dim])) {
      issues.push({ path: group.join('|'), message: `at least one required for ${eventType}` });
    }
  }
  if (issues.length > 0) {
    throw new AccountingValidationError(`Dimension policy violated for ${eventType}.`, issues);
  }
}
