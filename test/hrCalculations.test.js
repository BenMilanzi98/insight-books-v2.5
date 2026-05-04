import { describe, expect, it } from 'vitest';
import {
  calculateAttendanceHours,
  calculateLeaveDays,
  getActiveLeaveStatusVariants,
  isAttendanceStatus,
  isLeaveStatus,
} from '../lib/hrCalculations.js';

describe('HR calculation helpers', () => {
  it('counts same-day leave as one day and multi-day leave inclusively', () => {
    expect(calculateLeaveDays(new Date('2026-05-04'), new Date('2026-05-04'))).toBe(1);
    expect(calculateLeaveDays(new Date('2026-05-04'), new Date('2026-05-06'))).toBe(3);
  });

  it('rejects leave date ranges where the end is before the start', () => {
    expect(() => calculateLeaveDays(new Date('2026-05-06'), new Date('2026-05-04'))).toThrow(
      'End date cannot be before start date',
    );
  });

  it('splits attendance into regular hours and overtime consistently', () => {
    const result = calculateAttendanceHours(
      new Date('2026-05-04T08:00:00'),
      new Date('2026-05-04T18:30:00'),
    );

    expect(result).toEqual({
      totalHours: 10.5,
      hoursWorked: 8,
      overtimeHours: 2.5,
    });
  });

  it('rejects clock-out times before clock-in times', () => {
    expect(() =>
      calculateAttendanceHours(new Date('2026-05-04T18:00:00'), new Date('2026-05-04T08:00:00')),
    ).toThrow('Clock out cannot be before clock in');
  });

  it('normalizes status casing for leave and attendance calculations', () => {
    expect(isLeaveStatus('Approved', 'approved')).toBe(true);
    expect(getActiveLeaveStatusVariants()).toContain('Approved');
    expect(isAttendanceStatus('late', 'Late')).toBe(true);
  });
});
