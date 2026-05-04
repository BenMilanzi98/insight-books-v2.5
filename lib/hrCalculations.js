const MS_PER_DAY = 24 * 60 * 60 * 1000;

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function roundHrNumber(value) {
  return Math.round(safeNumber(value) * 100) / 100;
}

export function calculateAttendanceHours(clockIn, clockOut, standardHours = 8) {
  const start = clockIn instanceof Date ? clockIn : new Date(clockIn);
  const end = clockOut instanceof Date ? clockOut : new Date(clockOut);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Clock in and clock out must be valid dates');
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    throw new Error('Clock out cannot be before clock in');
  }

  const totalHours = roundHrNumber(diffMs / (1000 * 60 * 60));
  const regularLimit = Math.max(0, safeNumber(standardHours));
  const hoursWorked = roundHrNumber(Math.min(totalHours, regularLimit));
  const overtimeHours = roundHrNumber(Math.max(0, totalHours - regularLimit));

  return {
    totalHours,
    hoursWorked,
    overtimeHours,
  };
}

export function normalizeAttendanceStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'on leave' || value === 'leave') return 'leave';
  return value;
}

export function getAttendanceStatusVariants(status) {
  const normalized = normalizeAttendanceStatus(status);
  if (!normalized) return [];
  const title = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return [...new Set([normalized, title, normalized.toUpperCase()])];
}

export function isAttendanceStatus(status, expected) {
  return normalizeAttendanceStatus(status) === normalizeAttendanceStatus(expected);
}

export function normalizeLeaveStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'canceled') return 'cancelled';
  return value;
}

export function getLeaveStatusVariants(status) {
  const normalized = normalizeLeaveStatus(status);
  if (!normalized) return [];
  const title = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return [...new Set([normalized, title, normalized.toUpperCase()])];
}

export function getActiveLeaveStatusVariants() {
  return [...new Set([...getLeaveStatusVariants('pending'), ...getLeaveStatusVariants('approved')])];
}

export function isLeaveStatus(status, expected) {
  return normalizeLeaveStatus(status) === normalizeLeaveStatus(expected);
}

export function calculateLeaveDays(startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Start date and end date must be valid dates');
  }

  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  if (endUtc < startUtc) {
    throw new Error('End date cannot be before start date');
  }

  return Math.floor((endUtc - startUtc) / MS_PER_DAY) + 1;
}
