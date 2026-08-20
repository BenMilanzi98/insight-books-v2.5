import { cookies } from 'next/headers';
import { parseSessionPayload } from '../../sessionCookie.js';
import { isDesktopRuntime } from '../runtime.js';

async function getDesktopDbLazy() {
  const { getDesktopDbFromEnv } = await import('../sqlite/db.js');
  return getDesktopDbFromEnv();
}

function getSnapshotJson(db, entity) {
  const row = db.prepare('SELECT payload FROM snapshot_json WHERE entity = ?').get(entity);
  if (!row?.payload) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function getDesktopSessionUserFromDb(db, { userId, tenantId }) {
  if (!userId) return null;

  const sessionUser = getSnapshotJson(db, 'sessionUser');
  if (!sessionUser?.id) return null;
  if (String(sessionUser.id) !== String(userId)) return null;
  if (
    tenantId != null &&
    sessionUser.tenantId != null &&
    String(sessionUser.tenantId) !== String(tenantId)
  ) {
    return null;
  }

  return {
    ...sessionUser,
    isActive: true,
    currentBranchId: sessionUser.currentBranchId ?? null,
    sessionId: sessionUser.sessionId ?? null,
  };
}

async function getSessionTokenFromRequest(request) {
  const cookieStore = await cookies();
  let sessionValue = cookieStore.get('session')?.value;

  if (!sessionValue && request?.headers) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionValue = authHeader.substring(7).trim();
    }
  }

  if (!sessionValue && request?.headers) {
    const rawCookie = request.headers.get('cookie') || '';
    const match = rawCookie.match(/(?:^|;\s*)session=([^;]+)/);
    if (match) {
      try {
        sessionValue = decodeURIComponent(match[1].trim());
      } catch {
        sessionValue = match[1].trim();
      }
    }
  }

  return sessionValue || null;
}

export async function getDesktopSessionUser(request) {
  // Web / VPS must never open desktop SQLite (and must not pull schema paths into the request path).
  if (!isDesktopRuntime()) return null;

  const sessionValue = await getSessionTokenFromRequest(request);
  if (!sessionValue) return null;

  const sessionData = parseSessionPayload(sessionValue);
  if (!sessionData?.userId) return null;

  const db = await getDesktopDbLazy();
  return getDesktopSessionUserFromDb(db, {
    userId: sessionData.userId,
    tenantId: sessionData.tenantId,
  });
}
