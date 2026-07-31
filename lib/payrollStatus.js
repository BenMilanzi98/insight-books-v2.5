/**
 * Controlled payroll status transitions for the legacy per-employee Payroll row.
 * Posted/processed/paid/reversed must use dedicated process/reverse/payment commands —
 * never an arbitrary status string PATCH.
 */

export const PAYROLL_STATUSES = Object.freeze({
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PROCESSED: 'Processed',
  POSTED: 'Posted',
  PAID: 'Paid',
  REVERSED: 'Reversed',
});

const TERMINAL_FOR_STATUS_PATCH = new Set([
  PAYROLL_STATUSES.PROCESSED,
  PAYROLL_STATUSES.POSTED,
  PAYROLL_STATUSES.PAID,
  PAYROLL_STATUSES.REVERSED,
]);

/** Allowed (from → to) pairs for the status command API only. */
const STATUS_COMMAND_TRANSITIONS = Object.freeze({
  markDraft: new Map([
    [PAYROLL_STATUSES.PENDING, PAYROLL_STATUSES.DRAFT],
  ]),
  reopenDraft: new Map([
    [PAYROLL_STATUSES.DRAFT, PAYROLL_STATUSES.PENDING],
  ]),
});

export function normalizePayrollStatus(status) {
  if (status == null || status === '') return PAYROLL_STATUSES.PENDING;
  return String(status).trim();
}

export function isTerminalPayrollStatus(status) {
  return TERMINAL_FOR_STATUS_PATCH.has(normalizePayrollStatus(status));
}

/**
 * @param {{ from: string, to: string, command: 'markDraft'|'reopenDraft' }} args
 * @returns {true}
 */
export function assertPayrollStatusTransition({ from, to, command }) {
  const current = normalizePayrollStatus(from);
  const next = normalizePayrollStatus(to);

  if (isTerminalPayrollStatus(current)) {
    throw new Error(
      `Status change is not allowed from terminal status "${current}". Use reverse/payment commands instead.`
    );
  }

  const allowed = STATUS_COMMAND_TRANSITIONS[command];
  if (!allowed) {
    throw new Error(`Unknown status command "${command}"`);
  }

  const expected = allowed.get(current);
  if (!expected || expected !== next) {
    throw new Error(
      `Status transition ${current} → ${next} via ${command} is not allowed`
    );
  }

  return true;
}

/**
 * Resolve command from requested target status (legacy UI sends { status: 'Draft' }).
 */
export function resolveStatusCommand(toStatus) {
  const next = normalizePayrollStatus(toStatus);
  if (next === PAYROLL_STATUSES.DRAFT) return 'markDraft';
  if (next === PAYROLL_STATUSES.PENDING) return 'reopenDraft';
  return null;
}
