// lib/clients/upsertClient.js
// Thin adapters over the existing client routes so the desktop outbox reuses their
// validation (email uniqueness per tenant, additionalEmails parsing, audit logging).
import { POST as clientsCreateRoute } from '@/app/api/clients/route';
import { PUT as clientUpdateRoute } from '@/app/api/clients/[id]/route';
import { callRouteHandler } from '@/lib/callRouteHandler';
import { serviceError } from '@/lib/serviceErrors';

/** Create when the payload has no server id, otherwise update in place. */
export async function upsertClient({ request, body }) {
  const clientId = body?.clientId || body?.id || null;

  if (clientId) {
    const payload = await callRouteHandler({
      handler: clientUpdateRoute,
      request,
      method: 'PUT',
      path: `/api/clients/${clientId}`,
      body,
      params: { id: clientId },
    });
    return payload?.client ?? payload;
  }

  const payload = await callRouteHandler({
    handler: clientsCreateRoute,
    request,
    method: 'POST',
    path: '/api/clients',
    body,
  });
  return payload?.client ?? payload;
}

/** Archive = the inactive status the clients PUT already supports. */
export async function archiveClient({ request, clientId }) {
  if (!clientId) {
    throw serviceError('Client ID is required', { status: 400 });
  }

  const payload = await callRouteHandler({
    handler: clientUpdateRoute,
    request,
    method: 'PUT',
    path: `/api/clients/${clientId}`,
    body: { isActive: false },
    params: { id: clientId },
  });

  return payload?.client ?? payload;
}
