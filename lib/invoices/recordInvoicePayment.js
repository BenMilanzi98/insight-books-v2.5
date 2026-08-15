// lib/invoices/recordInvoicePayment.js
// Thin adapter over POST /api/invoices/partial-payment, which owns AR/cash posting,
// invoice balance recalculation and revenue recognition for invoice payments.
import { POST as partialPaymentRoute } from '@/app/api/invoices/partial-payment/route';
import { callRouteHandler } from '@/lib/callRouteHandler';

export async function recordInvoicePayment({ request, body }) {
  const payload = await callRouteHandler({
    handler: partialPaymentRoute,
    request,
    method: 'POST',
    path: '/api/invoices/partial-payment',
    body,
  });

  return payload?.payment ?? payload;
}
