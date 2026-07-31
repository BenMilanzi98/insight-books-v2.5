import { ATTENDANCE_APPROVAL } from './constants.js';

/**
 * Sync minute fields from float hours when minutes not set.
 */
export function syncAttendanceMinutes(record) {
  const hours = Number(record.hoursWorked || 0);
  const ot = Number(record.overtimeHours || 0);
  return {
    minutesWorked:
      record.minutesWorked > 0 ? record.minutesWorked : Math.round(hours * 60),
    overtimeMinutes:
      record.overtimeMinutes > 0 ? record.overtimeMinutes : Math.round(ot * 60),
  };
}

export function assertAttendanceApprovable(record) {
  if (record.payrollLocked) {
    throw new Error('Attendance is locked for payroll and cannot be changed');
  }
}

export function approvalPayload(userId, { overtime = false } = {}) {
  const now = new Date();
  if (overtime) {
    return {
      overtimeApprovalStatus: ATTENDANCE_APPROVAL.APPROVED,
      overtimeApprovedAt: now,
      overtimeApprovedById: userId || null,
      ...syncAttendanceMinutes({ hoursWorked: 0, overtimeHours: 0, minutesWorked: 0, overtimeMinutes: 0 }),
    };
  }
  return {
    approvalStatus: ATTENDANCE_APPROVAL.APPROVED,
    approvedAt: now,
    approvedById: userId || null,
  };
}
