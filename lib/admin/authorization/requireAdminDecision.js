import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { authorizeAdminDecision } from './authorizeAdminDecision.js';
import { resolveAdminActor } from './resolveAdminActor.js';
import { AUTHZ_OUTCOMES } from './outcomes.js';

/**
 * API helper: authenticate + authorise a permission.
 * @returns {Promise<{ ok: true, admin, actor, decision } | { ok: false, response: Response }>}
 */
export async function requireAdminDecision(request, { permission, supportSession } = {}) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  const actor = resolveAdminActor(admin, { supportSession });
  const decision = authorizeAdminDecision({ admin, permission });

  if (!decision.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Insufficient admin privileges',
          outcome: decision.outcome || AUTHZ_OUTCOMES.DENY,
          reason: decision.reason,
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, admin, actor, decision };
}
