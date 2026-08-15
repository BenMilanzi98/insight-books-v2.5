// lib/stock/adjustStock.js
// Thin adapter over PUT /api/stock/[id]. That handler owns stock-level validation,
// expiry batch allocation and the inventory GL side-effects, so the desktop outbox
// replays the queued adjustment through it rather than writing stockLevel directly.
import { PUT as stockPutRoute } from '@/app/api/stock/[id]/route';
import { callRouteHandler } from '@/lib/callRouteHandler';
import { serviceError } from '@/lib/serviceErrors';

/**
 * @param {object} args
 * @param {object} args.body Must carry an absolute target quantity
 *   (`quantityInStock` or `stockLevel`); relative deltas are rejected because the
 *   product route only accepts an absolute level.
 */
export async function adjustStock({ request, productId, body }) {
  if (!productId) {
    throw serviceError('Product ID is required', { status: 400 });
  }

  const target = body?.quantityInStock ?? body?.stockLevel;
  if (target == null || Number.isNaN(Number(target))) {
    throw serviceError(
      'stock.adjust requires an absolute quantityInStock value',
      { status: 400, code: 'ABSOLUTE_QUANTITY_REQUIRED' }
    );
  }

  const payload = await callRouteHandler({
    handler: stockPutRoute,
    request,
    method: 'PUT',
    path: `/api/stock/${productId}`,
    body: { ...body, quantityInStock: Number(target) },
    params: { id: productId },
  });

  return payload?.product ?? payload;
}
