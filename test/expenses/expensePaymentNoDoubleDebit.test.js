import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static guard: partial-payment route must settle via postExpensePaymentAccounting
 * and handle EXPENSE_PAYMENT_NO_ADDITIONAL_GL (no second expense debit).
 */
describe('expense partial-payment no double-debit', () => {
  const routePath = join(
    process.cwd(),
    'app/api/expenses/partial-payment/route.js'
  );
  const source = readFileSync(routePath, 'utf8');

  it('imports and calls postExpensePaymentAccounting', () => {
    expect(source).toContain('postExpensePaymentAccounting');
    expect(source).toContain('expensePaymentAdapter');
  });

  it('handles EXPENSE_PAYMENT_NO_ADDITIONAL_GL without re-debiting expense', () => {
    expect(source).toContain('EXPENSE_PAYMENT_NO_ADDITIONAL_GL');
    expect(source).not.toMatch(/postTaxSettlementAccounting/);
  });
});
