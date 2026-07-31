/** Payroll V2 run statuses and commands. */

export const PAYROLL_RUN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  LOADED: 'LOADED',
  CALCULATED: 'CALCULATED',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  PAID: 'PAID',
  REVERSED: 'REVERSED',
});

export const PAYROLL_RUN_COMMANDS = Object.freeze({
  CREATE: 'create',
  LOAD: 'load',
  VALIDATE: 'validate',
  CALCULATE: 'calculate',
  SUBMIT: 'submit',
  APPROVE: 'approve',
  POST: 'post',
  PAY: 'pay',
  REVERSE: 'reverse',
  REPLACE: 'replace',
});

export const ATTENDANCE_APPROVAL = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const COMPONENT_CATEGORY = Object.freeze({
  EARNING: 'EARNING',
  DEDUCTION: 'DEDUCTION',
  EMPLOYER: 'EMPLOYER',
  INFO: 'INFO',
});

/** Allowed status transitions for run commands. */
export const RUN_TRANSITIONS = Object.freeze({
  load: {
    from: [PAYROLL_RUN_STATUS.DRAFT, PAYROLL_RUN_STATUS.LOADED, PAYROLL_RUN_STATUS.CALCULATED],
    to: PAYROLL_RUN_STATUS.LOADED,
  },
  validate: {
    from: [PAYROLL_RUN_STATUS.LOADED, PAYROLL_RUN_STATUS.CALCULATED],
    to: null, // status unchanged
  },
  calculate: {
    from: [
      PAYROLL_RUN_STATUS.LOADED,
      PAYROLL_RUN_STATUS.CALCULATED,
      PAYROLL_RUN_STATUS.SUBMITTED,
    ],
    to: PAYROLL_RUN_STATUS.CALCULATED,
  },
  submit: {
    from: [PAYROLL_RUN_STATUS.CALCULATED],
    to: PAYROLL_RUN_STATUS.SUBMITTED,
  },
  approve: {
    from: [PAYROLL_RUN_STATUS.SUBMITTED],
    to: PAYROLL_RUN_STATUS.APPROVED,
  },
  post: {
    from: [PAYROLL_RUN_STATUS.APPROVED],
    to: PAYROLL_RUN_STATUS.POSTED,
  },
  pay: {
    from: [PAYROLL_RUN_STATUS.POSTED],
    to: PAYROLL_RUN_STATUS.PAID,
  },
  reverse: {
    from: [PAYROLL_RUN_STATUS.POSTED, PAYROLL_RUN_STATUS.PAID],
    to: PAYROLL_RUN_STATUS.REVERSED,
  },
});

export const TERMINAL_RUN_STATUSES = new Set([
  PAYROLL_RUN_STATUS.POSTED,
  PAYROLL_RUN_STATUS.PAID,
  PAYROLL_RUN_STATUS.REVERSED,
]);
