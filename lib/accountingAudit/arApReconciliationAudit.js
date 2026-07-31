/**
 * Receivables / Payables control-account reconciliation. READ-ONLY.
 *
 * Compares:
 *   AR: sum of open invoice remaining balances (operational) vs journal-derived
 *       balance of the Accounts Receivable control account (1200).
 *   AP: sum of unpaid supplier bills + unpaid expense payables (operational)
 *       vs journal-derived Accounts Payable control balance (2110).
 */

import {
  SEVERITY,
  CONFIDENCE,
  POSTED_STATUSES,
  makeFinding,
  toCents,
  centsToAmount,
} from './findings.js';

const AR_CODES = ['1200'];
const AP_CODES = ['2110'];

async function journalDerivedCents(prisma, accountIds) {
  if (!accountIds.length) return { dr: 0, cr: 0 };
  const txn = await prisma.transactionLine.aggregate({
    where: {
      accountId: { in: accountIds },
      transaction: { status: { in: POSTED_STATUSES } },
    },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const je = await prisma.journalEntryLine.aggregate({
    where: {
      accountId: { in: accountIds },
      journalEntry: { status: { in: POSTED_STATUSES }, transactionId: null },
    },
    _sum: { debitAmount: true, creditAmount: true },
  });
  return {
    dr: toCents(txn._sum.debitAmount) + toCents(je._sum.debitAmount),
    cr: toCents(txn._sum.creditAmount) + toCents(je._sum.creditAmount),
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null }} scope
 */
export async function runArApReconciliationAudit(prisma, scope = {}) {
  const findings = [];
  const rows = [];

  const tenants = scope.tenantId
    ? [{ id: scope.tenantId }]
    : await prisma.tenant.findMany({ select: { id: true, name: true } });

  for (const tenant of tenants) {
    // ---------- AR ----------
    const arAccounts = await prisma.account.findMany({
      where: { tenantId: tenant.id, accountCode: { in: AR_CODES } },
      select: { id: true, accountCode: true, accountName: true, balance: true },
    });
    const arIds = arAccounts.map((a) => a.id);
    const arGl = await journalDerivedCents(prisma, arIds);
    const arControlCents = arGl.dr - arGl.cr; // asset: debit-normal

    const openInvoices = await prisma.invoice.findMany({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        isReversal: false,
        status: { notIn: ['draft', 'Draft', 'cancelled', 'Cancelled', 'void', 'voided', 'Voided', 'paid', 'Paid'] },
      },
      select: { id: true, invoiceNumber: true, total: true, totalPaid: true, remainingBalance: true, status: true },
    });

    // Operational AR: prefer remainingBalance; fall back to total - totalPaid when zeroed
    let operationalArCents = 0;
    const invoiceDetails = [];
    for (const inv of openInvoices) {
      const remaining = toCents(inv.remainingBalance);
      const fallback = toCents(inv.total) - toCents(inv.totalPaid);
      const used = remaining !== 0 ? remaining : fallback;
      operationalArCents += used;
      invoiceDetails.push({
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        total: String(inv.total),
        totalPaid: String(inv.totalPaid),
        remainingBalance: String(inv.remainingBalance),
        usedForReconciliation: centsToAmount(used),
      });
      if (remaining === 0 && fallback !== 0) {
        findings.push(
          makeFinding({
            ruleCode: 'AR-001',
            severity: SEVERITY.MEDIUM,
            category: 'receivables',
            tenantId: tenant.id,
            entityType: 'Invoice',
            entityId: inv.id,
            confidence: CONFIDENCE.REVIEW,
            description:
              `Invoice ${inv.invoiceNumber}: remainingBalance is 0 but total - totalPaid = ${centsToAmount(fallback)} ` +
              `(status ${inv.status}). Operational AR fields are internally inconsistent.`,
          })
        );
      }
    }

    rows.push({
      tenantId: tenant.id,
      side: 'AR',
      controlAccounts: arAccounts.map((a) => `${a.accountCode} ${a.accountName}`).join(', '),
      journalDerivedControl: centsToAmount(arControlCents),
      operationalSubledger: centsToAmount(operationalArCents),
      difference: centsToAmount(arControlCents - operationalArCents),
      detail: invoiceDetails,
    });

    if (arControlCents !== operationalArCents) {
      findings.push(
        makeFinding({
          ruleCode: 'AR-001',
          severity: SEVERITY.CRITICAL,
          category: 'receivables',
          tenantId: tenant.id,
          entityType: 'Account',
          entityId: arIds.join(','),
          description:
            `AR control account (journal-derived ${centsToAmount(arControlCents)}) does not equal ` +
            `open-invoice subledger (${centsToAmount(operationalArCents)}).`,
          differenceAmount: centsToAmount(arControlCents - operationalArCents),
          evidence: { openInvoiceCount: openInvoices.length },
        })
      );
    }

    // ---------- AP ----------
    const apAccounts = await prisma.account.findMany({
      where: { tenantId: tenant.id, accountCode: { in: AP_CODES } },
      select: { id: true, accountCode: true, accountName: true, balance: true },
    });
    const apIds = apAccounts.map((a) => a.id);
    const apGl = await journalDerivedCents(prisma, apIds);
    const apControlCents = apGl.cr - apGl.dr; // liability: credit-normal

    const unpaidBills = await prisma.supplierBill.findMany({
      where: {
        tenantId: tenant.id,
        status: { notIn: ['Draft', 'draft', 'Cancelled', 'cancelled', 'Paid', 'paid'] },
      },
      select: { id: true, billNumber: true, totalAmount: true, amountPaid: true, status: true },
    });
    let operationalApCents = 0;
    for (const bill of unpaidBills) {
      operationalApCents += toCents(bill.totalAmount) - toCents(bill.amountPaid);
    }

    // Unpaid portions of AP-routed expenses
    const unpaidExpenses = await prisma.expense.findMany({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        isReversal: false,
        paymentStatus: { notIn: ['Fully paid', 'fully paid'] },
      },
      select: { id: true, description: true, amount: true, paidAmount: true },
    });
    for (const exp of unpaidExpenses) {
      operationalApCents += toCents(exp.amount) - toCents(exp.paidAmount);
    }

    rows.push({
      tenantId: tenant.id,
      side: 'AP',
      controlAccounts: apAccounts.map((a) => `${a.accountCode} ${a.accountName}`).join(', '),
      journalDerivedControl: centsToAmount(apControlCents),
      operationalSubledger: centsToAmount(operationalApCents),
      difference: centsToAmount(apControlCents - operationalApCents),
      detail: {
        unpaidBillCount: unpaidBills.length,
        unpaidExpenseCount: unpaidExpenses.length,
      },
    });

    if (apControlCents !== operationalApCents) {
      findings.push(
        makeFinding({
          ruleCode: 'AP-001',
          severity: SEVERITY.CRITICAL,
          category: 'payables',
          tenantId: tenant.id,
          entityType: 'Account',
          entityId: apIds.join(','),
          description:
            `AP control account (journal-derived ${centsToAmount(apControlCents)}) does not equal ` +
            `supplier/expense subledger (${centsToAmount(operationalApCents)}).`,
          differenceAmount: centsToAmount(apControlCents - operationalApCents),
        })
      );
    }

    // Unsupported liability balances: stored balance without journal support
    const liabilityAccounts = await prisma.account.findMany({
      where: { tenantId: tenant.id, accountType: 'Liability' },
      select: { id: true, accountCode: true, accountName: true, balance: true },
    });
    for (const account of liabilityAccounts) {
      const stored = toCents(account.balance);
      if (stored === 0) continue;
      const gl = await journalDerivedCents(prisma, [account.id]);
      const derived = gl.cr - gl.dr;
      if (derived !== stored) {
        findings.push(
          makeFinding({
            ruleCode: 'AP-004',
            severity: SEVERITY.CRITICAL,
            category: 'payables',
            tenantId: tenant.id,
            entityType: 'Account',
            entityId: account.id,
            description:
              `Liability ${account.accountCode} ${account.accountName} stored balance ${centsToAmount(stored)} ` +
              `is not fully supported by journals (journal-derived ${centsToAmount(derived)}).`,
            differenceAmount: centsToAmount(stored - derived),
            recommendation:
              'This is the "liability visible in CoA but not in Journal Entries" class. Phase 2: locate source obligations and post migration journals with evidence.',
          })
        );
      }
    }
  }

  return { findings, rows };
}
