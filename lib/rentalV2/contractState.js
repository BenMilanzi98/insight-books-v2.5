export const CONTRACT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  DEPOSIT_PENDING: 'DEPOSIT_PENDING',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  ACTIVE: 'ACTIVE',
  RETURN_PENDING: 'RETURN_PENDING',
  RETURNED: 'RETURNED',
  INSPECTION_PENDING: 'INSPECTION_PENDING',
  FINAL_BILLING_PENDING: 'FINAL_BILLING_PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const TRANSITIONS = {
  submit: { from: [CONTRACT_STATUS.DRAFT], to: CONTRACT_STATUS.PENDING_APPROVAL },
  approve: {
    from: [CONTRACT_STATUS.PENDING_APPROVAL, CONTRACT_STATUS.DRAFT],
    to: CONTRACT_STATUS.APPROVED,
  },
  markDepositPending: {
    from: [CONTRACT_STATUS.APPROVED],
    to: CONTRACT_STATUS.DEPOSIT_PENDING,
  },
  readyForDispatch: {
    from: [CONTRACT_STATUS.APPROVED, CONTRACT_STATUS.DEPOSIT_PENDING],
    to: CONTRACT_STATUS.READY_FOR_DISPATCH,
  },
  activate: {
    from: [CONTRACT_STATUS.READY_FOR_DISPATCH, CONTRACT_STATUS.APPROVED],
    to: CONTRACT_STATUS.ACTIVE,
  },
  startReturn: {
    from: [CONTRACT_STATUS.ACTIVE],
    to: CONTRACT_STATUS.RETURN_PENDING,
  },
  markReturned: {
    from: [CONTRACT_STATUS.RETURN_PENDING, CONTRACT_STATUS.ACTIVE],
    to: CONTRACT_STATUS.RETURNED,
  },
  inspection: {
    from: [CONTRACT_STATUS.RETURNED],
    to: CONTRACT_STATUS.INSPECTION_PENDING,
  },
  finalBilling: {
    from: [CONTRACT_STATUS.INSPECTION_PENDING, CONTRACT_STATUS.RETURNED],
    to: CONTRACT_STATUS.FINAL_BILLING_PENDING,
  },
  complete: {
    from: [CONTRACT_STATUS.FINAL_BILLING_PENDING, CONTRACT_STATUS.RETURNED],
    to: CONTRACT_STATUS.COMPLETED,
  },
  cancel: {
    from: [
      CONTRACT_STATUS.DRAFT,
      CONTRACT_STATUS.PENDING_APPROVAL,
      CONTRACT_STATUS.APPROVED,
      CONTRACT_STATUS.DEPOSIT_PENDING,
    ],
    to: CONTRACT_STATUS.CANCELLED,
  },
};

export function assertContractCommand(status, command) {
  const rule = TRANSITIONS[String(command || '').toLowerCase()];
  if (!rule) throw new Error(`Unknown contract command "${command}"`);
  const current = String(status || CONTRACT_STATUS.DRAFT).toUpperCase();
  if (!rule.from.includes(current)) {
    throw new Error(`Command "${command}" not allowed from status "${current}"`);
  }
  return { nextStatus: rule.to };
}
