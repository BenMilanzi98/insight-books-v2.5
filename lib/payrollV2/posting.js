import { parseMoney, addMoney, roundMoney } from '@/lib/money';
import { postPayrollAccounting } from '@/lib/accountingV2/adapters/remainingAdapters';
import {
  AccountingEventType,
  AccountingSourceModule,
} from '@/lib/accountingV2/domain/enums';
import {
  amountString,
  contextFromSession,
  submitViaCutover,
  toIsoDate,
} from '@/lib/accountingV2/adapters/baseAdapter';

/**
 * Build balanced recognition lines from run totals + account map.
 */
export function buildRecognitionLines(run, accountMap) {
  const totals = run.totals || {};
  const gross = parseMoney(totals.grossPay);
  const paye = parseMoney(totals.payeAmount);
  const npsEe = parseMoney(totals.npsEmployee);
  const npsEr = parseMoney(totals.npsEmployer);
  const adv = parseMoney(totals.advanceRecovery);
  const net = parseMoney(totals.netPay);
  const other = Math.max(0, roundMoney(gross - net - paye - npsEe - adv));

  const lines = [];
  if (gross > 0 && accountMap.salaryExpenseId) {
    lines.push({
      accountId: accountMap.salaryExpenseId,
      debit: gross,
      credit: 0,
      description: 'Salary expense',
    });
  }
  if (npsEr > 0 && accountMap.npsEmployerExpenseId) {
    lines.push({
      accountId: accountMap.npsEmployerExpenseId,
      debit: npsEr,
      credit: 0,
      description: 'Employer NPS expense',
    });
  }
  if (paye > 0 && accountMap.payePayableId) {
    lines.push({
      accountId: accountMap.payePayableId,
      debit: 0,
      credit: paye,
      description: 'PAYE payable',
    });
  }
  if (npsEe > 0 && accountMap.npsEmployeePayableId) {
    lines.push({
      accountId: accountMap.npsEmployeePayableId,
      debit: 0,
      credit: npsEe,
      description: 'NPS employee payable',
    });
  }
  if (npsEr > 0 && accountMap.npsEmployerPayableId) {
    lines.push({
      accountId: accountMap.npsEmployerPayableId,
      debit: 0,
      credit: npsEr,
      description: 'NPS employer payable',
    });
  }
  if (other > 0 && accountMap.otherDeductionsPayableId) {
    lines.push({
      accountId: accountMap.otherDeductionsPayableId,
      debit: 0,
      credit: other,
      description: 'Other deductions payable',
    });
  }
  if (adv > 0 && accountMap.advancesReceivableId) {
    lines.push({
      accountId: accountMap.advancesReceivableId,
      debit: 0,
      credit: adv,
      description: 'Advance recovery',
    });
  }
  if (net > 0 && accountMap.salariesPayableId) {
    lines.push({
      accountId: accountMap.salariesPayableId,
      debit: 0,
      credit: net,
      description: 'Salaries payable',
    });
  }

  const debit = lines.reduce((s, l) => addMoney(s, l.debit || 0), 0);
  const credit = lines.reduce((s, l) => addMoney(s, l.credit || 0), 0);
  if (Math.abs(debit - credit) > 0.01) {
    throw new Error(
      `Recognition journal unbalanced: debit ${debit} credit ${credit}. Check account mappings.`
    );
  }
  return lines;
}

export async function postPayrollRunRecognition({
  tenantId,
  userId,
  run,
  linesBuilder,
}) {
  const accountMap = run.mappingSnapshot || {};
  const lines =
    typeof linesBuilder === 'function'
      ? await linesBuilder(run)
      : buildRecognitionLines(run, accountMap);

  if (!lines?.length) {
    throw new Error(
      'No recognition lines. Set mappingSnapshot on the run (salaryExpenseId, salariesPayableId, …) or pass linesBuilder.'
    );
  }

  const amount = lines.reduce((s, l) => addMoney(s, l.debit || 0), 0);
  return postPayrollAccounting({
    tenantId,
    userId,
    payrollId: `PayrollRun:${run.id}:v${run.version}:RECOGNITION`,
    amount,
    date: run.periodEnd,
    description: `Payroll recognition ${run.runNumber || run.id}`,
    lines,
    sourceType: 'PayrollRun',
  });
}

export async function postPayrollRunPayment({
  tenantId,
  userId,
  run,
  batch,
  linesBuilder,
}) {
  const accountMap = run.mappingSnapshot || {};
  const net = parseMoney(batch.totalAmount ?? run.totals?.netPay);

  let lines;
  if (typeof linesBuilder === 'function') {
    lines = await linesBuilder(run, batch);
  } else {
    const paymentAccountId = batch.paymentAccountId || accountMap.paymentAccountId;
    if (!accountMap.salariesPayableId || !paymentAccountId) {
      throw new Error(
        'Payment requires salariesPayableId and paymentAccountId in mappingSnapshot/batch'
      );
    }
    lines = [
      {
        accountId: accountMap.salariesPayableId,
        debit: net,
        credit: 0,
        description: 'Clear salaries payable',
      },
      {
        accountId: paymentAccountId,
        debit: 0,
        credit: net,
        description: 'Payroll payment',
      },
    ];
  }

  const context = contextFromSession({ tenantId, userId, currency: run.currency || 'MWK' });
  return submitViaCutover({
    context,
    moduleKey: AccountingSourceModule.PAYROLL,
    eventType: AccountingEventType.PAYROLL_PAYMENT_POSTED,
    hasPermission: () => true,
    buildEngineInput: async () => ({
      sourceReference: {
        sourceModule: AccountingSourceModule.PAYROLL,
        sourceType: 'PayrollPaymentBatch',
        sourceId: batch.id,
        sourceNumber: batch.id,
        eventType: AccountingEventType.PAYROLL_PAYMENT_POSTED,
      },
      transactionDate: toIsoDate(batch.paymentDate),
      requestedPostingDate: toIsoDate(batch.paymentDate),
      currency: run.currency || 'MWK',
      totalAmount: amountString(net),
      taxAmount: '0.00',
      description: `Payroll payment ${run.runNumber || run.id}`,
      dimensions: {},
      metadata: { lines },
      payload: null,
    }),
  });
}
