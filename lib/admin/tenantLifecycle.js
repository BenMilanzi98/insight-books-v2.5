/**
 * Explicit tenant lifecycle commands — no generic setTenantStatus.
 */

export const TENANT_STATUSES = [
  'DRAFT',
  'PENDING_VERIFICATION',
  'TRIAL',
  'ACTIVE',
  'PAYMENT_OVERDUE',
  'RESTRICTED',
  'SUSPENSION_PENDING',
  'SUSPENDED',
  'REACTIVATION_PENDING',
  'ARCHIVED',
  'CLOSED',
  'MANUAL_REVIEW',
  // legacy lowercase values still present in DB
  'active',
  'inactive',
  'suspended',
  'trial',
];

export const TENANT_COMMANDS = {
  ACTIVATE: 'ACTIVATE',
  SUSPEND: 'SUSPEND',
  REACTIVATE: 'REACTIVATE',
  ARCHIVE: 'ARCHIVE',
};

const TRANSITIONS = {
  ACTIVATE: {
    from: ['DRAFT', 'PENDING_VERIFICATION', 'TRIAL', 'inactive', 'trial'],
    to: 'ACTIVE',
  },
  SUSPEND: {
    from: ['ACTIVE', 'TRIAL', 'PAYMENT_OVERDUE', 'RESTRICTED', 'active', 'trial'],
    to: 'SUSPENDED',
  },
  REACTIVATE: {
    from: ['SUSPENDED', 'SUSPENSION_PENDING', 'suspended', 'inactive'],
    to: 'ACTIVE',
  },
  ARCHIVE: {
    from: [
      'SUSPENDED',
      'CLOSED',
      'ACTIVE',
      'inactive',
      'suspended',
      'active',
      'ARCHIVED',
    ],
    to: 'ARCHIVED',
  },
};

export function canTransition(command, currentStatus) {
  const rule = TRANSITIONS[command];
  if (!rule) return false;
  const status = String(currentStatus || '');
  return rule.from.includes(status);
}

export function targetStatus(command) {
  return TRANSITIONS[command]?.to || null;
}

export function validateLifecycleCommand({ command, reason, currentStatus }) {
  if (!TENANT_COMMANDS[command]) {
    return { ok: false, error: 'Unknown tenant command' };
  }
  if ((command === 'SUSPEND' || command === 'ARCHIVE') && !String(reason || '').trim()) {
    return { ok: false, error: 'Reason is required for this command' };
  }
  if (!canTransition(command, currentStatus)) {
    return {
      ok: false,
      error: `Cannot ${command} tenant from status ${currentStatus}`,
    };
  }
  return { ok: true, nextStatus: targetStatus(command) };
}
