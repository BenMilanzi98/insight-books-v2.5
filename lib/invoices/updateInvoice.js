// lib/invoices/updateInvoice.js
// Thin adapter over PUT /api/invoices/[id]. The update flow re-posts revenue, tax and
// COGS journals inside that handler; replaying the queued payload through it keeps a
// single posting path instead of copying ~370 lines of accounting into a second place.
import { PUT as invoicePutRoute } from '@/app/api/invoices/[id]/route';
import { callRouteHandler } from '@/lib/callRouteHandler';
import { serviceError } from '@/lib/serviceErrors';

export async function updateInvoice({ request, invoiceId, body }) {
  if (!invoiceId) {
    throw serviceError('Invoice ID is required', { status: 400 });
  }

  const payload = await callRouteHandler({
    handler: invoicePutRoute,
    request,
    method: 'PUT',
    path: `/api/invoices/${invoiceId}`,
    body,
    params: { id: invoiceId },
  });

  return payload?.invoice ?? payload;
}
