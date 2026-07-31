import { addMoney, subtractMoney } from '@/lib/money';
import { withClientStatus } from '@/lib/clientStatus';

/**
 * Build list/detail metrics from a client that includes invoices + sales relations.
 */
export function buildClientMetrics(client) {
  const invoices = client.invoices || [];
  const sales = client.sales || [];

  const totalBilledFromInvoices = invoices.reduce((sum, invoice) => addMoney(sum, invoice.total), 0);
  const totalBilledFromSales = sales.reduce((sum, sale) => addMoney(sum, sale.total), 0);
  const totalBilled = addMoney(totalBilledFromInvoices, totalBilledFromSales);

  const totalPaid = invoices.reduce((sum, invoice) => {
    const payments = invoice.payments || [];
    return addMoney(sum, payments.reduce((paymentSum, payment) => addMoney(paymentSum, payment.amount), 0));
  }, 0);

  const outstandingAmount = Math.max(0, subtractMoney(totalBilledFromInvoices, totalPaid));

  let lastInvoice = null;
  if (invoices.length > 0) {
    const sorted = [...invoices].sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
    lastInvoice = sorted[0].issueDate;
  }

  const { invoices: _i, sales: _s, ...rest } = client;
  return withClientStatus({
    ...rest,
    totalBilled,
    totalPaid,
    outstandingAmount,
    invoiceCount: invoices.length,
    salesCount: sales.length,
    lastInvoice,
  });
}
