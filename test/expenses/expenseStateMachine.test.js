import { describe, it, expect } from 'vitest';
import {
  assertExpenseCreateStatus,
  assertExpenseTransition,
  assertPaymentStatusTransition,
  canEditDraft,
  canPost,
  canTransitionExpense,
  EXPENSE_STATUSES,
} from '../../lib/expenses/expenseStateMachine.js';

describe('expenseStateMachine', () => {
  it('exports canonical DB-aligned status strings', () => {
    expect(EXPENSE_STATUSES.DRAFT).toBe('Draft');
    expect(EXPENSE_STATUSES.PENDING).toBe('Pending');
    expect(EXPENSE_STATUSES.SUBMITTED).toBe('Submitted');
    expect(EXPENSE_STATUSES.IN_REVIEW).toBe('In review');
    expect(EXPENSE_STATUSES.APPROVED).toBe('Approved');
    expect(EXPENSE_STATUSES.REJECTED).toBe('Rejected');
    expect(EXPENSE_STATUSES.PARTIALLY).toBe('Partially');
    expect(EXPENSE_STATUSES.FULLY_PAID).toBe('Fully paid');
  });

  it('allows Draft/Pending → Submitted/In review → Approved', () => {
    expect(canTransitionExpense('Draft', 'Submitted')).toBe(true);
    expect(canTransitionExpense('Draft', 'In review')).toBe(true);
    expect(canTransitionExpense('Pending', 'Submitted')).toBe(true);
    expect(canTransitionExpense('Pending', 'In review')).toBe(true);
    expect(canTransitionExpense('Submitted', 'Approved')).toBe(true);
    expect(canTransitionExpense('In review', 'Approved')).toBe(true);
    expect(() => assertExpenseTransition('Pending', 'Approved')).not.toThrow();
  });

  it('allows Approved → Reversed and Rejected re-edit', () => {
    expect(canTransitionExpense('Approved', 'Reversed')).toBe(true);
    expect(canTransitionExpense('Rejected', 'Draft')).toBe(true);
    expect(canTransitionExpense('Approved', 'Draft')).toBe(false);
    expect(() => assertExpenseTransition('Approved', 'Pending')).toThrow(
      /Invalid expense status transition/
    );
  });

  it('allows payment status Partially / Fully paid transitions', () => {
    expect(canTransitionExpense('Pending', 'Partially')).toBe(true);
    expect(canTransitionExpense('Partially', 'Fully paid')).toBe(true);
    expect(canTransitionExpense('Fully paid', 'Partially')).toBe(false);
  });

  it('canEditDraft / canPost guards', () => {
    expect(canEditDraft('Draft')).toBe(true);
    expect(canEditDraft('Pending')).toBe(true);
    expect(canEditDraft('Rejected')).toBe(true);
    expect(canEditDraft('Approved')).toBe(false);
    expect(canPost('Approved')).toBe(true);
    expect(canPost('Pending')).toBe(false);
  });

  it('allows Draft → Approved create-and-post shortcut', () => {
    expect(canTransitionExpense('Draft', 'Approved')).toBe(true);
    expect(() => assertExpenseTransition('Draft', 'Approved')).not.toThrow();
  });

  it('assertExpenseCreateStatus allows Draft/Pending/Submitted/Approved only', () => {
    expect(assertExpenseCreateStatus('Draft')).toBe('Draft');
    expect(assertExpenseCreateStatus(null)).toBe('Draft');
    expect(assertExpenseCreateStatus('Approved')).toBe('Approved');
    expect(() => assertExpenseCreateStatus('Rejected')).toThrow(/Invalid create status/);
    expect(() => assertExpenseCreateStatus('Reversed')).toThrow(/Invalid create status/);
  });

  it('assertPaymentStatusTransition enforces Pending → Partially → Fully paid', () => {
    expect(() => assertPaymentStatusTransition('Pending', 'Fully paid')).not.toThrow();
    expect(() => assertPaymentStatusTransition('Partially', 'Fully paid')).not.toThrow();
    expect(() => assertPaymentStatusTransition('Fully paid', 'Pending')).toThrow(
      /Invalid payment status transition/
    );
  });
});
