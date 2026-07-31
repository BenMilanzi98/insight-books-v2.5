export const HIRE_REQUEST_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  CONVERTED: 'CONVERTED',
});

export const HIRE_AGREEMENT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const REQUEST_TRANSITIONS = {
  submit: { from: [HIRE_REQUEST_STATUS.DRAFT], to: HIRE_REQUEST_STATUS.SUBMITTED },
  approve: {
    from: [HIRE_REQUEST_STATUS.SUBMITTED, HIRE_REQUEST_STATUS.DRAFT],
    to: HIRE_REQUEST_STATUS.APPROVED,
  },
  cancel: {
    from: [HIRE_REQUEST_STATUS.DRAFT, HIRE_REQUEST_STATUS.SUBMITTED],
    to: HIRE_REQUEST_STATUS.CANCELLED,
  },
};

const AGREEMENT_TRANSITIONS = {
  approve: { from: [HIRE_AGREEMENT_STATUS.DRAFT], to: HIRE_AGREEMENT_STATUS.APPROVED },
  activate: {
    from: [HIRE_AGREEMENT_STATUS.APPROVED, HIRE_AGREEMENT_STATUS.DRAFT],
    to: HIRE_AGREEMENT_STATUS.ACTIVE,
  },
  complete: {
    from: [HIRE_AGREEMENT_STATUS.ACTIVE],
    to: HIRE_AGREEMENT_STATUS.COMPLETED,
  },
  cancel: {
    from: [HIRE_AGREEMENT_STATUS.DRAFT, HIRE_AGREEMENT_STATUS.APPROVED],
    to: HIRE_AGREEMENT_STATUS.CANCELLED,
  },
};

export function assertHireRequestCommand(status, command) {
  const rule = REQUEST_TRANSITIONS[String(command || '').toLowerCase()];
  if (!rule) throw new Error(`Unknown hire request command "${command}"`);
  const current = String(status || HIRE_REQUEST_STATUS.DRAFT).toUpperCase();
  if (!rule.from.includes(current)) {
    throw new Error(`Command "${command}" not allowed from status "${current}"`);
  }
  return { nextStatus: rule.to };
}

export function assertHireAgreementCommand(status, command) {
  const rule = AGREEMENT_TRANSITIONS[String(command || '').toLowerCase()];
  if (!rule) throw new Error(`Unknown hire agreement command "${command}"`);
  const current = String(status || HIRE_AGREEMENT_STATUS.DRAFT).toUpperCase();
  if (!rule.from.includes(current)) {
    throw new Error(`Command "${command}" not allowed from status "${current}"`);
  }
  return { nextStatus: rule.to };
}
