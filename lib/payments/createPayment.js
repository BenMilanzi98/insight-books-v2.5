// lib/payments/createPayment.js
// Thin adapter over POST /api/payments, which owns customer-payment GL posting,
// transfers and adjustments. Replaying the queued payload through that handler keeps
// one payment posting path.
import { POST as paymentsRoute } from '@/app/api/payments/route';
import { callRouteHandler } from '@/lib/callRouteHandler';

export async function createPayment({ request, body }) {
  const payload = await callRouteHandler({
    handler: paymentsRoute,
    request,
    method: 'POST',
    path: '/api/payments',
    body,
  });

  return payload?.payment ?? payload;
}
