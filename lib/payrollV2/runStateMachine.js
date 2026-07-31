import {
  PAYROLL_RUN_STATUS,
  RUN_TRANSITIONS,
  TERMINAL_RUN_STATUSES,
} from './constants.js';

export function normalizeRunStatus(status) {
  return String(status || PAYROLL_RUN_STATUS.DRAFT).trim().toUpperCase();
}

export function isTerminalRunStatus(status) {
  return TERMINAL_RUN_STATUSES.has(normalizeRunStatus(status));
}

export function assertRunCommandAllowed(status, command) {
  const current = normalizeRunStatus(status);
  const cmd = String(command || '').toLowerCase();

  if (cmd === 'create') return { ok: true, nextStatus: PAYROLL_RUN_STATUS.DRAFT };

  if (cmd === 'replace') {
    if (current !== PAYROLL_RUN_STATUS.REVERSED) {
      throw new Error('Replace is only allowed from a REVERSED run');
    }
    return { ok: true, nextStatus: PAYROLL_RUN_STATUS.DRAFT };
  }

  if (cmd === 'calculate' && current === PAYROLL_RUN_STATUS.POSTED) {
    throw new Error('Cannot recalculate a POSTED payroll run');
  }

  const rule = RUN_TRANSITIONS[cmd];
  if (!rule) {
    throw new Error(`Unknown payroll run command "${command}"`);
  }

  if (!rule.from.includes(current)) {
    throw new Error(
      `Command "${cmd}" is not allowed from status "${current}". Allowed from: ${rule.from.join(', ')}`
    );
  }

  return {
    ok: true,
    nextStatus: rule.to == null ? current : rule.to,
  };
}
