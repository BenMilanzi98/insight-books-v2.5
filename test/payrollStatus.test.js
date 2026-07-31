import { describe, expect, it } from 'vitest';
import {
  PAYROLL_STATUSES,
  assertPayrollStatusTransition,
  isTerminalPayrollStatus,
  resolveStatusCommand,
} from '../lib/payrollStatus.js';

describe('payrollStatus', () => {
  it('blocks arbitrary transition to Processed via status command', () => {
    expect(() =>
      assertPayrollStatusTransition({
        from: PAYROLL_STATUSES.PENDING,
        to: PAYROLL_STATUSES.PROCESSED,
        command: 'markDraft',
      })
    ).toThrow(/not allowed/i);
  });

  it('blocks any transition out of Reversed', () => {
    expect(() =>
      assertPayrollStatusTransition({
        from: PAYROLL_STATUSES.REVERSED,
        to: PAYROLL_STATUSES.DRAFT,
        command: 'markDraft',
      })
    ).toThrow(/terminal|reversed/i);
  });

  it('allows Pending → Draft via markDraft', () => {
    expect(
      assertPayrollStatusTransition({
        from: PAYROLL_STATUSES.PENDING,
        to: PAYROLL_STATUSES.DRAFT,
        command: 'markDraft',
      })
    ).toBe(true);
  });

  it('allows Draft → Pending via reopenDraft', () => {
    expect(
      assertPayrollStatusTransition({
        from: PAYROLL_STATUSES.DRAFT,
        to: PAYROLL_STATUSES.PENDING,
        command: 'reopenDraft',
      })
    ).toBe(true);
  });

  it('treats Processed, Posted, Paid, Reversed as terminal for status PATCH', () => {
    expect(isTerminalPayrollStatus(PAYROLL_STATUSES.PROCESSED)).toBe(true);
    expect(isTerminalPayrollStatus(PAYROLL_STATUSES.POSTED)).toBe(true);
    expect(isTerminalPayrollStatus(PAYROLL_STATUSES.PAID)).toBe(true);
    expect(isTerminalPayrollStatus(PAYROLL_STATUSES.REVERSED)).toBe(true);
    expect(isTerminalPayrollStatus(PAYROLL_STATUSES.PENDING)).toBe(false);
  });

  it('resolveStatusCommand rejects escalation targets (Processed/Posted/Paid/Reversed)', () => {
    expect(resolveStatusCommand(PAYROLL_STATUSES.DRAFT)).toBe('markDraft');
    expect(resolveStatusCommand(PAYROLL_STATUSES.PENDING)).toBe('reopenDraft');
    expect(resolveStatusCommand(PAYROLL_STATUSES.PROCESSED)).toBeNull();
    expect(resolveStatusCommand(PAYROLL_STATUSES.POSTED)).toBeNull();
    expect(resolveStatusCommand(PAYROLL_STATUSES.PAID)).toBeNull();
    expect(resolveStatusCommand(PAYROLL_STATUSES.REVERSED)).toBeNull();
    expect(resolveStatusCommand('Processed')).toBeNull();
  });
});
