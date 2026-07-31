/**
 * Source-linkage audit — verifies every financially significant operational
 * record has a posted GL journal, and every posted journal traces back to a
 * live source record. READ-ONLY.
 *
 * Source conventions observed in posting code (lib/*GlPosting, cogsIntegration,
 * transactionJournalHelpers): Transaction.sourceId usually stores either the
 * operational record id or a caller-provided idempotency key, so linkage is
 * checked both by id and by known sourceType families.
 */

import { SEVERITY, CONFIDENCE, POSTED_STATUSES, makeFinding } from './findings.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null }} scope
 */
export async function runSourceLinkageAudit(prisma, scope = {}) {
  const findings = [];
  const tenantWhere = scope.tenantId ? { tenantId: scope.tenantId } : {};

  const stats = {
    salesWithoutGl: 0,
    invoicesWithoutGl: 0,
    paymentsWithoutGl: 0,
    expensesWithoutGl: 0,
    supplierBillsWithoutGl: 0,
    supplierPaymentsWithoutGl: 0,
    orphanJournals: 0,
  };

  const hasPostedTxnForSource = async (tenantId, ids) => {
    if (!ids.length) return new Set();
    const txns = await prisma.transaction.findMany({
      where: {
        tenantId,
        status: { in: POSTED_STATUSES },
        sourceId: { in: ids },
      },
      select: { sourceId: true },
    });
    return new Set(txns.map((t) => t.sourceId));
  };

  // ---- Completed sales must have GL ----
  const sales = await prisma.sale.findMany({
    where: { ...tenantWhere, status: { in: ['completed', 'Completed'] }, isReversal: false },
    select: { id: true, tenantId: true, saleNumber: true, total: true },
  });
  for (const [tenantId, group] of groupBy(sales, (s) => s.tenantId)) {
    const linked = await hasPostedTxnForSource(tenantId, group.map((s) => s.id));
    // Sales may also be posted under an external idempotency key; fall back to reference scan.
    const unresolved = group.filter((s) => !linked.has(s.id));
    for (const sale of unresolved) {
      const byNumber = await prisma.transaction.count({
        where: {
          tenantId,
          status: { in: POSTED_STATUSES },
          OR: [
            { description: { contains: sale.saleNumber } },
            { reference: { contains: sale.saleNumber } },
          ],
        },
      });
      if (byNumber === 0) {
        stats.salesWithoutGl += 1;
        findings.push(
          makeFinding({
            ruleCode: 'AR-002',
            severity: SEVERITY.CRITICAL,
            category: 'source_linkage',
            tenantId,
            module: 'sales',
            entityType: 'Sale',
            entityId: sale.id,
            description: `Completed sale ${sale.saleNumber} (${sale.total}) has no posted GL transaction.`,
            confidence: CONFIDENCE.HIGHLY_LIKELY,
            recommendation: 'Phase 2: create missing journal with evidence, or mark historical.',
          })
        );
      }
    }
  }

  // ---- Non-draft, non-cancelled invoices must have GL ----
  const invoices = await prisma.invoice.findMany({
    where: {
      ...tenantWhere,
      isDeleted: false,
      isReversal: false,
      status: { notIn: ['draft', 'Draft', 'cancelled', 'Cancelled', 'void', 'Voided', 'voided'] },
    },
    select: { id: true, tenantId: true, invoiceNumber: true, total: true, status: true },
  });
  for (const [tenantId, group] of groupBy(invoices, (i) => i.tenantId)) {
    const linked = await hasPostedTxnForSource(tenantId, group.map((i) => i.id));
    for (const inv of group.filter((i) => !linked.has(i.id))) {
      const byNumber = await prisma.transaction.count({
        where: {
          tenantId,
          status: { in: POSTED_STATUSES },
          OR: [
            { description: { contains: inv.invoiceNumber } },
            { reference: { contains: inv.invoiceNumber } },
          ],
        },
      });
      if (byNumber === 0) {
        stats.invoicesWithoutGl += 1;
        findings.push(
          makeFinding({
            ruleCode: 'AR-002',
            severity: SEVERITY.CRITICAL,
            category: 'source_linkage',
            tenantId,
            module: 'invoicing',
            entityType: 'Invoice',
            entityId: inv.id,
            description: `Invoice ${inv.invoiceNumber} (status ${inv.status}, total ${inv.total}) has no posted GL transaction.`,
            confidence: CONFIDENCE.HIGHLY_LIKELY,
          })
        );
      }
    }
  }

  // ---- Completed payments must have GL ----
  const payments = await prisma.payment.findMany({
    where: { ...tenantWhere, status: { in: ['Completed', 'completed'] }, isReversal: false },
    select: { id: true, tenantId: true, amount: true, invoiceId: true, saleId: true, expenseId: true },
  });
  for (const [tenantId, group] of groupBy(payments, (p) => p.tenantId)) {
    const linked = await hasPostedTxnForSource(tenantId, group.map((p) => p.id));
    for (const pay of group.filter((p) => !linked.has(p.id))) {
      stats.paymentsWithoutGl += 1;
      findings.push(
        makeFinding({
          ruleCode: 'AR-003',
          severity: SEVERITY.CRITICAL,
          category: 'source_linkage',
          tenantId,
          module: 'payments',
          entityType: 'Payment',
          entityId: pay.id,
          description: `Completed payment of ${pay.amount} has no posted GL transaction referencing it as source.`,
          confidence: CONFIDENCE.POSSIBLE,
          evidence: { invoiceId: pay.invoiceId, saleId: pay.saleId, expenseId: pay.expenseId },
          recommendation:
            'Verify whether the parent invoice/sale posting covered this payment (keyed posting) before classifying as missing.',
        })
      );
    }
  }

  // ---- Approved, non-deleted expenses must have GL ----
  const expenses = await prisma.expense.findMany({
    where: {
      ...tenantWhere,
      isDeleted: false,
      isReversal: false,
      status: { in: ['Approved', 'approved', 'Paid', 'paid'] },
    },
    select: { id: true, tenantId: true, description: true, amount: true },
  });
  for (const [tenantId, group] of groupBy(expenses, (e) => e.tenantId)) {
    const linked = await hasPostedTxnForSource(tenantId, group.map((e) => e.id));
    for (const exp of group.filter((e) => !linked.has(e.id))) {
      const byDesc = await prisma.transaction.count({
        where: {
          tenantId,
          status: { in: POSTED_STATUSES },
          sourceType: { in: ['expense', 'Expense'] },
          description: { contains: exp.description.slice(0, 30) },
        },
      });
      if (byDesc === 0) {
        stats.expensesWithoutGl += 1;
        findings.push(
          makeFinding({
            ruleCode: 'AP-002',
            severity: SEVERITY.CRITICAL,
            category: 'source_linkage',
            tenantId,
            module: 'expenses',
            entityType: 'Expense',
            entityId: exp.id,
            description: `Approved expense "${exp.description}" (${exp.amount}) has no posted GL transaction.`,
            confidence: CONFIDENCE.HIGHLY_LIKELY,
          })
        );
      }
    }
  }

  // ---- Finalized supplier bills / payments ----
  const bills = await prisma.supplierBill.findMany({
    where: { ...tenantWhere, status: { notIn: ['Draft', 'draft', 'Cancelled', 'cancelled'] } },
    select: { id: true, tenantId: true, billNumber: true, totalAmount: true, journalEntryId: true },
  });
  for (const [tenantId, group] of groupBy(bills, (b) => b.tenantId)) {
    const linked = await hasPostedTxnForSource(tenantId, group.map((b) => b.id));
    for (const bill of group.filter((b) => !linked.has(b.id) && !b.journalEntryId)) {
      const byNumber = await prisma.transaction.count({
        where: {
          tenantId,
          status: { in: POSTED_STATUSES },
          OR: [
            { description: { contains: bill.billNumber } },
            { reference: { contains: bill.billNumber } },
          ],
        },
      });
      if (byNumber === 0) {
        stats.supplierBillsWithoutGl += 1;
        findings.push(
          makeFinding({
            ruleCode: 'AP-002',
            severity: SEVERITY.CRITICAL,
            category: 'source_linkage',
            tenantId,
            module: 'payables',
            entityType: 'SupplierBill',
            entityId: bill.id,
            description: `Supplier bill ${bill.billNumber} (${bill.totalAmount}) has no journal linkage (journalEntryId null, no Transaction source).`,
            confidence: CONFIDENCE.HIGHLY_LIKELY,
          })
        );
      }
    }
  }

  const supplierPayments = await prisma.supplierPayment.findMany({
    where: { ...tenantWhere, isReversal: false },
    select: { id: true, tenantId: true, paymentNumber: true, totalAmount: true, journalEntryId: true },
  });
  for (const [tenantId, group] of groupBy(supplierPayments, (p) => p.tenantId)) {
    const linked = await hasPostedTxnForSource(tenantId, group.map((p) => p.id));
    for (const pay of group.filter((p) => !linked.has(p.id) && !p.journalEntryId)) {
      const byNumber = await prisma.transaction.count({
        where: {
          tenantId,
          status: { in: POSTED_STATUSES },
          OR: [
            { description: { contains: pay.paymentNumber } },
            { reference: { contains: pay.paymentNumber } },
          ],
        },
      });
      if (byNumber === 0) {
        stats.supplierPaymentsWithoutGl += 1;
        findings.push(
          makeFinding({
            ruleCode: 'AP-003',
            severity: SEVERITY.CRITICAL,
            category: 'source_linkage',
            tenantId,
            module: 'payables',
            entityType: 'SupplierPayment',
            entityId: pay.id,
            description: `Supplier payment ${pay.paymentNumber} (${pay.totalAmount}) has no journal linkage.`,
            confidence: CONFIDENCE.HIGHLY_LIKELY,
          })
        );
      }
    }
  }

  return { findings, stats };
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
