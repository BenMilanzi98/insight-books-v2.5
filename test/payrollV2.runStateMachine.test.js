import { describe, expect, it } from 'vitest';
import { assertRunCommandAllowed } from '../lib/payrollV2/runStateMachine.js';
import { PAYROLL_RUN_STATUS } from '../lib/payrollV2/constants.js';

describe('payrollV2 run state machine', () => {
  it('allows draft → load → calculate → submit → approve → post → pay', () => {
    expect(assertRunCommandAllowed(PAYROLL_RUN_STATUS.DRAFT, 'load').nextStatus).toBe(
      PAYROLL_RUN_STATUS.LOADED
    );
    expect(assertRunCommandAllowed(PAYROLL_RUN_STATUS.LOADED, 'calculate').nextStatus).toBe(
      PAYROLL_RUN_STATUS.CALCULATED
    );
    expect(assertRunCommandAllowed(PAYROLL_RUN_STATUS.CALCULATED, 'submit').nextStatus).toBe(
      PAYROLL_RUN_STATUS.SUBMITTED
    );
    expect(assertRunCommandAllowed(PAYROLL_RUN_STATUS.SUBMITTED, 'approve').nextStatus).toBe(
      PAYROLL_RUN_STATUS.APPROVED
    );
    expect(assertRunCommandAllowed(PAYROLL_RUN_STATUS.APPROVED, 'post').nextStatus).toBe(
      PAYROLL_RUN_STATUS.POSTED
    );
    expect(assertRunCommandAllowed(PAYROLL_RUN_STATUS.POSTED, 'pay').nextStatus).toBe(
      PAYROLL_RUN_STATUS.PAID
    );
  });

  it('blocks recalculate when POSTED', () => {
    expect(() => assertRunCommandAllowed(PAYROLL_RUN_STATUS.POSTED, 'calculate')).toThrow(
      /Cannot recalculate/i
    );
  });

  it('blocks post from DRAFT', () => {
    expect(() => assertRunCommandAllowed(PAYROLL_RUN_STATUS.DRAFT, 'post')).toThrow(/not allowed/i);
  });
});
