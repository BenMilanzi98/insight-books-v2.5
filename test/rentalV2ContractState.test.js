import { describe, expect, it } from 'vitest';
import {
  assertContractCommand,
  CONTRACT_STATUS,
} from '../lib/rentalV2/contractState.js';
import { remainingDeposit, assertDepositNotOverApplied } from '../lib/rentalV2/depositAccounting.js';
import { billingPeriodKey, billingIdempotencyKey } from '../lib/rentalV2/billing.js';
import { priceRentalLine } from '../lib/rentalV2/pricing.js';
import {
  assertHireRequestCommand,
  assertHireAgreementCommand,
  HIRE_REQUEST_STATUS,
} from '../lib/hiringV2/hireState.js';

describe('rentalV2 contractState', () => {
  it('allows approve from draft', () => {
    expect(assertContractCommand(CONTRACT_STATUS.DRAFT, 'approve').nextStatus).toBe(
      CONTRACT_STATUS.APPROVED
    );
  });

  it('rejects dispatch activate from draft', () => {
    expect(() => assertContractCommand(CONTRACT_STATUS.DRAFT, 'activate')).toThrow(/not allowed/);
  });

  it('cancels only pre-active statuses', () => {
    expect(assertContractCommand(CONTRACT_STATUS.APPROVED, 'cancel').nextStatus).toBe(
      CONTRACT_STATUS.CANCELLED
    );
    expect(() => assertContractCommand(CONTRACT_STATUS.ACTIVE, 'cancel')).toThrow();
  });
});

describe('rentalV2 deposit remaining', () => {
  it('computes remaining after apply/refund/forfeit', () => {
    expect(
      remainingDeposit({
        receivedAmount: 1000,
        appliedAmount: 200,
        refundedAmount: 100,
        forfeitedAmount: 50,
      })
    ).toBe(650);
  });

  it('blocks over-apply', () => {
    expect(() =>
      assertDepositNotOverApplied(
        { receivedAmount: 100, appliedAmount: 80, refundedAmount: 0, forfeitedAmount: 0 },
        30
      )
    ).toThrow(/Cannot apply/);
  });
});

describe('rentalV2 billing uniqueness keys', () => {
  it('stable period key', () => {
    const start = '2026-01-01T00:00:00.000Z';
    const end = '2026-01-31T00:00:00.000Z';
    const a = billingPeriodKey({
      tenantId: 't1',
      contractId: 'c1',
      periodStart: start,
      periodEnd: end,
      pricingVersion: 1,
    });
    const b = billingPeriodKey({
      tenantId: 't1',
      contractId: 'c1',
      periodStart: start,
      periodEnd: end,
      pricingVersion: 1,
    });
    expect(a).toBe(b);
    expect(billingIdempotencyKey({
      tenantId: 't1',
      contractId: 'c1',
      periodStart: start,
      periodEnd: end,
      pricingVersion: 1,
    })).toMatch(/^bill:/);
  });
});

describe('rentalV2 pricing deposit not in revenue', () => {
  it('keeps deposit separate from invoiceable total', () => {
    const p = priceRentalLine({
      startAt: '2026-07-01T08:00:00Z',
      endAt: '2026-07-03T08:00:00Z',
      rateUnit: 'day',
      baseRate: 100,
      quantity: 1,
      depositAmount: 500,
      taxRatePercent: 0,
    });
    expect(p.deposit).toBe(500);
    expect(p.total).toBe(p.subtotal);
    expect(p.total).not.toBe(p.subtotal + p.deposit);
  });
});

describe('hiringV2 state', () => {
  it('submit then approve hire request', () => {
    expect(assertHireRequestCommand(HIRE_REQUEST_STATUS.DRAFT, 'submit').nextStatus).toBe(
      'SUBMITTED'
    );
    expect(assertHireRequestCommand('SUBMITTED', 'approve').nextStatus).toBe('APPROVED');
  });

  it('agreement activate from approved', () => {
    expect(assertHireAgreementCommand('APPROVED', 'activate').nextStatus).toBe('ACTIVE');
  });
});

describe('deposit apply/refund remaining math', () => {
  it('remaining after refund then apply', () => {
    const base = {
      receivedAmount: 1000,
      appliedAmount: 0,
      refundedAmount: 0,
      forfeitedAmount: 0,
    };
    expect(remainingDeposit({ ...base, refundedAmount: 400 })).toBe(600);
    expect(remainingDeposit({ ...base, appliedAmount: 250, refundedAmount: 250 })).toBe(500);
  });
});
