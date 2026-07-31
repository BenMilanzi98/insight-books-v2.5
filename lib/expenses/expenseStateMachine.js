/**
 * Expense approval / payment status transitions.
 * String values match existing Expense.status / paymentStatus DB values.
 */

export const EXPENSE_STATUSES = Object.freeze({
  DRAFT: 'Draft',
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVERSED: 'Reversed',
  /** Payment-status strings used on Expense.paymentStatus */
  PARTIALLY: 'Partially',
  FULLY_PAID: 'Fully paid',
});

/** Approval workflow statuses (Expense.status). */
export const EXPENSE_APPROVAL_STATUSES = Object.freeze([
  EXPENSE_STATUSES.DRAFT,
  EXPENSE_STATUSES.PENDING,
  EXPENSE_STATUSES.SUBMITTED,
  EXPENSE_STATUSES.IN_REVIEW,
  EXPENSE_STATUSES.APPROVED,
  EXPENSE_STATUSES.REJECTED,
  EXPENSE_STATUSES.REVERSED,
]);

/** Payment statuses (Expense.paymentStatus). */
export const EXPENSE_PAYMENT_STATUSES = Object.freeze([
  EXPENSE_STATUSES.PENDING,
  EXPENSE_STATUSES.PARTIALLY,
  EXPENSE_STATUSES.FULLY_PAID,
]);

const EDITABLE = new Set([
  EXPENSE_STATUSES.DRAFT,
  EXPENSE_STATUSES.PENDING,
  EXPENSE_STATUSES.REJECTED,
]);

const POSTABLE = new Set([EXPENSE_STATUSES.APPROVED]);

/**
 * Allowed Expense.status transitions (from → Set of to).
 * Same-status is always allowed (no-op).
 */
const TRANSITIONS = Object.freeze({
  [EXPENSE_STATUSES.DRAFT]: new Set([
    EXPENSE_STATUSES.PENDING,
    EXPENSE_STATUSES.SUBMITTED,
    EXPENSE_STATUSES.IN_REVIEW,
    EXPENSE_STATUSES.APPROVED, // create-and-post shortcut (permission-gated in API)
    EXPENSE_STATUSES.REJECTED,
  ]),
  [EXPENSE_STATUSES.PENDING]: new Set([
    EXPENSE_STATUSES.SUBMITTED,
    EXPENSE_STATUSES.IN_REVIEW,
    EXPENSE_STATUSES.APPROVED,
    EXPENSE_STATUSES.REJECTED,
    EXPENSE_STATUSES.DRAFT,
  ]),
  [EXPENSE_STATUSES.SUBMITTED]: new Set([
    EXPENSE_STATUSES.IN_REVIEW,
    EXPENSE_STATUSES.APPROVED,
    EXPENSE_STATUSES.REJECTED,
    EXPENSE_STATUSES.PENDING,
  ]),
  [EXPENSE_STATUSES.IN_REVIEW]: new Set([
    EXPENSE_STATUSES.APPROVED,
    EXPENSE_STATUSES.REJECTED,
    EXPENSE_STATUSES.SUBMITTED,
    EXPENSE_STATUSES.PENDING,
  ]),
  [EXPENSE_STATUSES.APPROVED]: new Set([EXPENSE_STATUSES.REVERSED]),
  [EXPENSE_STATUSES.REJECTED]: new Set([
    EXPENSE_STATUSES.DRAFT,
    EXPENSE_STATUSES.PENDING,
    EXPENSE_STATUSES.SUBMITTED,
  ]),
  [EXPENSE_STATUSES.REVERSED]: new Set([]),
});

/** PaymentStatus transitions (Pending → Partially → Fully paid). */
const PAYMENT_TRANSITIONS = Object.freeze({
  [EXPENSE_STATUSES.PENDING]: new Set([
    EXPENSE_STATUSES.PARTIALLY,
    EXPENSE_STATUSES.FULLY_PAID,
  ]),
  [EXPENSE_STATUSES.PARTIALLY]: new Set([EXPENSE_STATUSES.FULLY_PAID]),
  [EXPENSE_STATUSES.FULLY_PAID]: new Set([]),
});

function normalizeStatus(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  // Tolerate casing variants for "reversed"
  if (s.toLowerCase() === 'reversed') return EXPENSE_STATUSES.REVERSED;
  if (s.toLowerCase() === 'in review') return EXPENSE_STATUSES.IN_REVIEW;
  return s;
}

export function canEditDraft(status) {
  return EDITABLE.has(normalizeStatus(status));
}

export function canPost(status) {
  return POSTABLE.has(normalizeStatus(status));
}

export function canTransitionExpense(from, to) {
  const f = normalizeStatus(from);
  const t = normalizeStatus(to);
  if (!f || !t) return false;
  if (f === t) return true;
  const allowed = TRANSITIONS[f];
  if (allowed?.has(t)) return true;
  // Payment-status transitions when used as from/to
  if (PAYMENT_TRANSITIONS[f]?.has(t)) return true;
  return false;
}

/**
 * @param {string} from
 * @param {string} to
 * @throws {Error} with code EXPENSE_INVALID_TRANSITION
 */
export function assertExpenseTransition(from, to) {
  const f = normalizeStatus(from);
  const t = normalizeStatus(to);
  if (canTransitionExpense(f, t)) {
    return { from: f, to: t };
  }
  const err = new Error(`Invalid expense status transition: "${from}" → "${to}"`);
  err.code = 'EXPENSE_INVALID_TRANSITION';
  err.from = f;
  err.to = t;
  throw err;
}

/** Allowed statuses when creating a new expense (from implicit null). */
export function assertExpenseCreateStatus(to) {
  const t = normalizeStatus(to) || EXPENSE_STATUSES.DRAFT;
  const allowed = new Set([
    EXPENSE_STATUSES.DRAFT,
    EXPENSE_STATUSES.PENDING,
    EXPENSE_STATUSES.SUBMITTED,
    EXPENSE_STATUSES.APPROVED,
  ]);
  if (!allowed.has(t)) {
    const err = new Error(
      `Invalid create status "${to}". Use Draft, Pending, Submitted, or Approved.`
    );
    err.code = 'EXPENSE_INVALID_CREATE_STATUS';
    throw err;
  }
  return t;
}

export function assertPaymentStatusTransition(from, to) {
  const f = normalizeStatus(from) || EXPENSE_STATUSES.PENDING;
  const t = normalizeStatus(to);
  if (f === t) return { from: f, to: t };
  if (PAYMENT_TRANSITIONS[f]?.has(t)) return { from: f, to: t };
  const err = new Error(`Invalid payment status transition: "${from}" → "${to}"`);
  err.code = 'EXPENSE_INVALID_PAYMENT_TRANSITION';
  err.from = f;
  err.to = t;
  throw err;
}

export function normalizeExpenseStatus(value) {
  return normalizeStatus(value);
}
