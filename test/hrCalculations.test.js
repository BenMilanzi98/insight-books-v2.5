import { describe, expect, it } from 'vitest';
import {
  calculateAttendanceHours,
  calculateLeaveDays,
  getActiveLeaveStatusVariants,
  isAttendanceStatus,
  isLeaveStatus,
} from '../lib/hrCalculations.js';

describe('HR calculation helpers', () => {
  it('counts weekday leave days and excludes weekends', () => {
    // Mon–Wed (no weekend)
    expect(calculateLeaveDays(new Date('2026-05-04'), new Date('2026-05-04'))).toBe(1);
    expect(calculateLeaveDays(new Date('2026-05-04'), new Date('2026-05-06'))).toBe(3);

    // Fri 21 Aug → Mon 24 Aug 2026: Fri + Mon = 2 (Sat/Sun excluded)
    expect(calculateLeaveDays(new Date('2026-08-21'), new Date('2026-08-24'))).toBe(2);

    // Sat–Sun only → 0 leave days
    expect(calculateLeaveDays(new Date('2026-08-22'), new Date('2026-08-23'))).toBe(0);
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
